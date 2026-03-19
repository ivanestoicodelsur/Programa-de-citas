import { AuditLog } from "../models/AuditLog.js";
import { getMongoMode } from "../config/runtime.js";
import { createAuditLog as createMemoryAuditLog } from "./memoryStore.js";

export async function createAuditLog(entry) {
  if (getMongoMode() === "mongo") {
    try {
      await AuditLog.create(entry);
      return;
    } catch {
      // fall back silently in demo mode
    }
  }

  await createMemoryAuditLog(entry);
}
