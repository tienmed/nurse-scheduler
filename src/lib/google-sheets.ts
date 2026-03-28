import { google } from "googleapis";
import { SHEET_HEADERS, SHEET_NAMES } from "@/lib/constants";
import { env, getServiceAccountPrivateKey, isSheetsConfigured } from "@/lib/env";
import type { AppData } from "@/lib/types";

type SheetName = keyof typeof SHEET_NAMES;
type SheetRow = Record<string, string>;

function createSheetsClient() {
  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: getServiceAccountPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

async function readRows(sheetName: SheetName): Promise<SheetRow[]> {
  const sheets = createSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAMES[sheetName]}!A:Z`,
  });

  const values = response.data.values ?? [];
  if (values.length === 0) {
    return [];
  }

  const [headerRow, ...rows] = values;
  const headers = headerRow.map((value) => `${value}`.trim());

  return rows
    .filter((row) => row.some((cell) => `${cell}`.trim()))
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, `${row[index] ?? ""}`]),
      ),
    );
}

async function writeRows(sheetName: SheetName, rows: SheetRow[]) {
  const sheets = createSheetsClient();
  const headers = [...SHEET_HEADERS[sheetName]];
  const values = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? "")),
  ];

  await sheets.spreadsheets.values.clear({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAMES[sheetName]}!A:Z`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAMES[sheetName]}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

function asBoolean(value: string) {
  return value.toLowerCase() === "true";
}

export async function readAppDataFromSheets(): Promise<AppData> {
  if (!isSheetsConfigured()) {
    throw new Error("Google Sheets chưa được cấu hình.");
  }

  const [
    staffRows,
    positionRows,
    scheduleRuleRows,
    templateRows,
    weeklyRows,
    leaveRows,
    accessRows,
  ] = await Promise.all([
    readRows("staff"),
    readRows("positions"),
    readRows("scheduleRules"),
    readRows("templateSchedule"),
    readRows("weeklySchedule"),
    readRows("leaveRequests"),
    readRows("accessControl"),
  ]);

  return {
    staff: staffRows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      team: row.team,
      active: asBoolean(row.active || "true"),
      notes: row.notes,
    })),
    positions: positionRows.map((row) => ({
      id: row.id,
      name: row.name,
      area: row.area,
      description: row.description,
    })),
    scheduleRules: scheduleRuleRows.map((row) => ({
      id: row.id,
      dayOfWeek: Number(row.dayOfWeek),
      shift: row.shift as "morning" | "afternoon",
      active: asBoolean(row.active || "true"),
      label: row.label,
    })),
    templateSchedule: templateRows.map((row) => ({
      id: row.id,
      dayOfWeek: Number(row.dayOfWeek),
      shift: row.shift as "morning" | "afternoon",
      positionId: row.positionId,
      staffId: row.staffId,
      note: row.note,
    })),
    weeklySchedule: weeklyRows.map((row) => ({
      id: row.id,
      weekStart: row.weekStart,
      date: row.date,
      shift: row.shift as "morning" | "afternoon",
      positionId: row.positionId,
      staffId: row.staffId,
      source: row.source as "template" | "manual",
      status: row.status as
        | "draft"
        | "published"
        | "adjusted"
        | "needs-review",
      note: row.note,
    })),
    leaveRequests: leaveRows.map((row) => ({
      id: row.id,
      staffId: row.staffId,
      date: row.date,
      shift: row.shift as "morning" | "afternoon" | "full-day",
      reason: row.reason as "phep" | "om" | "khac",
      note: row.note,
    })),
    accessControl: accessRows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role as "admin" | "coordinator" | "viewer",
      displayName: row.displayName,
    })),
  };
}

export async function writeAppDataToSheets(data: AppData) {
  if (!isSheetsConfigured()) {
    throw new Error("Google Sheets chưa được cấu hình.");
  }

  await Promise.all([
    writeRows(
      "staff",
      data.staff.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        team: row.team,
        active: `${row.active}`,
        notes: row.notes ?? "",
      })),
    ),
    writeRows(
      "positions",
      data.positions.map((row) => ({
        id: row.id,
        name: row.name,
        area: row.area,
        description: row.description ?? "",
      })),
    ),
    writeRows(
      "scheduleRules",
      data.scheduleRules.map((row) => ({
        id: row.id,
        dayOfWeek: `${row.dayOfWeek}`,
        shift: row.shift,
        active: `${row.active}`,
        label: row.label ?? "",
      })),
    ),
    writeRows(
      "templateSchedule",
      data.templateSchedule.map((row) => ({
        id: row.id,
        dayOfWeek: `${row.dayOfWeek}`,
        shift: row.shift,
        positionId: row.positionId,
        staffId: row.staffId,
        note: row.note ?? "",
      })),
    ),
    writeRows(
      "weeklySchedule",
      data.weeklySchedule.map((row) => ({
        id: row.id,
        weekStart: row.weekStart,
        date: row.date,
        shift: row.shift,
        positionId: row.positionId,
        staffId: row.staffId,
        source: row.source,
        status: row.status,
        note: row.note ?? "",
      })),
    ),
    writeRows(
      "leaveRequests",
      data.leaveRequests.map((row) => ({
        id: row.id,
        staffId: row.staffId,
        date: row.date,
        shift: row.shift,
        reason: row.reason,
        note: row.note ?? "",
      })),
    ),
    writeRows(
      "accessControl",
      data.accessControl.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        displayName: row.displayName ?? "",
      })),
    ),
  ]);
}
