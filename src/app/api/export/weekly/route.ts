import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { addDays, format, parseISO } from "date-fns";
import { getWeekStartFromInput } from "@/lib/date";
import { getAppData } from "@/lib/repository";
import {
  buildAssignmentsFromTemplate,
  getActiveScheduleRules,
  getWeekBoard,
  getWeeklyAssignments,
} from "@/lib/schedule";

export async function GET(request: NextRequest) {
  const week = request.nextUrl.searchParams.get("week");
  const weekStart = getWeekStartFromInput(week);
  const data = await getAppData();

  const actualAssignments = getWeeklyAssignments(data.weeklySchedule, weekStart);
  const displayedAssignments =
    actualAssignments.length > 0
      ? actualAssignments
      : buildAssignmentsFromTemplate(
          data.templateSchedule,
          data.positions,
          weekStart,
          data.leaveRequests,
          data.scheduleRules,
          data.positionRules,
        );

  const fullBoard = getWeekBoard(
    displayedAssignments,
    data.positions,
    data.staff,
    data.leaveRequests,
    weekStart,
    data.scheduleRules,
    data.positionRules,
  );

  const activeRules = getActiveScheduleRules(data.scheduleRules);

  // Tạo danh sách cột: ST2, CT2, ST3, CT3, ...
  const columns = activeRules.map((rule) => {
    const prefix = rule.shift === "morning" ? "S" : "C";
    const dayLabel = `T${rule.dayOfWeek + 1}`; // dayOfWeek=1 → T2
    return {
      key: `${rule.dayOfWeek}-${rule.shift}`,
      header: `${prefix}${dayLabel}`,
      dayOfWeek: rule.dayOfWeek,
      shift: rule.shift,
    };
  });

  // Lấy tất cả vị trí xuất hiện trên fullBoard (giữ thứ tự gốc)
  const positionMap = new Map<string, { name: string; area?: string }>();
  for (const slot of fullBoard) {
    for (const entry of slot.entries) {
      const pid = entry.position.id;
      if (!positionMap.has(pid)) {
        positionMap.set(pid, { name: entry.position.name, area: entry.position.area });
      }
    }
  }

  // Sắp xếp vị trí theo khu vực: Sảnh → Trệt → Tầng 1 → Tầng 2 → Khác
  // Trong cùng khu vực: phải trước trái
  const AREA_PRIORITY: Record<string, number> = {
    "sảnh": 0,
    "trệt": 1,
    "tầng 1": 2,
    "tầng 2": 3,
  };

  function getAreaPriority(area?: string): number {
    if (!area) return 99;
    const lower = area.toLowerCase().trim();
    // Tìm exact match
    if (AREA_PRIORITY[lower] !== undefined) return AREA_PRIORITY[lower];
    // Tìm partial match (VD: "Trệt phải" → match "trệt")
    for (const [key, value] of Object.entries(AREA_PRIORITY)) {
      if (lower.startsWith(key)) return value;
    }
    return 98;
  }

  function getSidePriority(area?: string): number {
    if (!area) return 5;
    const lower = area.toLowerCase();
    if (lower.includes("phải")) return 0;
    if (lower.includes("trái")) return 1;
    return 2;
  }

  const positionIds = Array.from(positionMap.keys()).sort((a, b) => {
    const infoA = positionMap.get(a)!;
    const infoB = positionMap.get(b)!;
    const areaDiff = getAreaPriority(infoA.area) - getAreaPriority(infoB.area);
    if (areaDiff !== 0) return areaDiff;
    const sideDiff = getSidePriority(infoA.area) - getSidePriority(infoB.area);
    if (sideDiff !== 0) return sideDiff;
    // Cùng nhóm → sắp theo tên vị trí
    return (infoA.name ?? "").localeCompare(infoB.name ?? "", "vi");
  });

  // Bảng tra: (positionId, dayOfWeek, shift) → tên nhân sự
  const cellLookup = new Map<string, string>();
  for (const slot of fullBoard) {
    for (const entry of slot.entries) {
      const key = `${entry.position.id}|${slot.dayOfWeek}|${slot.shift}`;
      // entry.slots chứa danh sách { person, assignment, ... }
      const names = entry.slots
        .map((s: { person?: { name?: string } | null }) => s.person?.name ?? "")
        .filter(Boolean);
      if (names.length > 0) {
        const existing = cellLookup.get(key);
        const joined = names.join(", ");
        cellLookup.set(key, existing ? `${existing}, ${joined}` : joined);
      }
    }
  }

  // Tạo workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NurseFlow";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Lich Tuan");

  // Ngày bắt đầu / kết thúc
  const startDate = parseISO(weekStart);
  const endDate = addDays(startDate, 6);
  const title = `LỊCH TUẦN TỪ ${format(startDate, "dd/MM/yyyy")} ĐẾN ${format(endDate, "dd/MM/yyyy")}`;

  // Row 1: Tiêu đề lịch tuần (merge toàn bộ)
  const totalCols = columns.length + 2; // +2 cho cột Vùng + Vị trí
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF1E293B" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0FDFA" },
  };
  ws.getRow(1).height = 32;

  // Row 2: Header cột
  const headerRow = ws.getRow(2);
  headerRow.getCell(1).value = "Vùng";
  headerRow.getCell(2).value = "Vị trí";
  columns.forEach((col, idx) => {
    headerRow.getCell(idx + 3).value = col.header;
  });
  headerRow.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 24;

  // Style header
  for (let c = 1; c <= totalCols; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F766E" }, // teal-700
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF0D9488" } },
      bottom: { style: "thin", color: { argb: "FF0D9488" } },
      left: { style: "thin", color: { argb: "FF0D9488" } },
      right: { style: "thin", color: { argb: "FF0D9488" } },
    };
  }

  // Row 3+: Dữ liệu (merge ô Vùng cho các vị trí cùng area)
  let lastArea = "";
  let areaStartRow = 3;

  positionIds.forEach((pid, posIdx) => {
    const posInfo = positionMap.get(pid)!;
    const area = posInfo.area || "Khác";
    const rowNum = posIdx + 3; // row 3 trở đi

    const row = ws.getRow(rowNum);
    row.getCell(1).value = area;
    row.getCell(1).font = { bold: true, size: 10 };
    row.getCell(1).alignment = { vertical: "middle" };
    row.getCell(2).value = posInfo.name;
    row.getCell(2).font = { size: 10 };
    row.getCell(2).alignment = { vertical: "middle" };

    columns.forEach((col, idx) => {
      const key = `${pid}|${col.dayOfWeek}|${col.shift}`;
      const value = cellLookup.get(key) ?? "";
      const cell = row.getCell(idx + 3);
      cell.value = value;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.font = { size: 10 };
    });

    // Merge vùng khi sang area mới
    if (area !== lastArea && posIdx > 0) {
      if (areaStartRow < rowNum) {
        ws.mergeCells(areaStartRow, 1, rowNum - 1, 1);
      }
      areaStartRow = rowNum;
    }
    lastArea = area;
  });

  // Merge nhóm cuối cùng
  const lastDataRow = positionIds.length + 2;
  if (areaStartRow < lastDataRow) {
    ws.mergeCells(areaStartRow, 1, lastDataRow, 1);
  }

  // Thiết lập chiều rộng cột
  ws.getColumn(1).width = 16;
  ws.getColumn(2).width = 24;
  columns.forEach((_, idx) => {
    ws.getColumn(idx + 3).width = 16;
  });

  // Border cho tất cả dòng dữ liệu
  const lastRow = ws.rowCount;
  for (let r = 2; r <= lastRow; r++) {
    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getRow(r).getCell(c);
      if (!cell.border) {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      }
    }
  }

  // Freeze header
  ws.views = [{ state: "frozen", ySplit: 2, xSplit: 1 }];

  // Xuất buffer
  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lich-tuan-${weekStart}.xlsx"`,
    },
  });
}
