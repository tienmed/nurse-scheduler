import { google } from "googleapis";

const requiredEnv = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Thiếu biến môi trường bắt buộc: ${key}`);
  }
}

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");

const sheetDefinitions = [
  { title: "staff", headers: ["id", "name", "code", "team", "active", "notes"] },
  { title: "positions", headers: ["id", "name", "area", "description"] },
  { title: "schedule_rules", headers: ["id", "dayOfWeek", "shift", "active", "label"] },
  {
    title: "template_schedule",
    headers: ["id", "dayOfWeek", "shift", "positionId", "staffId", "note"],
  },
  {
    title: "weekly_schedule",
    headers: ["id", "weekStart", "date", "shift", "positionId", "staffId", "source", "status", "note"],
  },
  {
    title: "leave_requests",
    headers: ["id", "staffId", "date", "shift", "reason", "note"],
  },
  {
    title: "access_control",
    headers: ["id", "email", "role", "displayName"],
  },
];

const auth = new google.auth.JWT({
  email,
  key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

async function main() {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set(
    (spreadsheet.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter(Boolean),
  );

  const requests = sheetDefinitions
    .filter((definition) => !existingTitles.has(definition.title))
    .map((definition) => ({
      addSheet: {
        properties: {
          title: definition.title,
        },
      },
    }));

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }

  await Promise.all(
    sheetDefinitions.map((definition) =>
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${definition.title}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [definition.headers],
        },
      }),
    ),
  );

  console.log("Google Sheet đã sẵn sàng với đầy đủ tab và header.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
