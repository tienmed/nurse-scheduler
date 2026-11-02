import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { addDays, format, parseISO } from "date-fns";
import { getWeekStartFromInput } from "@/lib/date";
import { getAppData } from "@/lib/repository";
import {
  buildAssignmentsFromTemplate,
  getActiveScheduleRules,
  getWeeklyAssignments,
} from "@/lib/schedule";
import { WEEKDAY_LABELS } from "@/lib/constants";
import type { Position, ShiftType, StaffMember } from "@/lib/types";

// [QWEN3] Rút gọn tên nhân sự thành tên gọi thân mật / tên chính như trong bảng phân công thực tế
function getStaffShortName(fullName: string): string {
  if (!fullName) return "";
  const trimmed = fullName.trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes("lyna")) return "Lyna";

  // Các tên kép phổ biến
  const compoundNames = [
    "Phúc Anh",
    "Bích Thảo",
    "Bính Thảo",
    "Kim Hoa",
    "Kim Liên",
    "Kim Điệp",
    "Tú Trang",
    "Mỹ Nhiên",
    "Ngọc Hạnh",
    "Nhân Nghĩa",
  ];
  for (const comp of compoundNames) {
    if (trimmed.endsWith(comp)) return comp;
  }

  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

// [QWEN3] Rút gọn lý do nghỉ: "phép", "ốm", "học", "khác"
function getLeaveReasonShortLabel(reason?: string, note?: string): string {
  if (!reason) {
    if (note && note.trim()) return note.trim().slice(0, 8);
    return "phép";
  }
  const r = reason.toLowerCase().trim();
  if (r === "om" || r === "ốm" || r.includes("ốm") || r.includes("bệnh")) return "ốm";
  if (r === "dihoc" || r === "học" || r.includes("học")) return "học";
  if (r === "phep" || r === "phép" || r.includes("phép")) return "phép";
  if (note && note.trim()) return note.trim().slice(0, 8);
  return "phép";
}

// Bảng màu phân nhóm phòng giống 100% ảnh mẫu
const GROUP_COLORS = {
  yellow: "FFFFFF00", // Vàng: Chuyên khoa (Da liễu, CSD, Mắt, TMH, TL-TT, Nội Tim Mạch, YHCT)
  blue: "FFD9E1F2",   // Xanh dương: Khám & Cận lâm sàng (Siêu âm, Cấp cứu, CXK, Nội, Ngoại, Sản, ECG...)
  peach: "FFFCE4D6",  // Cam nhạt: Chuyên gia
  pink: "FFF2DCDB",   // Hồng/Tím nhạt: Tiếp nhận
  green: "FFE2EFDA",  // Xanh lá nhạt: Nhập liệu KSK / Khác
  leave: "FFFCE4D6",  // Dòng phép cuối cùng
};

// Phân loại nhóm màu theo tên phòng / khu vực
function getPositionGroupColor(pos: Position): { bg: string; order: number } {
  const area = (pos.area || "").toLowerCase();
  const name = pos.name.toLowerCase();

  // 1. Phân loại theo Khu vực (Area) nếu có
  if (area.includes("tầng 1")) {
    return { bg: GROUP_COLORS.yellow, order: 1 };
  }
  if (area.includes("trệt") || area.includes("tầng trệt")) {
    return { bg: GROUP_COLORS.blue, order: 2 };
  }
  if (area.includes("tầng 2") || area.includes("chuyên gia")) {
    return { bg: GROUP_COLORS.peach, order: 3 };
  }
  if (area.includes("sảnh") || area.includes("tiếp nhận")) {
    return { bg: GROUP_COLORS.pink, order: 4 };
  }
  if (area.includes("ksk") || area.includes("khám sức khỏe") || area.includes("khnv") || area.includes("thanh trùng")) {
    return { bg: GROUP_COLORS.green, order: 5 };
  }

  // 2. Phân loại theo tên phòng (fallback)
  if (
    name.includes("da liễu") ||
    name.includes("chăm sóc da") ||
    name.includes("csd") ||
    name.includes("mắt") ||
    name.includes("tmh") ||
    name.includes("tâm lý") ||
    name.includes("thần kinh") ||
    name.includes("tim mạch") ||
    name.includes("yhct")
  ) {
    return { bg: GROUP_COLORS.yellow, order: 1 };
  }

  if (name.includes("chuyên gia") || name.includes("miễn dịch") || name.includes("d.ứ")) {
    return { bg: GROUP_COLORS.peach, order: 3 };
  }

  if (name.includes("tiếp nhận")) {
    return { bg: GROUP_COLORS.pink, order: 4 };
  }

  if (name.includes("nhập liệu") || name.includes("ksk") || name.includes("khnv") || name.includes("thanh trùng")) {
    return { bg: GROUP_COLORS.green, order: 5 };
  }

  return { bg: GROUP_COLORS.blue, order: 2 };
}

export async function GET(request: NextRequest) {
  const week = request.nextUrl.searchParams.get("week");
  const orderParam = request.nextUrl.searchParams.get("order");
  const requestedOrder = orderParam ? decodeURIComponent(orderParam).split(",").filter(Boolean) : [];
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
          data.holidays,
        );

  const activeRules = getActiveScheduleRules(data.scheduleRules);
  const startDate = parseISO(weekStart);

  // Tạo danh sách các slot (Sáng T2 -> Sáng/Chiều T6/T7)
  const slots: { date: string; shift: ShiftType; dayOfWeek: number; label: string }[] = activeRules
    .map((rule) => {
      const slotDate = format(addDays(startDate, rule.dayOfWeek - 1), "yyyy-MM-dd");
      return {
        date: slotDate,
        shift: rule.shift,
        dayOfWeek: rule.dayOfWeek,
        label: `${rule.shift === "morning" ? "Sáng" : "Chiều"} ${WEEKDAY_LABELS[rule.dayOfWeek]}`,
      };
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.shift === "morning" ? -1 : 1;
    });

  // Gom các slot theo ngày
  const daysMap = new Map<string, { date: string; dayOfWeek: number; morningSlot?: typeof slots[0]; afternoonSlot?: typeof slots[0] }>();
  for (const s of slots) {
    if (!daysMap.has(s.date)) {
      daysMap.set(s.date, { date: s.date, dayOfWeek: s.dayOfWeek });
    }
    const dayObj = daysMap.get(s.date)!;
    if (s.shift === "morning") dayObj.morningSlot = s;
    if (s.shift === "afternoon") dayObj.afternoonSlot = s;
  }
  const days = Array.from(daysMap.values()).slice(0, 6); // Thứ 2 đến Thứ 6 (hoặc Thứ 7 nếu có)

  // Map nhân sự
  const staffMap = new Map<string, StaffMember>(data.staff.map((s) => [s.id, s]));

  // Bảng tra: `${positionId}_${date}_${shift}` -> Danh sách tên nhân sự ngắn
  const assignmentLookup = new Map<string, string[]>();
  for (const item of displayedAssignments) {
    const key = `${item.positionId}_${item.date}_${item.shift}`;
    const staffObj = staffMap.get(item.staffId);
    if (staffObj) {
      const shortName = getStaffShortName(staffObj.name);
      const list = assignmentLookup.get(key) ?? [];
      list.push(shortName);
      assignmentLookup.set(key, list);
    }
  }

  // Sắp xếp các phòng theo thứ tự tùy chỉnh hoặc theo thứ tự nhóm màu sắc và độ ưu tiên
  const sortedPositions = [...data.positions].sort((a, b) => {
    if (requestedOrder.length > 0) {
      const idxA = requestedOrder.indexOf(a.id);
      const idxB = requestedOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
    }
    const groupA = getPositionGroupColor(a);
    const groupB = getPositionGroupColor(b);
    if (groupA.order !== groupB.order) {
      return groupA.order - groupB.order;
    }
    return a.name.localeCompare(b.name, "vi");
  });

  // Khởi tạo ExcelJS Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NurseFlow";
  const ws = workbook.addWorksheet("Lịch tuần ma trận");

  // Thiết lập đường viền mỏng tiêu chuẩn Excel
  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };

  // --- HÀNG 1 & HÀNG 2: TIÊU ĐỀ BẢNG ---
  // Ô A1:A2: "Lịch tuần"
  ws.mergeCells(1, 1, 2, 1);
  const cellA1 = ws.getCell(1, 1);
  cellA1.value = "Lịch tuần";
  cellA1.font = { name: "Arial", size: 10, bold: true };
  cellA1.alignment = { horizontal: "center", vertical: "middle" };
  cellA1.border = borderThin;
  cellA1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };

  // Các cột ngày (B1.. theo từng ngày, merge Sáng/Chiều trên Row 1)
  let colIdx = 2;
  const dayColIndices: { date: string; morningCol: number; afternoonCol: number }[] = [];

  for (const day of days) {
    const parsedDate = parseISO(day.date);
    const dayLabel = `${format(parsedDate, "d/M")}\n${WEEKDAY_LABELS[day.dayOfWeek]}`;

    const mCol = colIdx;
    const aCol = colIdx + 1;
    dayColIndices.push({ date: day.date, morningCol: mCol, afternoonCol: aCol });

    // Merge hàng 1 cho 2 buổi của ngày đó
    ws.mergeCells(1, mCol, 1, aCol);
    const dayHeaderCell = ws.getCell(1, mCol);
    dayHeaderCell.value = dayLabel;
    dayHeaderCell.font = { name: "Arial", size: 9, bold: true };
    dayHeaderCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    dayHeaderCell.border = borderThin;
    dayHeaderCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F9FA" } };

    // Hàng 2: Sáng | Chiều
    const mCell = ws.getCell(2, mCol);
    mCell.value = "Sáng";
    mCell.font = { name: "Arial", size: 9, bold: false };
    mCell.alignment = { horizontal: "center", vertical: "middle" };
    mCell.border = borderThin;
    mCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    const aCell = ws.getCell(2, aCol);
    aCell.value = "Chiều";
    aCell.font = { name: "Arial", size: 9, bold: false };
    aCell.alignment = { horizontal: "center", vertical: "middle" };
    aCell.border = borderThin;
    aCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    colIdx += 2;
  }

  ws.getRow(1).height = 28;
  ws.getRow(2).height = 20;

  // --- HÀNG 3+: CÁC DÒNG PHÒNG LÀM VIỆC ---
  let currentRow = 3;

  for (const pos of sortedPositions) {
    const row = ws.getRow(currentRow);
    const groupColor = getPositionGroupColor(pos);

    // Cột 1: Tên phòng
    const posCell = row.getCell(1);
    posCell.value = pos.name;
    posCell.font = { name: "Arial", size: 9, bold: false };
    posCell.alignment = { horizontal: "left", vertical: "middle" };
    posCell.border = borderThin;
    posCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: groupColor.bg } };

    // Điền tên nhân sự vào từng ngày (Sáng / Chiều)
    for (const d of dayColIndices) {
      const mKey = `${pos.id}_${d.date}_morning`;
      const aKey = `${pos.id}_${d.date}_afternoon`;

      const mStaff = assignmentLookup.get(mKey) || [];
      const aStaff = assignmentLookup.get(aKey) || [];

      const mText = mStaff.join(", ");
      const aText = aStaff.join(", ");

      const mCell = row.getCell(d.morningCol);
      const aCell = row.getCell(d.afternoonCol);

      mCell.border = borderThin;
      aCell.border = borderThin;
      mCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: groupColor.bg } };
      aCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: groupColor.bg } };

      // [QWEN3] Tự động gộp ô (Merge) nếu cùng 1 người trực cả ngày Sáng & Chiều giống hệt ảnh mẫu
      if (mText && aText && mText === aText) {
        ws.mergeCells(currentRow, d.morningCol, currentRow, d.afternoonCol);
        mCell.value = mText;
        mCell.font = { name: "Arial", size: 9 };
        mCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      } else {
        mCell.value = mText || "";
        mCell.font = { name: "Arial", size: 9 };
        mCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

        aCell.value = aText || "";
        aCell.font = { name: "Arial", size: 9 };
        aCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      }
    }

    row.height = 22;
    currentRow++;
  }

  // --- DÒNG CUỐI CÙNG: DÒNG PHÉP (NGHỈ PHÉP) ---
  const leaveRow = ws.getRow(currentRow);
  const leaveTitleCell = leaveRow.getCell(1);
  leaveTitleCell.value = "Phép";
  leaveTitleCell.font = { name: "Arial", size: 9, bold: true };
  leaveTitleCell.alignment = { horizontal: "center", vertical: "middle" };
  leaveTitleCell.border = borderThin;
  leaveTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_COLORS.leave } };

  for (const d of dayColIndices) {
    // Tìm các nhân sự nghỉ phép trong ngày này, kèm ghi chú tắt lý do nghỉ
    const leavesOnDay = data.leaveRequests.filter((l) => l.date === d.date);
    const leaveNames = Array.from(
      new Set(
        leavesOnDay
          .map((l) => {
            const s = staffMap.get(l.staffId);
            if (!s) return "";
            const shortName = getStaffShortName(s.name);
            const reason = getLeaveReasonShortLabel(l.reason, l.note);
            return `${shortName} (${reason})`;
          })
          .filter(Boolean),
      ),
    );

    const leaveText = leaveNames.join(", ");

    // Gộp ô cả ngày cho dòng phép
    ws.mergeCells(currentRow, d.morningCol, currentRow, d.afternoonCol);
    const cell = leaveRow.getCell(d.morningCol);
    cell.value = leaveText || "";
    cell.font = { name: "Arial", size: 9 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = borderThin;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_COLORS.leave } };
  }

  leaveRow.height = 24;

  // Căn chỉnh chiều rộng cột
  ws.getColumn(1).width = 18;
  for (let c = 2; c < colIdx; c++) {
    ws.getColumn(c).width = 12.5;
  }

  // Xuất file Excel buffer
  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ma-tran-phan-phong-${weekStart}.xlsx"`,
    },
  });
}
