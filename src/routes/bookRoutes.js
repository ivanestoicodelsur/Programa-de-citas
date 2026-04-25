import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { requireAuth, requireRoles } from "../middlewares/auth.js";
import { Purchase, User, Ebook } from "../models/sqlModels.js";
import { BOOKS, PACKS, findBook, publicCatalog } from "../config/booksCatalog.js";
import { captureLead, markAsPurchaser, findLeadByEmailOrPhone } from "../services/leadService.js";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fallback al filesystem solo si la DB no tiene el ebook todavía (legacy)
const BOOKS_DIR = path.join(__dirname, "../../private/books");

// Multer en memoria — el buffer va directo al BLOB de la DB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB por archivo
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Solo se aceptan PDFs"), false);
    }
    cb(null, true);
  },
});

/* ------------------------------------------------------------------
 * GET /api/books
 * Catálogo público. No expone rutas de archivo ni el nombre del PDF.
 * ------------------------------------------------------------------ */
router.get("/", (_req, res) => {
  res.json(publicCatalog());
});

/* ------------------------------------------------------------------
 * GET /api/books/my
 * Libros que el usuario autenticado tiene derecho a descargar.
 * ------------------------------------------------------------------ */
router.get("/my", requireAuth, async (req, res, next) => {
  try {
        // Admin y manager tienen acceso completo a todos los infoproductos
        if (req.user.role === "admin" || req.user.role === "manager") {
                const all = BOOKS.map(({ file, ...rest }) => rest);
                return res.json({ books: all });
        }
    const purchases = await Purchase.findAll({
      where: { userId: req.user.id, isActive: true },
    });
    const ownedSlugs = new Set();
    for (const p of purchases) {
      if (PACKS[p.bookSlug]) {
        PACKS[p.bookSlug].includes.forEach((s) => ownedSlugs.add(s));
      } else {
        ownedSlugs.add(p.bookSlug);
      }
    }
    const owned = BOOKS.filter((b) => ownedSlugs.has(b.slug)).map(({ file, ...rest }) => rest);
    res.json({ books: owned });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------
 * GET /api/books/:slug/download
 * Verifica compra → stream PDF desde la DB. NUNCA devuelve URL pública.
 * Fallback al filesystem solo si el ebook aún no está en DB (legacy).
 * ------------------------------------------------------------------ */
router.get("/:slug/download", requireAuth, async (req, res, next) => {
  try {
    const book = findBook(req.params.slug);
    if (!book) return res.status(404).json({ message: "Libro no encontrado" });

    // ¿El usuario compró este libro directamente o dentro de un pack?
    const purchases = await Purchase.findAll({
      where: { userId: req.user.id, isActive: true },
    });
    const hasAccess = purchases.some((p) => {
      if (p.bookSlug === book.slug) return true;
      const pack = PACKS[p.bookSlug];
      return pack && pack.includes.includes(book.slug);
    });

    // Admin siempre puede descargar (para verificación y soporte)
    if (!hasAccess && req.user.role !== "admin") {
      return res.status(403).json({ message: "No tienes acceso a este libro. Compra para continuar." });
    }

    // 1) Intento desde DB (ruta nueva, persistente)
    const ebook = await Ebook.scope("withFile").findOne({ where: { slug: book.slug } });

    let buffer = null;
    let mimeType = "application/pdf";

    if (ebook && ebook.fileData) {
      buffer = ebook.fileData;
      mimeType = ebook.mimeType || "application/pdf";
    } else {
      // 2) Fallback legacy — filesystem
      const filePath = path.join(BOOKS_DIR, book.file);
      if (!fs.existsSync(filePath)) {
        return res.status(500).json({
          message: "Archivo no disponible. Pide al admin que suba el PDF desde /admin/ebooks.",
        });
      }
      buffer = fs.readFileSync(filePath);
    }

    // Actualiza contador de la compra directa (si existe)
    const directPurchase = purchases.find((p) => p.bookSlug === book.slug);
    if (directPurchase) {
      await directPurchase.update({
        downloadCount: directPurchase.downloadCount + 1,
        lastDownloadAt: new Date(),
      });
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${book.slug}.pdf"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(buffer);
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------
 * POST /api/books/admin/grant
 * Otorgar acceso manual (útil mientras integras Stripe).
 * Body: { userId, bookSlug, source, amountCents? }
 * Además de crear el Purchase, espejamos el contacto en la tabla Lead
 * unificada (source="book-purchase", channel="biblioteca") y marcamos
 * al Lead como customer para no volver a perder compradores.
 * ------------------------------------------------------------------ */
router.post("/admin/grant", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const { userId, bookSlug, source = "admin_grant", externalId = null, amountCents = 0 } = req.body;
    if (!userId || !bookSlug) {
      return res.status(400).json({ message: "userId y bookSlug son obligatorios" });
    }
    const bookOrPack = findBook(bookSlug) || PACKS[bookSlug];
    if (!bookOrPack) return res.status(400).json({ message: "bookSlug inválido" });

    const [purchase, created] = await Purchase.findOrCreate({
      where: { userId, bookSlug },
      defaults: { source, externalId, isActive: true, amountCents },
    });
    if (!created && !purchase.isActive) {
      await purchase.update({ isActive: true });
    }

    try {
      const user = await User.findByPk(userId);
      if (user && user.email) {
        const [firstName, ...rest] = (user.name || "").trim().split(/\s+/);
        const lastName = rest.join(" ") || null;

        await captureLead({
          source: "book-purchase",
          channel: "biblioteca",
          email: user.email,
          firstName: firstName || null,
          lastName,
          metadata: {
            bookSlug,
            grantSource: source,
            externalId,
            amountCents,
            userId,
          },
        }, "purchase");

        const lead = await findLeadByEmailOrPhone({ email: user.email });
        if (lead && amountCents) {
          await markAsPurchaser(lead.id, amountCents, bookSlug);
        } else if (lead) {
          await lead.update({ status: "customer", hasPurchased: true });
        }
      }
    } catch (leadErr) {
      // eslint-disable-next-line no-console
      console.error("[bookRoutes] captureLead on grant failed", userId, bookSlug, leadErr.message);
    }

    res.status(created ? 201 : 200).json({ purchase });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------
 * POST /api/books/admin/revoke
 * Revocar acceso sin borrar el registro.
 * ------------------------------------------------------------------ */
router.post("/admin/revoke", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const { userId, bookSlug } = req.body;
    const purchase = await Purchase.findOne({ where: { userId, bookSlug } });
    if (!purchase) return res.status(404).json({ message: "Compra no encontrada" });
    await purchase.update({ isActive: false });
    res.json({ purchase });
  } catch (err) { next(err); }
});

/* ==================================================================
 * EBOOKS — gestión del BLOB en la base de datos
 * ================================================================== */

/* GET /api/books/admin/ebooks
 * Lista de ebooks en DB (sin el BLOB, solo metadatos).
 */
router.get("/admin/ebooks", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const ebooks = await Ebook.findAll({ order: [["createdAt", "DESC"]] });
    const enriched = ebooks.map((e) => {
      const catalog = findBook(e.slug);
      return {
        ...e.toJSON(),
        catalogTitle: catalog?.title || null,
        cover: catalog?.cover || e.metadata?.cover || null,
        sizeMB: (e.fileSize / (1024 * 1024)).toFixed(2),
      };
    });
    // También reportamos slugs del catálogo que aún no tienen blob en DB
    const stored = new Set(ebooks.map((e) => e.slug));
    const missing = BOOKS.filter((b) => !stored.has(b.slug)).map((b) => ({
      slug: b.slug,
      title: b.title,
      status: "missing",
    }));
    res.json({ ebooks: enriched, missing });
  } catch (err) { next(err); }
});

/* POST /api/books/admin/ebooks/upload
 * Subir o reemplazar un PDF. Multipart/form-data:
 *   - file   (requerido, application/pdf)
 *   - slug   (requerido, debe coincidir con catálogo)
 *   - title  (opcional, sobrescribe el del catálogo)
 */
router.post(
  "/admin/ebooks/upload",
  requireAuth,
  requireRoles("admin"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const { slug, title } = req.body;
      if (!slug)        return res.status(400).json({ message: "slug requerido" });
      if (!req.file)    return res.status(400).json({ message: "file requerido" });
      const catalog = findBook(slug);
      if (!catalog)     return res.status(400).json({ message: `slug '${slug}' no está en el catálogo` });

      const hash = crypto.createHash("sha256").update(req.file.buffer).digest("hex");

      const existing = await Ebook.scope("withFile").findOne({ where: { slug } });
      let ebook;
      if (existing) {
        await existing.update({
          title:    title || catalog.title,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          fileData: req.file.buffer,
          sha256:   hash,
          mimeType: req.file.mimetype,
        });
        ebook = existing;
      } else {
        ebook = await Ebook.create({
          slug,
          title:    title || catalog.title,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          fileData: req.file.buffer,
          sha256:   hash,
          mimeType: req.file.mimetype,
          isPublished: true,
          metadata: { cover: catalog.cover, uploadedAt: new Date().toISOString() },
        });
      }

      // Respuesta sin el buffer
      const { fileData, ...safe } = ebook.toJSON();
      res.status(existing ? 200 : 201).json({ ebook: safe });
    } catch (err) { next(err); }
  }
);

/* DELETE /api/books/admin/ebooks/:slug
 * Elimina el blob del ebook. Las compras del usuario se mantienen.
 */
router.delete(
  "/admin/ebooks/:slug",
  requireAuth,
  requireRoles("admin"),
  async (req, res, next) => {
    try {
      const ebook = await Ebook.findOne({ where: { slug: req.params.slug } });
      if (!ebook) return res.status(404).json({ message: "Ebook no encontrado en DB" });
      await ebook.destroy();
      res.json({ ok: true, slug: req.params.slug });
    } catch (err) { next(err); }
  }
);

export default router;
