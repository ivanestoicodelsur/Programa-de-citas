import { google } from "googleapis";
import { createInventory, getInventoryCodeMap, updateInventory } from "./memoryStore.js";

/**
 * Returns an auth client.
 * Priority: API Key → Service Account JWT → error
 */
function getAuthClient() {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY?.trim();
  if (apiKey) {
    return { apiKey };
  }

  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (clientEmail && privateKey) {
    return {
      jwt: new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      }),
    };
  }

  throw new Error(
    "Google Sheets no configurado. Agrega GOOGLE_SHEETS_API_KEY en el archivo .env del backend."
  );
}

/**
 * Returns the list of spreadsheet IDs to sync.
 * Prefers GOOGLE_SHEETS_SPREADSHEET_IDS (comma-separated) over the single SPREADSHEET_ID.
 */
function getSpreadsheetIds() {
  const multi = process.env.GOOGLE_SHEETS_SPREADSHEET_IDS?.trim();
  if (multi) {
    return multi.split(",").map(id => id.trim()).filter(Boolean);
  }
  const single = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (single) return [single];
  throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID(S) is required in .env");
}

export async function syncInventoryFromGoogleSheets(defaultScope, actorId) {
  const authClient = getAuthClient();
  const sheetsAuth = authClient.jwt || undefined;
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
  const keyParam = authClient.apiKey ? { key: authClient.apiKey } : {};

  const spreadsheetIds = getSpreadsheetIds();
  const configuredRange = process.env.GOOGLE_SHEETS_RANGE?.trim();

  // Collect every matching entry from all spreadsheets and all price tabs
  const allEntries = [];
  let totalRows = 0;
  const sheetResults = [];

  for (const spreadsheetId of spreadsheetIds) {
    // Get tabs to sync: if configuredRange is set use that; otherwise only "price" tabs
    let ranges;
    if (configuredRange) {
      ranges = [configuredRange];
    } else {
      ranges = await resolvePriceRanges(sheets, spreadsheetId, keyParam);
    }

    let sheetRows = 0;
    for (const range of ranges) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        ...keyParam,
      });

      // Skip leading empty rows
      const rows = (response.data.values || []).filter(r => r && r.some(c => String(c ?? "").trim()));
      if (rows.length <= 1) continue;

      const [headerRow, ...dataRows] = rows;
      const headers = headerRow.map(normalizeHeader);
      sheetRows += dataRows.length;
      totalRows += dataRows.length;

      for (const row of dataRows) {
        const entry = mapSheetRowToInventory(headers, row, defaultScope, actorId);
        if (entry) allEntries.push(entry);
      }
    }

    sheetResults.push({ spreadsheetId, tabs: ranges.length, rows: sheetRows });
  }

  // Single DB round-trip to get all existing codes → Map<code, id>
  const codeMap = await getInventoryCodeMap();

  let imported = 0;
  let updated = 0;

  for (const entry of allEntries) {
    const existingId = codeMap.get(entry.code);
    if (existingId) {
      await updateInventory(existingId, entry);
      updated += 1;
    } else {
      try {
        const created = await createInventory({ ...entry, createdById: actorId });
        // Add to codeMap so later duplicate codes (from other sheets) update instead of re-inserting
        codeMap.set(entry.code, created.id);
        imported += 1;
      } catch (err) {
        // UniqueConstraint race: entry was inserted mid-sync or slug collision — try update
        if (err.name === "SequelizeUniqueConstraintError" || err.name === "SequelizeValidationError") {
          const fresh = await getInventoryCodeMap();
          const freshId = fresh.get(entry.code);
          if (freshId) {
            await updateInventory(freshId, entry);
            codeMap.set(entry.code, freshId);
            updated += 1;
          }
        } else {
          throw err;
        }
      }
    }
  }

  return { imported, updated, rows: totalRows, sheets: sheetResults };
}

/**
 * Returns only the tabs whose name contains "price" (case-insensitive).
 * This filters out catalog/list tabs that don't have repair price data.
 */
async function resolvePriceRanges(sheets, spreadsheetId, keyParam = {}) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
    ...keyParam,
  });

  const titles = (metadata.data.sheets || [])
    .map(s => s.properties?.title)
    .filter(Boolean)
    .filter(title => title.toLowerCase().includes("price"));

  if (!titles.length) {
    // Fallback: sync first tab if no "price" tab found
    const first = metadata.data.sheets?.[0]?.properties?.title;
    if (!first) throw new Error(`No tabs found in spreadsheet ${spreadsheetId}`);
    return [`'${first}'!A:Z`];
  }

  return titles.map(t => `'${t}'!A:Z`);
}

function mapSheetRowToInventory(headers, row, defaultScope, actorId) {
  const device = getCell(headers, row, ["device", "dispositivo"]);
  const part = getCell(headers, row, ["parte", "part"]);
  const quality = getCell(headers, row, ["calidad", "quality"]);
  const costPrice = parseNumber(getCell(headers, row, ["precio costo", "costo", "cost price"]));
  const salePrice = parseNumber(getCell(headers, row, ["precio venta", "venta", "sale price", "price"]));

  if (!device && !part) {
    return null;
  }

  const name = [device, part, quality].filter(Boolean).join(" · ");
  const code = slugify([device, part, quality].filter(Boolean).join("-"));

  if (!name || !code) {
    return null;
  }

  return {
    name,
    code,
    description: quality ? `Calidad: ${quality}` : "Importado desde Google Sheets",
    category: device || "General",
    repairType: part || "General",
    price: salePrice,
    estimatedHours: 1,
    stock: 0,
    status: "active",
    visibilityScope: defaultScope,
    googleSheetRowId: code,
    metadata: {
      source: "google-sheets",
      syncedBy: actorId,
      device,
      part,
      quality,
      costPrice,
      salePrice,
    },
  };
}

function getCell(headers, row, aliases) {
  const index = headers.findIndex((header) => aliases.includes(header));
  return index >= 0 ? String(row[index] || "").trim() : "";
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function parseNumber(value) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(/,(?=\d{1,2}$)/, ".")
    .replace(/,/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}