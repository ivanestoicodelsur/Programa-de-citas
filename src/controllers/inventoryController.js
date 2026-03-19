import { Op } from "sequelize";
import { z } from "zod";
import { createAuditLog } from "../services/auditService.js";
import { createInventory, deleteInventory, findInventoryById, listInventoryForUser, updateInventory } from "../services/memoryStore.js";
import { ApiError } from "../utils/ApiError.js";

export const inventoryCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    code: z.string().min(2),
    description: z.string().optional().default(""),
    category: z.string().min(2),
    repairType: z.string().min(2),
    price: z.coerce.number().min(0),
    estimatedHours: z.coerce.number().int().min(1),
    stock: z.coerce.number().int().min(0),
    status: z.enum(["draft", "active", "archived"]).default("active"),
    visibilityScope: z.string().min(2),
    assignedUserId: z.string().uuid().nullable().optional(),
    metadata: z.record(z.any()).optional().default({}),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

export const inventoryUpdateSchema = z.object({
  body: inventoryCreateSchema.shape.body.partial(),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({}).default({}),
});

export const inventoryListSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    q: z.string().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    category: z.string().optional(),
    assignedUserId: z.string().uuid().optional(),
  }),
});

export const idParamSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({ id: z.string().uuid() }),
  query: z.object({}).default({}),
});

export async function listInventory(req, res, next) {
  try {
    const items = await listInventoryForUser(req.user, req.query);

    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function getInventoryItem(req, res, next) {
  try {
    const item = await findInventoryById(req.params.id);

    if (!item || !canAccessItem(req.user, item)) {
      throw new ApiError(404, "Inventory item not found");
    }

    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function createInventoryItem(req, res, next) {
  try {
    enforceScope(req.user, req.body.visibilityScope);

    const item = await createInventory({
      ...req.body,
      createdById: req.user.id,
    });

    await createAuditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: "create",
      entityType: "inventory",
      entityId: item.id,
      metadata: { code: item.code, scope: item.visibilityScope },
    });

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
}

export async function updateInventoryItem(req, res, next) {
  try {
    const item = await findInventoryById(req.params.id);
    if (!item || !canAccessItem(req.user, item)) {
      throw new ApiError(404, "Inventory item not found");
    }

    if (req.body.visibilityScope) {
      enforceScope(req.user, req.body.visibilityScope);
    }

    const updated = await updateInventory(req.params.id, req.body);

    await createAuditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: "update",
      entityType: "inventory",
      entityId: updated.id,
      metadata: { code: updated.code },
    });

    res.json({ item: updated });
  } catch (error) {
    next(error);
  }
}

export async function deleteInventoryItem(req, res, next) {
  try {
    const item = await findInventoryById(req.params.id);
    if (!item || !canAccessItem(req.user, item)) {
      throw new ApiError(404, "Inventory item not found");
    }

    await deleteInventory(req.params.id);

    await createAuditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: "delete",
      entityType: "inventory",
      entityId: req.params.id,
      metadata: { code: item.code },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export function buildAccessWhere(user, query) {
  const filters = [];

  if (query.q) {
    filters.push({
      [Op.or]: [
      { name: { [Op.like]: `%${query.q}%` } },
      { code: { [Op.like]: `%${query.q}%` } },
      { category: { [Op.like]: `%${query.q}%` } },
      { repairType: { [Op.like]: `%${query.q}%` } },
      ],
    });
  }

  if (query.status) {
    filters.push({ status: query.status });
  }

  if (query.category) {
    filters.push({ category: query.category });
  }

  if (query.assignedUserId) {
    filters.push({ assignedUserId: query.assignedUserId });
  }

  if (user.role === "admin") {
    return filters.length ? { [Op.and]: filters } : {};
  }

  if (user.role === "manager") {
    filters.push({
      [Op.or]: [
        { visibilityScope: user.scopeKey },
        { assignedUserId: user.id },
        { createdById: user.id },
      ],
    });

    return { [Op.and]: filters };
  }

  filters.push({
    [Op.or]: [
      { assignedUserId: user.id },
      { createdById: user.id },
    ],
  });

  return { [Op.and]: filters };
}

function canAccessItem(user, item) {
  if (user.role === "admin") {
    return true;
  }

  if (user.role === "manager") {
    return item.visibilityScope === user.scopeKey || item.createdById === user.id || item.assignedUserId === user.id;
  }

  return item.createdById === user.id || item.assignedUserId === user.id;
}

function enforceScope(user, scope) {
  if (user.role === "admin") {
    return;
  }

  if (scope !== user.scopeKey) {
    throw new ApiError(403, "You can only manage records inside your scope");
  }
}
