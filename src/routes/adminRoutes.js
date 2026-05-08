import express from "express";
import { sequelize } from "../config/sql.js";

const router = express.Router();

// Public — no auth required so external monitoring and the admin banner can reach it.
router.get("/health", async (_req, res) => {
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
