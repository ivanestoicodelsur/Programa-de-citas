import { z } from "zod";
import { createAuditLog } from "../services/auditService.js";
import { syncInventoryFromGoogleSheets } from "../services/googleSheetsService.js";

export const syncSheetsSchema = z.object({
  body: z.object({
    scopeKey: z.string().optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

export async function getSheetsStatus(req, res) {
  const hasApiKey = Boolean(process.env.GOOGLE_SHEETS_API_KEY?.trim());
  const hasServiceAccount = Boolean(
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim() &&
    process.env.GOOGLE_SHEETS_PRIVATE_KEY?.trim()
  );
  const configured = hasApiKey || hasServiceAccount;

  // Parse multi-sheet IDs
  const multi = process.env.GOOGLE_SHEETS_SPREADSHEET_IDS?.trim();
  const single = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const ids = multi
    ? multi.split(",").map(s => s.trim()).filter(Boolean)
    : single ? [single] : [];

  const labels = (process.env.GOOGLE_SHEETS_LABELS || "")
    .split(",").map(s => s.trim());

  const spreadsheets = ids.map((id, i) => ({
    id,
    label: labels[i] || `Hoja ${i + 1}`,
    url: `https://docs.google.com/spreadsheets/d/${id}`,
  }));

  res.json({
    configured,
    method: hasApiKey ? "api_key" : hasServiceAccount ? "service_account" : null,
    spreadsheets,
    spreadsheetCount: spreadsheets.length,
    // backward compat
    spreadsheetId: ids[0] || null,
    sheetUrl: ids[0] ? `https://docs.google.com/spreadsheets/d/${ids[0]}` : null,
  });
}

export async function syncGoogleSheets(req, res, next) {
  try {
    const scopeKey = req.body.scopeKey || req.user.scopeKey;
    const result = await syncInventoryFromGoogleSheets(scopeKey, req.user.id);

    await createAuditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: "sync",
      entityType: "google-sheets",
      entityId: scopeKey,
      metadata: result,
    });

    res.json({ message: "Google Sheets synced", result });
  } catch (error) {
    next(error);
  }
}
