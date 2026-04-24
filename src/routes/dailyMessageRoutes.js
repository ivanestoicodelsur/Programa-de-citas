import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  DailyMessage,
  UserDailyProgress,
  Purchase,
  Lead,
  LeadActivity,
} from "../models/sqlModels.js";
import { SYSTEM_PACK, findBook } from "../config/booksCatalog.js";

const router = express.Router();

/** Requiere que el usuario tenga el pack `sistema-completo` activo. */
async function requirePackAccess(req, res, next) {
  try {
    const purchase = await Purchase.findOne({
      where: { userId: req.user.id, bookSlug: SYSTEM_PACK.slug, isActive: true },
    });
    if (!purchase && req.user.role !== "admin") {
      return res.status(403).json({ message: "Acceso bloqueado. Desbloquea el Sistema Completo." });
    }
    next();
  } catch (err) { next(err); }
}

/* ------------------------------------------------------------------
 * GET /api/daily-message/today
 * Devuelve el mensaje del día. Si el usuario nunca ha leído, empieza
 * en día 1. Si ya leyó hoy, devuelve el mismo. Si es otro día natural,
 * avanza uno y devuelve el siguiente.
 * ------------------------------------------------------------------ */
router.get("/today", requireAuth, requirePackAccess, async (req, res, next) => {
  try {
    const [progress] = await UserDailyProgress.findOrCreate({
      where: { userId: req.user.id },
      defaults: { currentDay: 1 },
    });

    const today = new Date();
    const todayDate = today.toISOString().slice(0, 10);
    const lastDate = progress.lastReadAt ? new Date(progress.lastReadAt).toISOString().slice(0, 10) : null;

    let dayToReturn = progress.currentDay;

    if (lastDate && lastDate !== todayDate) {
      // Día nuevo — avanza uno
      dayToReturn = progress.currentDay + 1;
    }

    const totalMessages = await DailyMessage.count();
    if (totalMessages === 0) {
      return res.status(503).json({ message: "Los mensajes diarios aún no están cargados. Admin debe correr seedDailyMessages." });
    }

    // Ciclar si supera el total (la secuencia vuelve a empezar).
    const normalizedDay = ((dayToReturn - 1) % totalMessages) + 1;
    const message = await DailyMessage.findOne({ where: { dayNumber: normalizedDay } });

    if (!message) {
      return res.status(404).json({ message: "Mensaje no encontrado para día " + normalizedDay });
    }

    // Actualizar progreso solo si el día cambió — no re-registrar en cada refresh.
    if (lastDate !== todayDate) {
      const wasStreak = lastDate && isYesterday(lastDate, todayDate);
      await progress.update({
        currentDay: dayToReturn,
        lastReadAt: today,
        lastReadDay: normalizedDay,
        streakDays: wasStreak ? progress.streakDays + 1 : 1,
      });

      // Registrar en actividad de Lead (si existe lead vinculado por email)
      try {
        const lead = await Lead.findOne({ where: { email: req.user.email } });
        if (lead) {
          await LeadActivity.create({
            leadId: lead.id,
            type: "download",
            source: "daily-message",
            metadata: { dayNumber: normalizedDay, bookSlug: message.bookSlug },
          });
        }
      } catch (_) { /* noop */ }
    }

    const book = findBook(message.bookSlug);
    res.json({
      day: dayToReturn,
      dayNumber: message.dayNumber,
      totalDays: totalMessages,
      streak: progress.streakDays,
      startedAt: progress.startedAt,
      book: book ? { slug: book.slug, title: book.title, cover: book.cover } : null,
      message: {
        id: message.id,
        title: message.title,
        body: message.body,
        wordCount: message.wordCount,
      },
    });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------
 * GET /api/daily-message/progress
 * Solo el progreso del usuario (para mostrar streak/barra).
 * ------------------------------------------------------------------ */
router.get("/progress", requireAuth, async (req, res, next) => {
  try {
    const progress = await UserDailyProgress.findOne({ where: { userId: req.user.id } });
    const total = await DailyMessage.count();
    res.json({
      currentDay: progress?.currentDay || 0,
      totalDays: total,
      streakDays: progress?.streakDays || 0,
      lastReadAt: progress?.lastReadAt || null,
      startedAt: progress?.startedAt || null,
      emailOptIn: progress ? progress.emailOptIn : true,
    });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------
 * PATCH /api/daily-message/preferences
 * Toggle de emailOptIn (el n8n worker respeta esta bandera).
 * ------------------------------------------------------------------ */
router.patch("/preferences", requireAuth, async (req, res, next) => {
  try {
    const [progress] = await UserDailyProgress.findOrCreate({
      where: { userId: req.user.id },
      defaults: { currentDay: 1 },
    });
    const { emailOptIn } = req.body;
    if (typeof emailOptIn === "boolean") {
      await progress.update({ emailOptIn });
    }
    res.json({ emailOptIn: progress.emailOptIn });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------
 * Admin-only helpers para n8n / inspección manual.
 * GET /api/daily-message/all?limit=10
 * ------------------------------------------------------------------ */
router.get("/all", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Solo admin" });
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const rows = await DailyMessage.findAll({ order: [["dayNumber", "ASC"]], limit });
    res.json({ messages: rows, total: await DailyMessage.count() });
  } catch (err) { next(err); }
});

function isYesterday(lastDate, todayDate) {
  const d1 = new Date(lastDate);
  const d2 = new Date(todayDate);
  const diff = (d2 - d1) / (1000 * 60 * 60 * 24);
  return diff >= 0.5 && diff <= 1.5;
}

export default router;
