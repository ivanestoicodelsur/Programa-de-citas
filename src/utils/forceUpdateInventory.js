import "../config/env.js";
import { connectSql } from "../config/sql.js";
import { InventoryItem, User, initSqlModels } from "../models/sqlModels.js";
import { buildSeedInventoryItems } from "../data/inventoryCatalog.js";
import { setSqlMode } from "../config/runtime.js";

async function forceUpdateInventory() {
  console.log("Starting forced inventory update...");
  
  try {
    const sequelize = await connectSql();
    setSqlMode("sql");
    console.log("Connected to SQL database.");

    // Encontrar al admin para asignarle los items
    const admin = await User.findOne({ where: { role: "admin" } });
    if (!admin) {
      console.error("No se encontró usuario administrador para asignar el inventario.");
      process.exit(1);
    }

    console.log(`Borrando inventario antiguo para re-sembrar...`);
    await InventoryItem.destroy({ where: {}, truncate: false }); // Truncate might fail on some SQLite versions due to foreign keys, destroy {} is safer

    const newItems = buildSeedInventoryItems({ 
      adminId: admin.id, 
      scopeKey: admin.scopeKey || "central" 
    });

    console.log(`Insertando ${newItems.length} nuevos items de inventario...`);
    await InventoryItem.bulkCreate(newItems);

    console.log("¡Actualización de inventario completada con éxito!");
    process.exit(0);
  } catch (error) {
    console.error("Error actualizando el inventario:", error);
    process.exit(1);
  }
}

forceUpdateInventory();
