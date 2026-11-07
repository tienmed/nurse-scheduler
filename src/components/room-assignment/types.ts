import type { ShiftType, Position } from "@/lib/types";

// [QWEN3] Định nghĩa kiểu dữ liệu cho module Phân phòng kéo thả
export interface SlotKeyInfo {
  date: string;
  shift: ShiftType;
  dayOfWeek: number;
}

export interface RoomAssignmentRecord {
  positionId: string;
  staffId: string;
}

// Màu sắc nhận diện cho từng khu vực
export interface AreaStyle {
  bg: string;
  border: string;
  badge: string;
  text: string;
  lightBg: string;
}

export const AREA_STYLES: Record<string, AreaStyle> = {
  "Sảnh": { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-600", text: "text-emerald-800", lightBg: "bg-emerald-100/70" },
  "Trệt": { bg: "bg-sky-50", border: "border-sky-200", badge: "bg-sky-600", text: "text-sky-800", lightBg: "bg-sky-100/70" },
  "Tầng 1": { bg: "bg-violet-50", border: "border-violet-200", badge: "bg-violet-600", text: "text-violet-800", lightBg: "bg-violet-100/70" },
  "Tầng 2": { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-600", text: "text-amber-800", lightBg: "bg-amber-100/70" },
  "Ngoại trú": { bg: "bg-rose-50", border: "border-rose-200", badge: "bg-rose-600", text: "text-rose-800", lightBg: "bg-rose-100/70" },
  "Cận lâm sàng": { bg: "bg-indigo-50", border: "border-indigo-200", badge: "bg-indigo-600", text: "text-indigo-800", lightBg: "bg-indigo-100/70" },
  "Thủ thuật": { bg: "bg-teal-50", border: "border-teal-200", badge: "bg-teal-600", text: "text-teal-800", lightBg: "bg-teal-100/70" },
  "Hành chính": { bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-600", text: "text-slate-800", lightBg: "bg-slate-200/70" },
};

export const DEFAULT_AREA_STYLE: AreaStyle = {
  bg: "bg-slate-50",
  border: "border-slate-200",
  badge: "bg-slate-600",
  text: "text-slate-800",
  lightBg: "bg-slate-100",
};

export function getAreaStyle(areaName?: string): AreaStyle {
  if (!areaName) return DEFAULT_AREA_STYLE;
  const lower = areaName.toLowerCase().trim();
  if (lower.includes("trệt")) {
    return AREA_STYLES["Trệt"];
  }
  if (lower.includes("tầng 1")) {
    return AREA_STYLES["Tầng 1"];
  }
  if (lower.includes("tầng 2")) {
    return AREA_STYLES["Tầng 2"];
  }
  if (lower.includes("sảnh") || lower.includes("tiếp nhận")) {
    return AREA_STYLES["Sảnh"];
  }
  if (lower.includes("ngoại trú")) {
    return AREA_STYLES["Ngoại trú"];
  }
  if (lower.includes("cận lâm sàng")) {
    return AREA_STYLES["Cận lâm sàng"];
  }
  if (lower.includes("thủ thuật")) {
    return AREA_STYLES["Thủ thuật"];
  }
  if (lower.includes("hành chính")) {
    return AREA_STYLES["Hành chính"];
  }
  for (const [key, val] of Object.entries(AREA_STYLES)) {
    if (lower.includes(key.toLowerCase())) {
      return val;
    }
  }
  return DEFAULT_AREA_STYLE;
}

// [QWEN3] Rút gọn tên nhân sự thành tên gọi thân mật / tên chính giống như trong ảnh mẫu Excel
export function getStaffShortName(fullName: string): string {
  if (!fullName) return "";
  const trimmed = fullName.trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes("lyna")) return "Lyna";

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
    "Thúy Hằng",
  ];
  for (const comp of compoundNames) {
    if (trimmed.endsWith(comp)) return comp;
  }

  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

// [QWEN3] Định dạng gọn cho thẻ nhân viên trong ma trận phân phòng: "ĐD Tên"
export function getStaffMatrixLabel(fullName: string): string {
  const shortName = getStaffShortName(fullName);
  if (!shortName) return "";
  if (shortName.startsWith("ĐD ") || shortName.startsWith("BS ")) return shortName;
  return `ĐD ${shortName}`;
}

// [QWEN3] Rút gọn lý do nghỉ: "phép", "ốm", "học", "khác"
export function getLeaveReasonShortLabel(reason?: string, note?: string): string {
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

// [QWEN3] Thẻ phép ghi chú tắt lý do nghỉ: "ĐD Nga (ốm)", "ĐD Bích Thảo (phép)", "ĐD Nghĩa (học)"
export function getStaffLeaveLabel(fullName: string, reason?: string, note?: string): string {
  const matrixLabel = getStaffMatrixLabel(fullName);
  const reasonShort = getLeaveReasonShortLabel(reason, note);
  return `${matrixLabel} (${reasonShort})`;
}

// [QWEN3] Bảng màu riêng biệt cho từng nhân sự để dễ nhận diện trong ma trận
export interface StaffColorStyle {
  bg: string;
  border: string;
  text: string;
  avatarBg: string;
  avatarText: string;
  dotColor: string;
}

export const STAFF_COLOR_PALETTE: StaffColorStyle[] = [
  { bg: "bg-teal-50", border: "border-teal-300", text: "text-teal-950", avatarBg: "bg-teal-600", avatarText: "text-white", dotColor: "bg-teal-500" },
  { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-950", avatarBg: "bg-indigo-600", avatarText: "text-white", dotColor: "bg-indigo-500" },
  { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-950", avatarBg: "bg-rose-600", avatarText: "text-white", dotColor: "bg-rose-500" },
  { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-950", avatarBg: "bg-amber-600", avatarText: "text-white", dotColor: "bg-amber-500" },
  { bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-950", avatarBg: "bg-sky-600", avatarText: "text-white", dotColor: "bg-sky-500" },
  { bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-950", avatarBg: "bg-violet-600", avatarText: "text-white", dotColor: "bg-violet-500" },
  { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-950", avatarBg: "bg-emerald-600", avatarText: "text-white", dotColor: "bg-emerald-500" },
  { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-950", avatarBg: "bg-orange-600", avatarText: "text-white", dotColor: "bg-orange-500" },
  { bg: "bg-fuchsia-50", border: "border-fuchsia-300", text: "text-fuchsia-950", avatarBg: "bg-fuchsia-600", avatarText: "text-white", dotColor: "bg-fuchsia-500" },
  { bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-950", avatarBg: "bg-cyan-600", avatarText: "text-white", dotColor: "bg-cyan-500" },
  { bg: "bg-lime-50", border: "border-lime-300", text: "text-lime-950", avatarBg: "bg-lime-600", avatarText: "text-white", dotColor: "bg-lime-500" },
  { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-950", avatarBg: "bg-purple-600", avatarText: "text-white", dotColor: "bg-purple-500" },
  { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-950", avatarBg: "bg-blue-600", avatarText: "text-white", dotColor: "bg-blue-500" },
  { bg: "bg-pink-50", border: "border-pink-300", text: "text-pink-950", avatarBg: "bg-pink-600", avatarText: "text-white", dotColor: "bg-pink-500" },
  { bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-950", avatarBg: "bg-yellow-600", avatarText: "text-white", dotColor: "bg-yellow-500" },
  { bg: "bg-zinc-100", border: "border-zinc-300", text: "text-zinc-950", avatarBg: "bg-zinc-600", avatarText: "text-white", dotColor: "bg-zinc-500" },
];

export function getStaffColorStyle(identifier: string): StaffColorStyle {
  if (!identifier) return STAFF_COLOR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % STAFF_COLOR_PALETTE.length;
  return STAFF_COLOR_PALETTE[index];
}

// Màu sắc phân nhóm phòng chuẩn theo ảnh mẫu Excel thực tế
export interface RoomGroupInfo {
  name: string;
  badgeBg: string;
  badgeText: string;
  rowBg: string;
  order: number;
}

export function getRoomGroupInfo(pos: Position): RoomGroupInfo {
  const name = pos.name.toLowerCase();
  const area = (pos.area || "").toLowerCase();

  // 1. Nhóm Vàng: Da liễu, CSD, Mắt, TMH, Tâm lý, Tim mạch, YHCT (hoặc Tầng 1)
  if (
    name.includes("da liễu") ||
    name.includes("chăm sóc da") ||
    name.includes("csd") ||
    name.includes("mắt") ||
    name.includes("tmh") ||
    name.includes("tâm lý") ||
    name.includes("thần kinh") ||
    name.includes("tim mạch") ||
    name.includes("yhct") ||
    area.includes("tầng 1")
  ) {
    return {
      name: "Chuyên khoa",
      badgeBg: "bg-amber-300",
      badgeText: "text-amber-950",
      rowBg: "bg-amber-50/40",
      order: 1,
    };
  }

  // 2. Nhóm Cam: Chuyên gia, D.ứ/MD
  if (name.includes("chuyên gia") || name.includes("miễn dịch") || name.includes("d.ứ")) {
    return {
      name: "Chuyên gia",
      badgeBg: "bg-orange-200",
      badgeText: "text-orange-950",
      rowBg: "bg-orange-50/40",
      order: 3,
    };
  }

  // 3. Nhóm Hồng: Tiếp nhận
  if (name.includes("tiếp nhận")) {
    return {
      name: "Tiếp nhận",
      badgeBg: "bg-pink-200",
      badgeText: "text-pink-950",
      rowBg: "bg-pink-50/40",
      order: 4,
    };
  }

  // 4. Nhóm Xanh lá: Nhập liệu KSK, KHNV, Thanh trùng
  if (name.includes("nhập liệu") || name.includes("ksk") || name.includes("khnv") || name.includes("thanh trùng")) {
    return {
      name: "Khám sức khỏe & NV",
      badgeBg: "bg-emerald-200",
      badgeText: "text-emerald-950",
      rowBg: "bg-emerald-50/40",
      order: 5,
    };
  }

  // 5. Nhóm Xanh dương: Khám đa khoa & Cận lâm sàng (Siêu âm, Cấp cứu, CXK, Nội, Ngoại, Sản, ECG, Đo sinh hiệu...)
  return {
    name: "Khám & Cận lâm sàng",
    badgeBg: "bg-sky-200",
    badgeText: "text-sky-950",
    rowBg: "bg-sky-50/40",
    order: 2,
  };
}
