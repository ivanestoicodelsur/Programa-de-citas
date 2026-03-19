import { Router } from "express";
import { syncGoogleSheets, syncSheetsSchema, getSheetsStatus } from "../controllers/googleSheetsController.js";
import { requireAuth, requireRoles } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

const router = Router();

router.get("/status", requireAuth, getSheetsStatus);
router.post("/sync", requireAuth, requireRoles("admin", "manager"), validate(syncSheetsSchema), syncGoogleSheets);

export default router;
