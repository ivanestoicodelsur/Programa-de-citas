import { Router } from "express";
import {
  getStatus,
  handleSendEmail,
  sendEmailSchema,
  handleListFiles,
  listFilesSchema,
  handleGetFile,
  fileIdSchema,
  handleDownloadFile,
} from "../controllers/googleWorkspaceController.js";
import { requireAuth, requireRoles } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

const router = Router();

// Status
router.get("/status", requireAuth, getStatus);

// Gmail
router.post("/gmail/send", requireAuth, requireRoles("admin", "manager"), validate(sendEmailSchema), handleSendEmail);

// Drive
router.get("/drive/files", requireAuth, validate(listFilesSchema), handleListFiles);
router.get("/drive/files/:fileId", requireAuth, validate(fileIdSchema), handleGetFile);
router.get("/drive/files/:fileId/download", requireAuth, requireRoles("admin", "manager"), validate(fileIdSchema), handleDownloadFile);

export default router;
