import { google } from "googleapis";

/* ─── AUTH HELPER ─── */
function getAuth() {
  const clientEmail = process.env.GOOGLE_WORKSPACE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_WORKSPACE_PRIVATE_KEY?.trim()?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) return null;

  return new google.auth.JWT(clientEmail, null, privateKey, [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
}

/* ─── STATUS ─── */
export function getWorkspaceStatus() {
  const auth = getAuth();
  return {
    configured: Boolean(auth),
    services: {
      gmail: Boolean(auth),
      drive: Boolean(auth),
      sheets: Boolean(process.env.GOOGLE_SHEETS_API_KEY || auth),
    },
  };
}

/* ─── GMAIL: SEND EMAIL ─── */
export async function sendEmail({ to, subject, body, html }) {
  const auth = getAuth();
  if (!auth) throw new Error("Google Workspace not configured. Set GOOGLE_WORKSPACE_CLIENT_EMAIL and GOOGLE_WORKSPACE_PRIVATE_KEY.");

  const gmail = google.gmail({ version: "v1", auth });

  const senderEmail = process.env.GOOGLE_WORKSPACE_SENDER_EMAIL || process.env.GOOGLE_WORKSPACE_CLIENT_EMAIL;

  const messageParts = [
    `From: ${senderEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: ${html ? "text/html" : "text/plain"}; charset=utf-8`,
    "",
    html || body,
  ];

  const raw = Buffer.from(messageParts.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return { messageId: result.data.id, threadId: result.data.threadId };
}

/* ─── DRIVE: LIST FILES ─── */
export async function listDriveFiles({ query, pageSize = 20, pageToken }) {
  const auth = getAuth();
  if (!auth) throw new Error("Google Workspace not configured.");

  const drive = google.drive({ version: "v3", auth });

  const params = {
    pageSize,
    fields: "nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)",
  };
  if (query) params.q = query;
  if (pageToken) params.pageToken = pageToken;

  const res = await drive.files.list(params);
  return { files: res.data.files || [], nextPageToken: res.data.nextPageToken || null };
}

/* ─── DRIVE: GET FILE ─── */
export async function getDriveFile(fileId) {
  const auth = getAuth();
  if (!auth) throw new Error("Google Workspace not configured.");

  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink",
  });
  return res.data;
}

/* ─── DRIVE: DOWNLOAD FILE ─── */
export async function downloadDriveFile(fileId) {
  const auth = getAuth();
  if (!auth) throw new Error("Google Workspace not configured.");

  const drive = google.drive({ version: "v3", auth });
  const meta = await drive.files.get({ fileId, fields: "name, mimeType" });
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });

  return { stream: res.data, name: meta.data.name, mimeType: meta.data.mimeType };
}
