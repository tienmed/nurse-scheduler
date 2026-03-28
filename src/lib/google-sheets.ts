import { google } from "googleapis";
import { SHEET_HEADERS, SHEET_NAMES } from "@/lib/constants";
import { env, getServiceAccountPrivateKey, isSheetsConfigured } from "@/lib/env";
import type { AppData } from "@/lib/types";

type SheetName = keyof typeof SHEET_NAMES;
type SheetRow = Record<string, string>;
type AppDataKey = keyof AppData;

const APP_DATA_TO_SHEET: Record<AppDataKey, SheetName> = {
  staff: "staff",
  positions: "positions",
  scheduleRules: "scheduleRules",
  templateSchedule: "templateSchedule",
  weeklySchedule: "weeklySchedule",
  leaveRequests: "leaveRequests",
  accessControl: "accessControl",
};

const sheetSerializers: Record<AppDataKey, (data: AppData) => SheetRow[]> = {
  staff: (data) =>
    data.staff.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      email: row.email,
      role: row.role,
      positionId: row.positionId,
      active: `${row.active}`,
      notes: row.notes ?? "",
    })),
  positions: (data) =>
    data.positions.map((row) => ({
      id: row.id,
      name: row.name,
      area: row.area,
      description: row.description ?? "",
    })),
  scheduleRules: (data) =>
    data.scheduleRules.map((row) => ({
      id: row.id,
      dayOfWeek: `${row.dayOfWeek}`,
      shift: row.shift,
      active: `${row.active}`,
      label: row.label ?? "",
    })),
  templateSchedule: (data) =>
    data.templateSchedule.map((row) => ({
      id: row.id,
      dayOfWeek: `${row.dayOfWeek}`,
      shift: row.shift,
      positionId: row.positionId,
      staffId: row.staffId,
      note: row.note ?? "",
    })),
  weeklySchedule: (data) =>
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
  leaveRequests: (data) =>
    data.leaveRequests.map((row) => ({
      id: row.id,
      staffId: row.staffId,
      date: row.date,
      shift: row.shift,
      reason: row.reason,
      note: row.note ?? "",
    })),
  accessControl: (data) =>
    data.accessControl.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      displayName: row.displayName ?? "",
    })),
};

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
      Object.fromEntries(headers.map((header, index) => [header, `${row[index] ?? ""}`])),
    );
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
      email: row.email ?? "",
      role: (row.role as "admin" | "coordinator" | "viewer") || "viewer",
      positionId: row.positionId ?? "",
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
      status: row.status as "draft" | "published" | "adjusted" | "needs-review",
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
  await writeAppDataKeysToSheets(data, Object.keys(APP_DATA_TO_SHEET) as AppDataKey[]);
}

export async function writeAppDataKeysToSheets(data: AppData, keys: AppDataKey[]) {
  if (!isSheetsConfigured()) {
    throw new Error("Google Sheets chưa được cấu hình.");
  }

  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) {
    return;
  }

  const sheets = createSheetsClient();
  const clearRanges = uniqueKeys.map((key) => `${SHEET_NAMES[APP_DATA_TO_SHEET[key]]}!A:Z`);
  const updateData = uniqueKeys.map((key) => {
    const sheetName = APP_DATA_TO_SHEET[key];
    const headers = [...SHEET_HEADERS[sheetName]];
    const rows = sheetSerializers[key](data);
    return {
      range: `${SHEET_NAMES[sheetName]}!A1`,
      values: [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))],
    };
  });

  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    requestBody: { ranges: clearRanges },
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: updateData,
    },
  });
}
