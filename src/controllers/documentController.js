import { Op } from "sequelize";
import { z } from "zod";
import { createAuditLog } from "../services/auditService.js";
import {
  createDocument as createStoredDocument,
  deleteDocument as deleteStoredDocument,
  findDocumentById,
  listDocumentsForUser,
  updateDocument as persistDocumentUpdate,
} from "../services/memoryStore.js";
import { ApiError } from "../utils/ApiError.js";

const documentBody = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().max(240).optional().default(""),
  content: z.string().max(50000).optional().default(""),
  imageUrls: z.array(z.string().url()).optional().default([]),
  visibility: z.enum(["public", "private"]).default("private"),
});

export const listDocumentsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    q: z.string().optional(),
    visibility: z.enum(["public", "private"]).optional(),
    mine: z.coerce.boolean().optional(),
  }),
});

export const createDocumentSchema = z.object({
  body: documentBody,
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

export const updateDocumentSchema = z.object({
  body: documentBody.partial(),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({}).default({}),
});

export const documentIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({}).default({}),
});

export async function listDocuments(req, res, next) {
  try {
    const items = await listDocumentsForUser(req.user, req.query);

    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function getDocument(req, res, next) {
  try {
    const item = await findDocumentById(req.params.id);

    if (!item || !canAccessDocument(req.user, item)) {
      throw new ApiError(404, "Document not found");
    }

    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function createDocument(req, res, next) {
  try {
    const item = await createStoredDocument({
      ...req.body,
      createdById: req.user.id,
    });

    await createAuditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: "create",
      entityType: "document",
      entityId: item.id,
      metadata: { visibility: item.visibility, title: item.title },
    });

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
}

export async function updateDocument(req, res, next) {
  try {
    const item = await findDocumentById(req.params.id);
    if (!item || !canEditDocument(req.user, item)) {
      throw new ApiError(404, "Document not found or not editable");
    }

    const updated = await persistDocumentUpdate(req.params.id, req.body);

    await createAuditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: "update",
      entityType: "document",
      entityId: updated.id,
      metadata: { visibility: updated.visibility, title: updated.title },
    });

    res.json({ item: updated });
  } catch (error) {
    next(error);
  }
}

export async function deleteDocument(req, res, next) {
  try {
    const item = await findDocumentById(req.params.id);
    if (!item || item.createdById !== req.user.id) {
      throw new ApiError(404, "Document not found or not removable");
    }

    await deleteStoredDocument(req.params.id);

    await createAuditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: "delete",
      entityType: "document",
      entityId: req.params.id,
      metadata: { title: item.title },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

function canAccessDocument(user, item) {
  return item.visibility === "public" || item.createdById === user.id;
}

function canEditDocument(user, item) {
  return item.visibility === "public" || item.createdById === user.id;
}
