import { buildSeedInventoryItems } from "../data/inventoryCatalog.js";
import { getSqlMode } from "../config/runtime.js";
import { InventoryItem } from "../models/sqlModels.js";
import { createUser, findUserByEmail, seedMemoryData } from "../services/memoryStore.js";

export async function seedAdminUser() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    return;
  }

  const existingUser = await findUserByEmail(email, { includePassword: true });
  if (existingUser) {
    await seedSqlInventory(existingUser);
    await seedMemoryData({ admin: existingUser });
    return;
  }

  const admin = await createUser({
    name: process.env.SEED_ADMIN_NAME || "Administrador",
    email,
    passwordHash: password,
    role: "admin",
    scopeKey: process.env.SEED_ADMIN_SCOPE || "central",
  });

  await seedSqlInventory(admin);
  await seedMemoryData({ admin });

  console.log(`Seeded admin user: ${email}`);
}

async function seedSqlInventory(admin) {
  if (getSqlMode() !== "sql") {
    return;
  }

  const count = await InventoryItem.count();
  if (count > 0) {
    return;
  }

  await InventoryItem.bulkCreate(buildSeedInventoryItems({ adminId: admin.id, scopeKey: admin.scopeKey }));
  console.log("Seeded inventory catalog");
}
