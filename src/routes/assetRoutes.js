import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth as authenticate } from "../middlewares/auth.js";
import { Asset } from "../models/sqlModels.js";
import { Op } from "sequelize";

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "../../public/uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /image\/(jpeg|jpg|png|gif|webp|svg\+xml)|video\/(mp4|webm|mov|avi)|application\/pdf|text\/.*/;
    cb(null, allowed.test(file.mimetype));
  },
});

function mimeToType(mime = "") {
  if (mime.startsWith("image/"))  return "image";
  if (mime.startsWith("video/"))  return "video";
  if (mime.startsWith("text/"))   return "text";
  return "other";
}

/* POST /api/assets/upload — upload a file */
router.post("/upload", authenticate, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file received." });

    const host = `${req.protocol}://${req.get("host")}`;
    const url  = `${host}/uploads/${req.file.filename}`;

    const asset = await Asset.create({
      title:       req.body.title || req.file.originalname,
      type:        mimeToType(req.file.mimetype),
      url,
      mimeType:    req.file.mimetype,
      fileSize:    req.file.size,
      tags:        req.body.tags ? JSON.parse(req.body.tags) : [],
      landingPage: req.body.landingPage || null,
      isPublic:    req.body.isPublic === "true",
      createdById: req.user.id,
    });

    res.status(201).json({ asset });
  } catch (err) { next(err); }
});

/* POST /api/assets — create text / script / URL asset */
router.post("/", authenticate, async (req, res, next) => {
  try {
    const { title, type = "text", url, content, tags = [], landingPage, isPublic = false } = req.body;
    if (!title) return res.status(400).json({ message: "title is required." });

    const asset = await Asset.create({
      title, type, url: url || null, content: content || null,
      tags, landingPage: landingPage || null,
      isPublic, createdById: req.user.id,
    });
    res.status(201).json({ asset });
  } catch (err) { next(err); }
});

/* GET /api/assets */
router.get("/", authenticate, async (req, res, next) => {
  try {
    const { type, landingPage, q } = req.query;
    const where = {};
    if (type)        where.type        = type;
    if (landingPage) where.landingPage = landingPage;
    if (q)           where.title       = { [Op.like]: `%${q}%` };

    const assets = await Asset.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });
    res.json({ assets });
  } catch (err) { next(err); }
});

/* GET /api/assets/:id */
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const asset = await Asset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ message: "Asset not found." });
    res.json({ asset });
  } catch (err) { next(err); }
});

/* PUT /api/assets/:id */
router.put("/:id", authenticate, async (req, res, next) => {
  try {
    const asset = await Asset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ message: "Asset not found." });
    const { title, type, url, content, tags, landingPage, isPublic } = req.body;
    await asset.update({ title, type, url, content, tags, landingPage, isPublic });
    res.json({ asset });
  } catch (err) { next(err); }
});

/* DELETE /api/assets/:id */
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const asset = await Asset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ message: "Asset not found." });
    await asset.destroy();
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
