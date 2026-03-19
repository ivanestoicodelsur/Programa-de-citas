import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { Op } from "sequelize";
import { buildSeedInventoryItems } from "../data/inventoryCatalog.js";
import { getSqlMode } from "../config/runtime.js";
import { Document, InventoryItem, User } from "../models/sqlModels.js";

const memory = {
  users: [],
  inventory: [],
  documents: [],
  auditLogs: [],
};

export async function findUserById(id, options = {}) {
  if (getSqlMode() === "sql") {
    return User.findByPk(id, options);
  }

  const user = memory.users.find((item) => item.id === id);
  return user ? sanitizeUser(user, options.includePassword) : null;
}

export async function findUserByEmail(email, options = {}) {
  if (getSqlMode() === "sql") {
    if (options.includePassword) {
      return User.scope("withPassword").findOne({ where: { email } });
    }
    return User.findOne({ where: { email } });
  }

  const user = memory.users.find((item) => item.email === email);
  return user ? sanitizeUser(user, options.includePassword) : null;
}

export async function listUsersForRequester(requester) {
  if (getSqlMode() === "sql") {
    const where = requester.role === "admin" ? {} : { scopeKey: requester.scopeKey };
    return User.findAll({ where, order: [["name", "ASC"]] });
  }

  return memory.users
    .filter((user) => requester.role === "admin" || user.scopeKey === requester.scopeKey)
    .map((user) => sanitizeUser(user))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function createUser(data) {
  if (getSqlMode() === "sql") {
    return User.create(data);
  }

  const user = {
    id: randomUUID(),
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash.startsWith("$2") ? data.passwordHash : await bcrypt.hash(data.passwordHash, 10),
    role: data.role || "viewer",
    scopeKey: data.scopeKey || "default",
    isActive: data.isActive ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  memory.users.push(user);
  return sanitizeUser(user);
}

export async function listInventoryForUser(user, query = {}) {
  if (getSqlMode() === "sql") {
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

    if (user.role === "manager") {
      filters.push({
        [Op.or]: [
          { visibilityScope: user.scopeKey },
          { assignedUserId: user.id },
          { createdById: user.id },
        ],
      });
    }

    if (user.role !== "admin" && user.role !== "manager") {
      filters.push({
        [Op.or]: [{ assignedUserId: user.id }, { createdById: user.id }],
      });
    }

    return InventoryItem.findAll({
      where: filters.length ? { [Op.and]: filters } : {},
      include: [
        { model: User, as: "assignedUser", attributes: ["id", "name", "email", "role"] },
        { model: User, as: "createdBy", attributes: ["id", "name", "email", "role"] },
      ],
      order: [["updatedAt", "DESC"]],
    });
  }

  return memory.inventory
    .filter((item) => matchesInventoryAccess(item, user))
    .filter((item) => matchesInventoryQuery(item, query))
    .map(enrichInventory)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function findInventoryById(id) {
  if (getSqlMode() === "sql") {
    return InventoryItem.findByPk(id, {
      include: [
        { model: User, as: "assignedUser", attributes: ["id", "name", "email", "role"] },
        { model: User, as: "createdBy", attributes: ["id", "name", "email", "role"] },
      ],
    });
  }

  const item = memory.inventory.find((entry) => entry.id === id);
  return item ? enrichInventory(item) : null;
}

/** Fast exact-code lookup — used by Google Sheets sync */
export async function findInventoryByCode(code) {
  if (getSqlMode() === "sql") {
    return InventoryItem.findOne({ where: { code } });
  }
  return memory.inventory.find((entry) => entry.code === code) || null;
}

/** Return a Map<code, id> for all existing inventory — used for bulk sync */
export async function getInventoryCodeMap() {
  if (getSqlMode() === "sql") {
    const rows = await InventoryItem.findAll({ attributes: ["id", "code"] });
    return new Map(rows.map((r) => [r.code, r.id]));
  }
  return new Map(memory.inventory.map((r) => [r.code, r.id]));
}

export async function createInventory(data) {
  if (getSqlMode() === "sql") {
    return InventoryItem.create(data);
  }

  const item = {
    id: randomUUID(),
    description: "",
    metadata: {},
    assignedUserId: null,
    status: "active",
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  memory.inventory.push(item);
  return enrichInventory(item);
}

export async function updateInventory(id, data) {
  if (getSqlMode() === "sql") {
    const item = await InventoryItem.findByPk(id);
    if (!item) {
      return null;
    }
    await item.update(data);
    return item;
  }

  const item = memory.inventory.find((entry) => entry.id === id);
  if (!item) {
    return null;
  }
  Object.assign(item, data, { updatedAt: new Date().toISOString() });
  return enrichInventory(item);
}

export async function deleteInventory(id) {
  if (getSqlMode() === "sql") {
    const item = await InventoryItem.findByPk(id);
    if (!item) {
      return null;
    }
    await item.destroy();
    return item;
  }

  const index = memory.inventory.findIndex((entry) => entry.id === id);
  if (index < 0) {
    return null;
  }
  const [item] = memory.inventory.splice(index, 1);
  return enrichInventory(item);
}

export async function listDocumentsForUser(user, query = {}) {
  if (getSqlMode() === "sql") {
    const filters = [];

    if (query.q) {
      filters.push({
        [Op.or]: [
          { title: { [Op.like]: `%${query.q}%` } },
          { summary: { [Op.like]: `%${query.q}%` } },
          { content: { [Op.like]: `%${query.q}%` } },
        ],
      });
    }

    if (query.visibility) {
      filters.push({ visibility: query.visibility });
    }

    if (query.mine) {
      filters.push({ createdById: user.id });
    } else {
      filters.push({ [Op.or]: [{ visibility: "public" }, { createdById: user.id }] });
    }

    return Document.findAll({
      where: filters.length ? { [Op.and]: filters } : {},
      include: [{ model: User, as: "createdBy", attributes: ["id", "name", "email"] }],
      order: [["updatedAt", "DESC"]],
    });
  }

  return memory.documents
    .filter((item) => matchesDocumentAccess(item, user))
    .filter((item) => matchesDocumentQuery(item, query, user))
    .map(enrichDocument)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function findDocumentById(id) {
  if (getSqlMode() === "sql") {
    return Document.findByPk(id, {
      include: [{ model: User, as: "createdBy", attributes: ["id", "name", "email"] }],
    });
  }

  const item = memory.documents.find((entry) => entry.id === id);
  return item ? enrichDocument(item) : null;
}

export async function createDocument(data) {
  if (getSqlMode() === "sql") {
    return Document.create(data);
  }

  const item = {
    id: randomUUID(),
    summary: "",
    content: "",
    imageUrls: [],
    visibility: "private",
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  memory.documents.push(item);
  return enrichDocument(item);
}

export async function updateDocument(id, data) {
  if (getSqlMode() === "sql") {
    const item = await Document.findByPk(id);
    if (!item) {
      return null;
    }
    await item.update(data);
    return item;
  }

  const item = memory.documents.find((entry) => entry.id === id);
  if (!item) {
    return null;
  }
  Object.assign(item, data, { updatedAt: new Date().toISOString() });
  return enrichDocument(item);
}

export async function deleteDocument(id) {
  if (getSqlMode() === "sql") {
    const item = await Document.findByPk(id);
    if (!item) {
      return null;
    }
    await item.destroy();
    return item;
  }

  const index = memory.documents.findIndex((entry) => entry.id === id);
  if (index < 0) {
    return null;
  }
  const [item] = memory.documents.splice(index, 1);
  return enrichDocument(item);
}

export async function createAuditLog(data) {
  memory.auditLogs.push({ id: randomUUID(), ...data, createdAt: new Date().toISOString() });
}

export async function seedMemoryData({ admin }) {
  if (getSqlMode() === "sql") {
    return;
  }

  if (!memory.inventory.length) {
    const timestamp = new Date().toISOString();
    memory.inventory.push(
      ...buildSeedInventoryItems({ adminId: admin.id, scopeKey: admin.scopeKey }).map((item) => ({
        id: randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...item,
      }))
    );
  }

  if (!memory.documents.length) {
    memory.documents.push(
      {
        id: randomUUID(),
        title: "Manual operativo del taller",
        summary: "Documento público de ejemplo para el equipo.",
        content: "Bienvenido al panel colaborativo.\n\nAquí puedes documentar procesos, repuestos y políticas del taller.",
        imageUrls: [],
        visibility: "public",
        createdById: admin.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        title: "Notas privadas del administrador",
        summary: "Solo visible para el creador.",
        content: "Este es un documento privado de demostración.",
        imageUrls: [],
        visibility: "private",
        createdById: admin.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }
}

function sanitizeUser(user, includePassword = false) {
  if (!user) {
    return null;
  }
  const payload = { ...user };
  if (!includePassword) {
    delete payload.passwordHash;
  }
  return payload;
}

function enrichInventory(item) {
  return {
    ...item,
    createdBy: sanitizeUser(memory.users.find((user) => user.id === item.createdById)),
    assignedUser: sanitizeUser(memory.users.find((user) => user.id === item.assignedUserId)),
  };
}

function enrichDocument(item) {
  return {
    ...item,
    createdBy: sanitizeUser(memory.users.find((user) => user.id === item.createdById)),
  };
}

function matchesInventoryAccess(item, user) {
  if (user.role === "admin") {
    return true;
  }
  if (user.role === "manager") {
    return item.visibilityScope === user.scopeKey || item.assignedUserId === user.id || item.createdById === user.id;
  }
  return item.assignedUserId === user.id || item.createdById === user.id;
}

function matchesInventoryQuery(item, query) {
  const text = `${item.name} ${item.code} ${item.category} ${item.repairType}`.toLowerCase();
  if (query.q && !text.includes(query.q.toLowerCase())) {
    return false;
  }
  if (query.status && item.status !== query.status) {
    return false;
  }
  if (query.category && item.category !== query.category) {
    return false;
  }
  if (query.assignedUserId && item.assignedUserId !== query.assignedUserId) {
    return false;
  }
  return true;
}

function matchesDocumentAccess(item, user) {
  return item.visibility === "public" || item.createdById === user.id;
}

function matchesDocumentQuery(item, query, user) {
  const text = `${item.title} ${item.summary} ${item.content}`.toLowerCase();
  if (query.q && !text.includes(query.q.toLowerCase())) {
    return false;
  }
  if (query.visibility && item.visibility !== query.visibility) {
    return false;
  }
  if (query.mine && item.createdById !== user.id) {
    return false;
  }
  return true;
}
