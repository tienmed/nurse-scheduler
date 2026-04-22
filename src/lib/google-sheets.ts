import { google } from "googleapis";
import { cache as reactCache } from "react";
import { revalidateTag } from "next/cache";
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
  leaveCancellations: "leaveCancellations",
  holidays: "holidays",
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
  weeklySchedule: (data) => {
    // Tự động làm gọn: Chỉ lưu 180 ngày lịch sử gần nhất để tránh phình to DB (10 triệu cells)
    const { parseISO, subDays, isAfter, startOfToday } = require("date-fns");
    const cutoff = subDays(startOfToday(), 180);

    return data.weeklySchedule
      .filter(item => {
        try {
          return isAfter(parseISO(item.date), cutoff);
        } catch {
          return true;
        }
      })
      .map((item) => ({
        ...item,
        id: item.id || "",
        weekStart: item.weekStart || "",
        date: item.date || "",
        shift: item.shift || "morning",
        positionId: item.positionId || "",
        staffId: item.staffId || "",
        slotIndex: String(item.slotIndex || 0),
        source: item.source || "manual",
        status: item.status || "draft",
        note: item.note || "",
      }));
  },
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
  leaveCancellations: (data) =>
    data.leaveCancellations.map((row) => ({
      id: row.id,
      staffId: row.staffId,
      date: row.date,
      shift: row.shift,
      cancelledAt: row.cancelledAt,
    })),
  holidays: (data) =>
    data.holidays.map((row) => ({
      id: row.id,
      date: row.date,
      name: row.name,
      note: row.note ?? "",
    })),
};

import { generateId } from "@/lib/id";

function ensureId(prefix: string, rawId: string | undefined, fallbackSeed: string, index: number) {
  const trimmed = `${rawId ?? ""}`.trim();
  if (trimmed) {
    return trimmed;
  }

  // Dùng ID ổn định dựa trên seed (email hoặc tên) để tránh bị nhảy ID khi chưa kịp lưu
  // Nếu không có seed, dùng index. Loại bỏ ký tự đặc biệt để đảm bảo định dạng ID chuẩn.
  const safeSeed = fallbackSeed.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Bỏ dấu tiếng Việt
    .replace(/[^a-z0-9]/g, "-") // Thay ký tự lạ bằng gạch ngang
    .replace(/-+/g, "-") // Thu gọn gạch ngang
    .substring(0, 20);

  return `${prefix}-${safeSeed || index}`;
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

  // --- Xử lý positionRules (migration từ area_rules) ---
  const posRulesTitle = SHEET_NAMES.positionRules;
  const legacyTitle = "area_rules";

  if (!sheetTitles.includes(posRulesTitle)) {
    const legacySheet = existingSheets.find(s => s.properties?.title === legacyTitle);
    if (legacySheet && legacySheet.properties?.sheetId !== undefined) {
      console.log(`🪄 [Google Sheets] Đang tự động đổi tên tab "${legacyTitle}" thành "${posRulesTitle}"...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: env.GOOGLE_SHEET_ID,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: legacySheet.properties.sheetId,
                  title: posRulesTitle,
                },
                fields: "title",
              },
            },
          ],
        },
      });
    } else {
      await createSheetWithHeaders(sheets, posRulesTitle, SHEET_HEADERS.positionRules);
    }
  }

  // --- Tạo tab leave_cancellations nếu chưa có ---
  const cancelTitle = SHEET_NAMES.leaveCancellations;
  if (!sheetTitles.includes(cancelTitle)) {
    await createSheetWithHeaders(sheets, cancelTitle, SHEET_HEADERS.leaveCancellations);
  }

  // --- Tạo tab holidays nếu chưa có ---
  const holidayTitle = SHEET_NAMES.holidays;
  if (!sheetTitles.includes(holidayTitle)) {
    await createSheetWithHeaders(sheets, holidayTitle, SHEET_HEADERS.holidays);
  }

  isStructureEnsured = true;
}

async function createSheetWithHeaders(
  sheets: ReturnType<typeof createSheetsClient>,
  title: string,
  headers: readonly string[],
) {
  console.log(`🪄 [Google Sheets] Đang tạo mới tab "${title}"...`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `${title}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[...headers]] },
  });
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

// Cấu hình sắp xếp cho từng tab (0-indexed column)
const SORT_CONFIG: Partial<Record<AppDataKey, { column: number; ascending: boolean }[]>> = {
  weeklySchedule: [
    { column: 2, ascending: true }, // date
    { column: 3, ascending: true }, // shift
  ],
  leaveRequests: [
    { column: 2, ascending: true }, // date
    { column: 3, ascending: true }, // shift
  ],
  templateSchedule: [
    { column: 1, ascending: true }, // dayOfWeek
    { column: 2, ascending: true }, // shift
  ],
  scheduleRules: [
    { column: 1, ascending: true }, // dayOfWeek
    { column: 2, ascending: true }, // shift
  ],
  positionRules: [
    { column: 1, ascending: true }, // positionId
    { column: 2, ascending: true }, // dayOfWeek
    { column: 3, ascending: true }, // shift
  ],
  staff: [
    { column: 1, ascending: true }, // name
  ],
  positions: [
    { column: 1, ascending: true }, // name
  ],
  holidays: [
    { column: 1, ascending: true }, // date
  ],
  leaveCancellations: [
    { column: 2, ascending: true }, // date
    { column: 3, ascending: true }, // shift
  ],
};

export async function readAppDataFromSheets(): Promise<AppData> {
  let reqId = "";
  if (process.env.NODE_ENV === "development") {
    reqId = Math.random().toString(36).substring(7);
    console.time(`read-sheets-${reqId}`);
  }

  if (!isSheetsConfigured()) {
    throw new Error("Google Sheets chưa được cấu hình.");
  }

  // Đảm bảo cấu trúc sheet đúng trước khi đọc
  await ensureCorrectSheetStructure();

  const sheets = createSheetsClient();

  // 1. Lấy metadata để biết tổng số dòng của từng sheet
  const spreadsheetMeta = await sheets.spreadsheets.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
  });
  const sheetStats = new Map<string, number>();
  spreadsheetMeta.data.sheets?.forEach((s) => {
    if (s.properties?.title) {
      sheetStats.set(s.properties.title, s.properties.gridProperties?.rowCount ?? 1000);
    }
  });

  // 2. Xây dựng danh sách range động
  const heavySheets: string[] = [SHEET_NAMES.weeklySchedule, SHEET_NAMES.leaveRequests];
  const PARTIAL_LIMIT = 10000;

  const targetSheetNames = [
    SHEET_NAMES.staff,
    SHEET_NAMES.positions,
    SHEET_NAMES.scheduleRules,
    SHEET_NAMES.templateSchedule,
    SHEET_NAMES.weeklySchedule,
    SHEET_NAMES.leaveRequests,
    SHEET_NAMES.positionRules,
    SHEET_NAMES.accessControl,
    SHEET_NAMES.leaveCancellations,
    SHEET_NAMES.holidays,
  ];

  const ranges: string[] = [];
  const rangeIndicesMap: Record<string, number[]> = {};

  targetSheetNames.forEach((name) => {
    const rowCount = sheetStats.get(name) ?? 1000;
    if (heavySheets.includes(name) && rowCount > PARTIAL_LIMIT + 5) {
      // Lấy Header
      ranges.push(`${name}!A1:Z1`);
      const hIdx = ranges.length - 1;
      // Lấy các dòng cuối
      const startRow = Math.max(2, rowCount - PARTIAL_LIMIT + 1);
      ranges.push(`${name}!A${startRow}:Z${rowCount}`);
      const dIdx = ranges.length - 1;
      rangeIndicesMap[name] = [hIdx, dIdx];
    } else {
      ranges.push(`${name}!A:Z`);
      rangeIndicesMap[name] = [ranges.length - 1];
    }
  });

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

  const parseSheetData = (name: string) => {
    const indices = rangeIndicesMap[name];
    if (!indices) return [];

    let headerRow: any[] = [];
    let dataRows: any[][] = [];

    indices.forEach((idx, i) => {
      const values = batchResponse[idx]?.values ?? [];
      if (values.length === 0) return;

      if (indices.length === 2 && i === 0) {
        headerRow = values[0];
      } else if (indices.length === 2 && i === 1) {
        dataRows = values;
      } else {
        const [h, ...d] = values;
        headerRow = h;
        dataRows = d;
      }
    });

    if (!headerRow.length) return [];
    const headers = headerRow.map((v) => `${v}`.trim());
    const validRows = dataRows.filter((row) => row.some((cell) => `${cell}`.trim()));

    if (process.env.NODE_ENV === "development") {
      const actualCount = sheetStats.get(name) ?? 0;
      console.log(`   - ${name}: Đã tải ${validRows.length} dòng gần nhất (Tổng sheet: ${actualCount}).`);
    }

    const hMap = headers.map((h, i) => ({ h, i }));

    return validRows.map((row) => {
      const obj: Record<string, string> = {};
      for (const { h, i } of hMap) {
        obj[h] = `${row[i] ?? ""}`;
      }
      return obj;
    });
  };

  const data: AppData = {
    staff: parseSheetData(SHEET_NAMES.staff).map((row, index) => ({
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
    positions: parseSheetData(SHEET_NAMES.positions).map((row, index) => ({
      id: ensureId("position", row.id, row.name || row.area || `${index + 1}`, index),
      name: row.name,
      area: row.area,
      description: row.description,
      quota: row.quota ? Number(row.quota) : 1,
      staffOrder: row.staffOrder ? row.staffOrder.split(",").map((id) => id.trim()).filter(Boolean) : [],
    })),
    scheduleRules: parseSheetData(SHEET_NAMES.scheduleRules).map((row) => ({
      id: row.id,
      dayOfWeek: Number(row.dayOfWeek),
      shift: row.shift as "morning" | "afternoon",
      active: asBoolean(row.active || "true"),
      label: row.label,
    })),
    templateSchedule: parseSheetData(SHEET_NAMES.templateSchedule).map((row) => ({
      id: row.id,
      dayOfWeek: Number(row.dayOfWeek),
      shift: row.shift as "morning" | "afternoon",
      positionId: row.positionId,
      staffId: row.staffId,
      slotIndex: Number(row.slotIndex || 0),
      note: row.note,
    })),
    weeklySchedule: parseSheetData(SHEET_NAMES.weeklySchedule).map((row) => ({
      id: row.id,
      weekStart: row.weekStart,
      date: row.date,
      shift: row.shift as "morning" | "afternoon",
      positionId: row.positionId,
      staffId: row.staffId,
      slotIndex: Number(row.slotIndex || 0),
      source: (row.source as any) || "manual",
      status: (row.status as any) || "draft",
      note: row.note,
    })),
    leaveRequests: parseSheetData(SHEET_NAMES.leaveRequests).map((row) => ({
      id: row.id,
      staffId: row.staffId,
      date: row.date,
      shift: row.shift as "morning" | "afternoon" | "full-day",
      reason: (row.reason as any) || "personal",
      note: row.note,
    })),
    positionRules: parseSheetData(SHEET_NAMES.positionRules).map((row) => ({
      id: row.id,
      positionId: row.positionId,
      dayOfWeek: Number(row.dayOfWeek),
      shift: row.shift as "morning" | "afternoon",
      active: asBoolean(row.active || "true"),
    })),
    accessControl: parseSheetData(SHEET_NAMES.accessControl).map((row, index) => ({
      id: ensureId(
        "access",
        row.id,
        row.email || row.displayName || `${row.role || "viewer"}-${index + 1}`,
        index,
      ),
      email: row.email,
      role: (row.role as any) || "viewer",
      displayName: row.displayName,
    })),
    leaveCancellations: parseSheetData(SHEET_NAMES.leaveCancellations).map((row, index) => ({
      id: ensureId("cancel", row.id, `${row.staffId}-${row.date}`, index),
      leaveRequestId: row.leaveRequestId,
      staffId: row.staffId,
      date: row.date,
      shift: row.shift as "morning" | "afternoon" | "full-day",
      cancelledAt: row.cancelledAt,
    })),
    holidays: parseSheetData(SHEET_NAMES.holidays).map((row, index) => ({
      id: ensureId("holiday", row.id, row.date || `${index + 1}`, index),
      date: row.date,
      name: row.name,
      note: row.note,
    })),
  };

  // --- PHẦN 6: Bảo vệ tham chiếu (Reference Protection) ---
  const validStaffIds = new Set(data.staff.map(s => s.id));
  const validPositionIds = new Set(data.positions.map(p => p.id));

  // Lọc lịch nền: Chỉ giữ các bản ghi có Vị trí tồn tại
  data.templateSchedule = data.templateSchedule.filter(ts => 
    validPositionIds.has(ts.positionId)
  );

  // Lọc quy tắc vị trí
  data.positionRules = data.positionRules.filter(pr => 
    validPositionIds.has(pr.positionId)
  );

  // Đối với Lịch tuần và Nghỉ phép: Giữ lại để bảo toàn lịch sử, 
  // UI sẽ tự xử lý nếu không tìm thấy Staff tương ứng.

  if (process.env.NODE_ENV === "development") {
    console.timeEnd(`read-sheets-${reqId}`);
    console.log("✅ [Google Sheets] Đã tải và dọn dẹp dữ liệu rác.");
  }

  return data;
}

export async function writeAppDataToSheets(data: AppData) {
  await writeAppDataKeysToSheets(data, Object.keys(APP_DATA_TO_SHEET) as AppDataKey[]);
}

const CACHE_TAG = "app-data";
const TTL = 60 * 1000; // 60 seconds

let memoryCache: { data: AppData; timestamp: number } | null = null;

const deduplicatedReadAppData = reactCache(async () => {
  const now = Date.now();
  if (memoryCache && (now - memoryCache.timestamp < TTL)) {
    if (process.env.NODE_ENV === "development") {
      console.log("⚡ [Cache] Đang sử dụng dữ liệu từ bộ nhớ (Memory Cache).");
    }
    return memoryCache.data;
  }
  const data = await readAppDataFromSheets();
  memoryCache = { data, timestamp: now };
  return data;
});

export function getCachedAppData() {
  return deduplicatedReadAppData();
}

export function invalidateAppDataCache() {
  memoryCache = null;
  revalidateTag(CACHE_TAG, "max");
}

export async function writeAppDataKeysToSheets(data: AppData, keys: AppDataKey[]) {
  if (!isSheetsConfigured()) {
    throw new Error("Google Sheets chưa được cấu hình.");
  }

  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) return;

  if (process.env.NODE_ENV === "development") {
    console.log(`💾 [Google Sheets] Bắt đầu GHI (Upsert) các khóa: ${uniqueKeys.join(", ")}`);
  }

  const sheets = createSheetsClient();

  const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: env.GOOGLE_SHEET_ID });
  const sheetMetadataMap = new Map<string, { sheetId: number; rowCount: number; colCount: number }>();
  let currentTotalCells = 0;

  spreadsheetMeta.data.sheets?.forEach((s) => {
    const title = s.properties?.title;
    const sheetId = s.properties?.sheetId;
    if (title && typeof sheetId === "number") {
      const rowCount = Number(s.properties?.gridProperties?.rowCount ?? 1000);
      const colCount = Number(s.properties?.gridProperties?.columnCount ?? 26);
      sheetMetadataMap.set(title, { sheetId, rowCount, colCount });
      currentTotalCells += rowCount * colCount;
    }
  });

  if (process.env.NODE_ENV === "development") {
    console.log(`📊 [Google Sheets] Tổng số cell: ${currentTotalCells.toLocaleString()} / 10,000,000`);
  }

  const allManagedSheetNames = Object.values(SHEET_NAMES);
  const batchGetResponse = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    ranges: allManagedSheetNames.map(name => `${name}!A:A`),
  });

  const valueRanges = batchGetResponse.data.valueRanges || [];
  const sheetAValuesMap = new Map<string, any[][]>();
  allManagedSheetNames.forEach((name, idx) => {
    sheetAValuesMap.set(name, valueRanges[idx]?.values || []);
  });

  const updateData: { range: string; values: any[][] }[] = [];
  const clearRanges: string[] = [];
  const maxRowsNeededPerSheet = new Map<string, number>();
  const keysToUpdateSet = new Set(uniqueKeys);

  // --- PHẦN 1: Tính toán rows cần thiết ---
  allManagedSheetNames.forEach((actualSheetName) => {
    const appDataKey = (Object.keys(APP_DATA_TO_SHEET) as AppDataKey[]).find(
      k => SHEET_NAMES[APP_DATA_TO_SHEET[k]] === actualSheetName
    );

    const colA = sheetAValuesMap.get(actualSheetName) || [];
    let maxRowForThisSheet = 1;

    if (appDataKey && keysToUpdateSet.has(appDataKey)) {
      const sheetNameKey = APP_DATA_TO_SHEET[appDataKey];
      const headers = [...SHEET_HEADERS[sheetNameKey]];
      const rows = sheetSerializers[appDataKey](data);

      const existingIds = new Map<string, number>();
      const holes: number[] = [];

      colA.forEach((rowVal, idx) => {
        const id = rowVal[0]?.toString().trim();
        const rowNum = idx + 1;
        if (id && id !== "id") {
          if (existingIds.has(id)) holes.push(existingIds.get(id)!);
          existingIds.set(id, rowNum);
        }
      });

      let nextAvailableRow = Math.max(2, colA.length + 1);

      const keepIds = new Set(rows.map((r) => r.id));
      existingIds.forEach((rowNum, id) => {
        if (id !== "id" && !keepIds.has(id)) holes.push(rowNum);
      });

      holes.sort((a, b) => a - b);

      updateData.push({ range: `${actualSheetName}!A1`, values: [headers] });

      for (const row of rows) {
        let targetRow: number = (row.id && existingIds.has(row.id)) 
          ? existingIds.get(row.id)! 
          : (holes.length > 0 ? holes.shift()! : nextAvailableRow++);
        
        if (targetRow > maxRowForThisSheet) maxRowForThisSheet = targetRow;

        updateData.push({
          range: `${actualSheetName}!A${targetRow}`,
          values: [headers.map((h) => row[h] ?? "")],
        });
      }

      for (const hole of holes) clearRanges.push(`${actualSheetName}!A${hole}:Z${hole}`);
    } else {
      colA.forEach((rowVal, idx) => { if (rowVal[0]?.toString().trim()) maxRowForThisSheet = idx + 1; });
    }
    maxRowsNeededPerSheet.set(actualSheetName, maxRowForThisSheet);
  });

  // --- PHẦN 1.5: Đồng bộ hóa liên kết (Integrity Sync) ---
  // Tự động dọn dẹp các ID không tồn tại trong staffOrder và positionIds trước khi ghi
  const allStaffIds = new Set(data.staff.map(s => s.id));
  const allPositionIds = new Set(data.positions.map(p => p.id));

  // Dọn dẹp staff.positionIds
  data.staff.forEach(s => {
    if (s.positionIds) {
      s.positionIds = s.positionIds.filter(pid => allPositionIds.has(pid));
    }
  });

  // Dọn dẹp positions.staffOrder
  data.positions.forEach(p => {
    if (p.staffOrder) {
      p.staffOrder = p.staffOrder.filter(sid => allStaffIds.has(sid));
    }
  });

  // --- PHẦN 2: Dọn dẹp & Mở rộng ---
  const gridRequests: any[] = [];
  const BUFFER_ROWS = 5;

  maxRowsNeededPerSheet.forEach((maxRow, sheetName) => {
    const meta = sheetMetadataMap.get(sheetName);
    if (!meta) return;
    const finalMaxRow = Math.max(maxRow, 1);
    
    // Dọn dẹp
    if (meta.rowCount > finalMaxRow + BUFFER_ROWS) {
      const start = finalMaxRow + BUFFER_ROWS;
      const num = meta.rowCount - start;
      gridRequests.push({ deleteDimension: { range: { sheetId: meta.sheetId, dimension: "ROWS", startIndex: start, endIndex: meta.rowCount } } });
      currentTotalCells -= (num * meta.colCount);
    }
  });

  const expansionFailedSheets = new Set<string>();
  maxRowsNeededPerSheet.forEach((maxRow, sheetName) => {
    const meta = sheetMetadataMap.get(sheetName);
    if (meta && maxRow > meta.rowCount) {
      const newRC = maxRow + BUFFER_ROWS;
      const added = (newRC - meta.rowCount) * meta.colCount;
      if (currentTotalCells + added > 10000000) {
        console.error(`🚨 [Google Sheets] KHÔNG THỂ mở rộng tab "${sheetName}".`);
        expansionFailedSheets.add(sheetName);
      } else {
        gridRequests.push({ updateSheetProperties: { properties: { sheetId: meta.sheetId, gridProperties: { rowCount: newRC } }, fields: "gridProperties.rowCount" } });
        currentTotalCells += added;
      }
    }
  });

  if (gridRequests.length > 0) {
    try {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: env.GOOGLE_SHEET_ID, requestBody: { requests: gridRequests } });
    } catch (e: any) {
      throw new Error(`Lỗi cấu hình Grid: ${e.message}`);
    }
  }

  // --- PHẦN 4: Ghi Values ---
  const filteredData = updateData.filter(item => {
    const [sheet, range] = item.range.split("!");
    const match = range.match(/A(\d+)$/);
    if (!match) return true;
    const rowNum = parseInt(match[1]);
    const meta = sheetMetadataMap.get(sheet);
    return !(expansionFailedSheets.has(sheet) && meta && rowNum > meta.rowCount);
  });

  if (filteredData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: env.GOOGLE_SHEET_ID, requestBody: { valueInputOption: "RAW", data: filteredData } });
  }

  if (clearRanges.length > 0) {
    await sheets.spreadsheets.values.batchClear({ spreadsheetId: env.GOOGLE_SHEET_ID, requestBody: { ranges: clearRanges } });
  }

  // --- PHẦN 5: Sort ---
  const sortReqs: any[] = [];
  allManagedSheetNames.forEach(sheetName => {
    const key = (Object.keys(APP_DATA_TO_SHEET) as AppDataKey[]).find(k => SHEET_NAMES[APP_DATA_TO_SHEET[k]] === sheetName);
    const meta = sheetMetadataMap.get(sheetName);
    const maxR = maxRowsNeededPerSheet.get(sheetName) || 1;
    const rowCount = (gridRequests.some(r => r.updateSheetProperties?.properties?.sheetId === meta?.sheetId)) ? (maxR + BUFFER_ROWS) : (meta?.rowCount ?? 0);

    if (key && SORT_CONFIG[key] && meta && maxR > 1 && maxR <= rowCount) {
      sortReqs.push({ sortRange: { range: { sheetId: meta.sheetId, startRowIndex: 1, endRowIndex: maxR, startColumnIndex: 0, endColumnIndex: meta.colCount }, sortSpecs: SORT_CONFIG[key]!.map(s => ({ dimensionIndex: s.column, sortOrder: s.ascending ? "ASCENDING" : "DESCENDING" })) } });
    }
  });

  if (sortReqs.length > 0) await sheets.spreadsheets.batchUpdate({ spreadsheetId: env.GOOGLE_SHEET_ID, requestBody: { requests: sortReqs } });
}
