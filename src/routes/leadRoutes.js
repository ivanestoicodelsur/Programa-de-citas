import express from "express";
import { Op, fn, col, literal } from "sequelize";
import { requireAuth, requireRoles } from "../middlewares/auth.js";
import { Lead, LeadActivity } from "../models/sqlModels.js";
import { captureLead } from "../services/leadService.js";

const router = express.Router();

/* ------------------------------------------------------------------
 * POST /api/leads — captura pública (newsletter, portal, chat, etc)
 * Nunca pierde datos. Si source falta, se usa "other" y se marca en tag.
 * ------------------------------------------------------------------ */
router.post("/", async (req, res, next) => {
  try {
    const {
      source = "other", channel, email, phone,
      firstName, lastName, name, city,
      utmSource, utmMedium, utmCampaign, utmContent,
      referrer, landingPath, metadata,
    } = req.body || {};

    if (!email && !phone) {
      return res.status(400).json({ message: "Requerimos email o teléfono" });
    }

    // Permite que el frontend mande "name" y lo parteamos
    let fn_ = firstName, ln_ = lastName;
    if (!fn_ && name) {
      const parts = String(name).trim().split(/\s+/);
      fn_ = parts[0];
      ln_ = parts.slice(1).join(" ") || null;
    }

    const lead = await captureLead({
      source, channel, email, phone,
      firstName: fn_, lastName: ln_, city,
      utmSource, utmMedium, utmCampaign, utmContent,
      referrer, landingPath,
      metadata: metadata || {},
    });

    res.status(201).json({ ok: true, leadId: lead.id });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------
 * GET /api/leads — listado admin con filtros + paginación
 * ?source=&channel=&status=&q=&from=&to=&limit=&offset=
 * ------------------------------------------------------------------ */
router.get("/", requireAuth, requireRoles("admin", "manager"), async (req, res, next) => {
  try {
    const {
      source, channel, status, q,
      from, to,
      limit = 50, offset = 0,
    } = req.query;

    const where = {};
    if (source)  where.source  = source;
    if (channel) where.channel = channel;
    if (status)  where.status  = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to)   where.createdAt[Op.lte] = new Date(to);
    }
    if (q) {
      where[Op.or] = [
        { email:     { [Op.like]: `%${q}%` } },
        { phone:     { [Op.like]: `%${q}%` } },
        { firstName: { [Op.like]: `%${q}%` } },
        { lastName:  { [Op.like]: `%${q}%` } },
      ];
    }

    const { rows, count } = await Lead.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit:  Math.min(Number(limit) || 50, 500),
      offset: Number(offset) || 0,
    });

    res.json({ leads: rows, total: count });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------
 * GET /api/leads/stats — conteo por source/channel/status
 * ------------------------------------------------------------------ */
router.get("/stats", requireAuth, requireRoles("admin", "manager"), async (_req, res, next) => {
  try {
    const [bySource, byChannel, byStatus] = await Promise.all([
      Lead.findAll({ attributes: ["source",  [fn("COUNT", col("id")), "count"]], group: ["source"]  }),
      Lead.findAll({ attributes: ["channel", [fn("COUNT", col("id")), "count"]], group: ["channel"] }),
      Lead.findAll({ attributes: ["status",  [fn("COUNT", col("id")), "count"]], group: ["status"]  }),
    ]);
    const total = await Lead.count();
    const customers = await Lead.count({ where: { status: "customer" } });
    res.json({ total, customers, bySource, byChannel, byStatus });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------
 * GET /api/leads/export.csv — descarga CSV del filtro actual
 * ------------------------------------------------------------------ */
router.get("/export.csv", requireAuth, requireRoles("admin", "manager"), async (req, res, next) => {
  try {
    const { source, channel, status } = req.query;
    const where = {};
    if (source)  where.source  = source;
    if (channel) where.channel = channel;
    if (status)  where.status  = status;

    const rows = await Lead.findAll({ where, order: [["createdAt", "DESC"]] });
    const header = [
      "id","email","phone","firstName","lastName","city",
      "source","channel","status","hasPurchased","totalPurchaseCents",
      "utmSource","utmMedium","utmCampaign","landingPath","createdAt"
    ];
    const esc = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    };
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(header.map((h) => esc(r[h])).join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="leads-${Date.now()}.csv"`);
    res.send(lines.join("\n"));
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------
 * POST /api/leads/import — carga masiva (recuperar contactos perdidos)
 * Body: { leads: [{email, phone, firstName, lastName, source, channel, metadata}, ...] }
 * ------------------------------------------------------------------ */
router.post("/import", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const { leads = [] } = req.body;
    if (!Array.isArray(leads) || !leads.length) {
      return res.status(400).json({ message: "leads[] vacío" });
    }
    const results = { created: 0, merged: 0, errors: [] };
    for (const raw of leads) {
      try {
        const data = {
          source: raw.source || "import-manual",
          channel: raw.channel || "mindsetbuilder",
          ...raw,
        };
        await captureLead(data, "captured");
        results.created++;
      } catch (e) {
        results.errors.push({ input: raw, error: e.message });
      }
    }
    res.json(results);
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------
 * GET /api/leads/:id — detalle con actividades
 * ------------------------------------------------------------------ */
router.get("/:id", requireAuth, requireRoles("admin", "manager"), async (req, res, next) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [{ model: LeadActivity, as: "activities" }],
    });
    if (!lead) return res.status(404).json({ message: "Lead no encontrado" });
    res.json({ lead });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------
 * PATCH /api/leads/:id — actualizar status, tags, notas
 * ------------------------------------------------------------------ */
router.patch("/:id", requireAuth, requireRoles("admin", "manager"), async (req, res, next) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead no encontrado" });

    const before = { status: lead.status, tags: lead.tags };
    const { status, tags, notes } = req.body;
    await lead.update({
      status: status ?? lead.status,
      tags:   tags   ?? lead.tags,
      notes:  notes  ?? lead.notes,
    });
    if (status && status !== before.status) {
      await LeadActivity.create({
        leadId: lead.id,
        type: "status_change",
        metadata: { from: before.status, to: status },
        createdById: req.user.id,
      });
    }
    res.json({ lead });
  } catch (err) { next(err); }
});

export default router;
