import { z } from "zod";
import { createAuditLog } from "../services/auditService.js";
import {
  getWorkspaceStatus,
  sendEmail,
  listDriveFiles,
  getDriveFile,
  downloadDriveFile,
} from "../services/googleWorkspaceService.js";

/* ─── SCHEMAS ─── */

export const sendEmailSchema = z.object({
  body: z.object({
    to: z.string().email(),
    subject: z.string().min(1).max(500),
    body: z.string().optional(),
    html: z.string().optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

export const listFilesSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    q: z.string().optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    pageToken: z.string().optional(),
  }).default({}),
});

export const fileIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({ fileId: z.string().min(1) }),
  query: z.object({}).default({}),
});

/* ─── HANDLERS ─── */

export async function getStatus(req, res) {
  const status = getWorkspaceStatus();
  res.json(status);
}

export async function handleSendEmail(req, res, next) {
  try {
    const result = await sendEmail(req.body);

    await createAuditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: "send_email",
      entityType: "google-workspace",
      entityId: req.body.to,
      metadata: { subject: req.body.subject, messageId: result.messageId },
    });

    res.json({ message: "Email enviado", ...result });
  } catch (error) {
    next(error);
  }
}

export async function handleListFiles(req, res, next) {
  try {
    const result = await listDriveFiles(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetFile(req, res, next) {
  try {
    const file = await getDriveFile(req.params.fileId);
    res.json(file);
  } catch (error) {
    next(error);
  }
}

export async function handleDownloadFile(req, res, next) {
  try {
    const { stream, name, mimeType } = await downloadDriveFile(req.params.fileId);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
    res.setHeader("Content-Type", mimeType);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}
