import express from "express";
import { requireAuth, requireRoles } from "../middlewares/auth.js";
import { sequelize } from "../config/sql.js";

const router = express.Router();

router.get("/health", requireAuth, requireRoles("admin", "manager"), async (_req, res) => {
  let dbStatus = "unknown";
  try {
    await sequelize.authenticate();
    dbStatus = "connected";
  } catch {
    dbStatus = "error";
  }
  res.json({
    ok: true,
    uptime: process.uptime(),
    db: { sqlite: dbStatus, mongo: "memory" },
    ts: Date.now(),
  });
});

export default router;
