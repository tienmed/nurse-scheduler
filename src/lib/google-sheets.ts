import { google } from "googleapis";
import { unstable_cache, revalidateTag } from "next/cache";
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
  positionRules: "positionRules",
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
      positionIds: row.positionIds.join(","),
      active: `${row.active}`,
      prefersOvertime: `${row.prefersOvertime}`,
      notes: row.notes ?? "",
    })),
  positions: (data) =>
    data.positions.map((row) => ({
      id: row.id,
      name: row.name,
      area: row.area,
      description: row.description ?? "",
      quota: row.quota ? `${row.quota}` : "1",
      staffOrder: row.staffOrder ? row.staffOrder.join(",") : "",
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
      slotIndex: row.slotIndex !== undefined ? `${row.slotIndex}` : "0",
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
      slotIndex: row.slotIndex !== undefined ? `${row.slotIndex}` : "0",
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
  positionRules: (data) =>
    data.positionRules.map((row) => ({
      id: row.id,
      positionId: row.positionId,
      dayOfWeek: `${row.dayOfWeek}`,
      shift: row.shift,
      active: `${row.active}`,
    })),
  accessControl: (data) =>
    data.accessControl.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      displayName: row.displayName ?? "",
    })),
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function ensureId(prefix: string, rawId: string | undefined, fallbackSeed: string, index: number) {
  const trimmed = `${rawId ?? ""}`.trim();
  if (trimmed) {
    return trimmed;
  }

  const slug = slugify(fallbackSeed) || `${prefix}-${index + 1}`;
  return `${prefix}-${slug}`;
}

let isStructureEnsured = false;

async function ensureCorrectSheetStructure() {
  if (!isSheetsConfigured() || isStructureEnsured) return;
  
  const sheets = createSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
  });

  const existingSheets = spreadsheet.data.sheets ?? [];
  const sheetTitles = existingSheets.map(s => s.properties?.title);
  const targetTitle = SHEET_NAMES.positionRules;
  const legacyTitle = "area_rules";

  // Nếu target đã có thì thôi
  if (sheetTitles.includes(targetTitle)) return;

  // Nếu target chưa có mà legacy có -> Đổi tên
  const legacySheet = existingSheets.find(s => s.properties?.title === legacyTitle);
  if (legacySheet && legacySheet.properties?.sheetId !== undefined) {
    console.log(`🪄 [Google Sheets] Đang tự động đổi tên tab "${legacyTitle}" thành "${targetTitle}"...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: env.GOOGLE_SHEET_ID,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: legacySheet.properties.sheetId,
                title: targetTitle,
              },
              fields: "title",
            },
          },
        ],
      },
    });
    return;
  }

  // Nếu cả hai đều không có -> Tạo mới với header
  console.log(`🪄 [Google Sheets] Đang tạo mới tab "${targetTitle}"...`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: targetTitle,
            },
          },
        },
      ],
    },
  });

  // Ghi header cho sheet mới tạo
  const headers = SHEET_HEADERS.positionRules;
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `${targetTitle}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[...headers]],
    },
  });

  isStructureEnsured = true;
}

function createSheetsClient() {
  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: getServiceAccountPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}



function asBoolean(value: string) {
  return value.toLowerCase() === "true";
}

function parsePositionIds(row: SheetRow) {
  const raw = row.positionIds || row.positionId || "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function readAppDataFromSheets(): Promise<AppData> {
  let reqId = "";
  if (process.env.NODE_ENV === "development") {
    console.log("📊 [Google Sheets] Đang tải dữ liệu thực tế từ spreadsheet...");
    reqId = Math.random().toString(36).substring(7);
    console.time(`read-sheets-${reqId}`);
  }

  if (!isSheetsConfigured()) {
    throw new Error("Google Sheets chưa được cấu hình.");
  }

  // Đảm bảo cấu trúc sheet đúng trước khi đọc
  await ensureCorrectSheetStructure();

  const sheets = createSheetsClient();
  const ranges = [
    `${SHEET_NAMES.staff}!A:Z`,
    `${SHEET_NAMES.positions}!A:Z`,
    `${SHEET_NAMES.scheduleRules}!A:Z`,
    `${SHEET_NAMES.templateSchedule}!A:Z`,
    `${SHEET_NAMES.weeklySchedule}!A:Z`,
    `${SHEET_NAMES.leaveRequests}!A:Z`,
    `${SHEET_NAMES.positionRules}!A:Z`,
    `${SHEET_NAMES.accessControl}!A:Z`,
  ];

  let batchResponse;
  try {
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: env.GOOGLE_SHEET_ID,
      ranges,
    });
    batchResponse = res.data.valueRanges ?? [];
  } catch (error: any) {
    if (error?.status === 400 || (error?.message && error.message.includes("Unable to parse range"))) {
      console.warn(`⚠️ [Google Sheets] Một số sheet chưa tồn tại. Sẽ tạo lại kèm dữ liệu gốc khi lưu lần tới.`);
      batchResponse = ranges.map(() => ({ values: [] }));
    } else {
      throw error;
    }
  }

  const parseSheet = (index: number) => {
    const values = batchResponse[index]?.values ?? [];
    if (values.length === 0) return [];
    const [headerRow, ...rows] = values;
    const headers = headerRow.map((v) => `${v}`.trim());
    return rows
      .filter((row) => row.some((cell) => `${cell}`.trim()))
      .map((row) =>
        Object.fromEntries(headers.map((header, colIndex) => [header, `${row[colIndex] ?? ""}`]))
      );
  };

  const staffRows = parseSheet(0);
  const positionRows = parseSheet(1);
  const scheduleRuleRows = parseSheet(2);
  const templateRows = parseSheet(3);
  const weeklyRows = parseSheet(4);
  const leaveRows = parseSheet(5);
  const positionRuleRows = parseSheet(6);
  const accessRows = parseSheet(7);

  const data = {
    staff: staffRows.map((row, index) => ({
      id: ensureId("staff", row.id, row.email || row.name || `${index + 1}`, index),
      name: row.name,
      code: row.code,
      email: row.email ?? "",
      role: (row.role as "admin" | "coordinator" | "viewer") || "viewer",
      positionIds: parsePositionIds(row),
      active: asBoolean(row.active || "true"),
      prefersOvertime: asBoolean(row.prefersOvertime || "false"),
      notes: row.notes,
    })),
    positions: positionRows.map((row, index) => ({
      id: ensureId("position", row.id, row.name || row.area || `${index + 1}`, index),
      name: row.name,
      area: row.area,
      description: row.description,
      quota: row.quota ? Number(row.quota) : 1,
      staffOrder: row.staffOrder ? row.staffOrder.split(",").map((id) => id.trim()).filter(Boolean) : [],
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
      slotIndex: row.slotIndex ? Number(row.slotIndex) : 0,
      note: row.note,
    })),
    weeklySchedule: weeklyRows.map((row) => ({
      id: row.id,
      weekStart: row.weekStart,
      date: row.date,
      shift: row.shift as "morning" | "afternoon",
      positionId: row.positionId,
      staffId: row.staffId,
      slotIndex: row.slotIndex ? Number(row.slotIndex) : 0,
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
    positionRules: positionRuleRows.map((row) => ({
      id: row.id,
      positionId: row.positionId,
      dayOfWeek: Number(row.dayOfWeek),
      shift: row.shift as "morning" | "afternoon",
      active: asBoolean(row.active || "true"),
    })),
    accessControl: accessRows.map((row, index) => ({
      id: ensureId(
        "access",
        row.id,
        row.email || row.displayName || `${row.role || "viewer"}-${index + 1}`,
        index,
      ),
      email: row.email,
      role: row.role as "admin" | "coordinator" | "viewer",
      displayName: row.displayName,
    })),
  };

  if (process.env.NODE_ENV === "development") {
    console.timeEnd(`read-sheets-${reqId}`);
    console.log("✅ [Google Sheets] Đã tải xong dữ liệu.");
  }

  return data;
}

export async function writeAppDataToSheets(data: AppData) {
  await writeAppDataKeysToSheets(data, Object.keys(APP_DATA_TO_SHEET) as AppDataKey[]);
}

const CACHE_TAG = "app-data";

const cachedReadAppData = unstable_cache(
  async () => readAppDataFromSheets(),
  ["app-data-sheets"],
  { tags: [CACHE_TAG], revalidate: 60 },
);

export function getCachedAppData() {
  return cachedReadAppData();
}

export function invalidateAppDataCache() {
  revalidateTag(CACHE_TAG, "max");
}

export async function writeAppDataKeysToSheets(data: AppData, keys: AppDataKey[]) {
  if (!isSheetsConfigured()) {
    throw new Error("Google Sheets chưa được cấu hình.");
  }

  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) {
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`💾 [Google Sheets] Bắt đầu ghi các khóa: ${uniqueKeys.join(", ")}`);
  }

  const sheets = createSheetsClient();
  const clearRanges = uniqueKeys.map((key) => `${SHEET_NAMES[APP_DATA_TO_SHEET[key]]}!A:Z`);
  const updateData = uniqueKeys.map((key) => {
    const sheetName = APP_DATA_TO_SHEET[key];
    const headers = [...SHEET_HEADERS[sheetName]];
    const rows = sheetSerializers[key](data);
    
    if (process.env.NODE_ENV === "development") {
      console.log(`   - ${key} (${sheetName}): chuẩn bị ghi ${rows.length} dòng`);
    }

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

  if (process.env.NODE_ENV === "development") {
    console.log(`✅ [Google Sheets] Đã ghi xong cho các khóa: ${uniqueKeys.join(", ")}`);
  }
}

