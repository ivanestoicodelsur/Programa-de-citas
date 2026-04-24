import "./config/env.js";
import { app } from "./app.js";
import { connectMongo } from "./config/mongo.js";
import { setMongoMode, setSqlMode } from "./config/runtime.js";
import { connectSql } from "./config/sql.js";
import { seedAdminUser } from "./utils/seedAdmin.js";
import { syncInventoryFromGoogleSheets } from "./services/googleSheetsService.js";

const port = Number(process.env.PORT || 4000);

async function bootstrap() {
  try {
    await connectMongo();
    setMongoMode("mongo");
  } catch (error) {
    setMongoMode("memory");
    console.warn("MongoDB unavailable, using in-memory audit mode");
  }

  try {
    await connectSql();
    setSqlMode("sql");
  } catch (error) {
    setSqlMode("memory");
    console.warn("SQL unavailable, using in-memory demo mode.", error.message);
  }

  await seedAdminUser();

  await new Promise((resolve, reject) => {
    const server = app.listen(port, resolve);
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is already in use. Free it and retry.`));
      } else {
        reject(err);
      }
    });
  });

  console.log(`API listening on http://localhost:${port}`);

  // Auto-sync Google Sheets inventory in the background (non-blocking)
  autoSyncGoogleSheets();
}

async function autoSyncGoogleSheets() {
  const hasApiKey = Boolean(process.env.GOOGLE_SHEETS_API_KEY?.trim());
  const hasServiceAccount = Boolean(
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim() &&
    process.env.GOOGLE_SHEETS_PRIVATE_KEY?.trim()
  );
  const hasSheets = Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_IDS?.trim() ||
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim()
  );

  if (!(hasApiKey || hasServiceAccount) || !hasSheets) {
    return;
  }

  try {
    const scope = process.env.SEED_ADMIN_SCOPE || "central";
    console.log("Google Sheets auto-sync starting...");
    const result = await syncInventoryFromGoogleSheets(scope, "system");
    console.log(
      `Google Sheets auto-sync complete: ${result.imported} imported, ${result.updated} updated, ${result.rows} rows from ${result.sheets.length} spreadsheets`
    );
  } catch (error) {
    console.error("Google Sheets auto-sync failed:", error.message);
  }
}

bootstrap().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
