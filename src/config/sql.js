import "./env.js";
import { fileURLToPath } from "url";
import path from "path";
import { Sequelize } from "sequelize";
import { initSqlModels } from "../models/sqlModels.js";

const dialect = process.env.SQL_DIALECT || "sqlite";

function buildSequelize() {
  if (dialect === "sqlite") {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const storagePath = process.env.SQL_STORAGE
      ? path.resolve(process.env.SQL_STORAGE)
      : path.join(__dirname, "../../data/repair.sqlite");

    return new Sequelize({
      dialect: "sqlite",
      storage: storagePath,
      logging: false,
    });
  }

  return new Sequelize(
    process.env.SQL_DATABASE || "repair_inventory",
    process.env.SQL_USER || "postgres",
    process.env.SQL_PASSWORD || "postgres",
    {
      host: process.env.SQL_HOST || "127.0.0.1",
      port: Number(process.env.SQL_PORT || 5432),
      dialect,
      logging: false,
    }
  );
}

export const sequelize = buildSequelize();

export async function connectSql() {
  initSqlModels(sequelize);
  await sequelize.authenticate();
  await sequelize.sync();
  console.log(`SQL connected (${dialect})`);
}
