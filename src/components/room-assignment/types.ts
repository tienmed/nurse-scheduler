import type { ShiftType, Position } from "@/lib/types";

// [QWEN3] Äá»‹nh nghÄ©a kiá»ƒu dá»¯ liá»‡u cho module PhÃ¢n phÃ²ng kÃ©o tháº£
export interface SlotKeyInfo {
  date: string;
  shift: ShiftType;
  dayOfWeek: number;
}

export interface RoomAssignmentRecord {
  positionId: string;
  staffId: string;
}

// MÃ u sáº¯c nháº­n diá»‡n cho tá»«ng khu vá»±c
export interface AreaStyle {
  bg: string;
  border: string;
  badge: string;
  text: string;
  lightBg: string;
}

export const AREA_STYLES: Record<string, AreaStyle> = {
  "Sáº£nh": { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-600", text: "text-emerald-800", lightBg: "bg-emerald-100/70" },
  "Trá»‡t": { bg: "bg-sky-50", border: "border-sky-200", badge: "bg-sky-600", text: "text-sky-800", lightBg: "bg-sky-100/70" },
  "Táº§ng 1": { bg: "bg-violet-50", border: "border-violet-200", badge: "bg-violet-600", text: "text-violet-800", lightBg: "bg-violet-100/70" },
  "Táº§ng 2": { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-600", text: "text-amber-800", lightBg: "bg-amber-100/70" },
  "Ngoáº¡i trÃº": { bg: "bg-rose-50", border: "border-rose-200", badge: "bg-rose-600", text: "text-rose-800", lightBg: "bg-rose-100/70" },
  "Cáº­n lÃ¢m sÃ ng": { bg: "bg-indigo-50", border: "border-indigo-200", badge: "bg-indigo-600", text: "text-indigo-800", lightBg: "bg-indigo-100/70" },
  "Thá»§ thuáº­t": { bg: "bg-teal-50", border: "border-teal-200", badge: "bg-teal-600", text: "text-teal-800", lightBg: "bg-teal-100/70" },
  "HÃ nh chÃ­nh": { bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-600", text: "text-slate-800", lightBg: "bg-slate-200/70" },
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
  if (lower.includes("trá»‡t")) {
    return AREA_STYLES["Trá»‡t"];
  }
  if (lower.includes("táº§ng 1")) {
    return AREA_STYLES["Táº§ng 1"];
  }
  if (lower.includes("táº§ng 2")) {
    return AREA_STYLES["Táº§ng 2"];
  }
  if (lower.includes("sáº£nh") || lower.includes("tiáº¿p nháº­n")) {
    return AREA_STYLES["Sáº£nh"];
  }
  if (lower.includes("ngoáº¡i trÃº")) {
    return AREA_STYLES["Ngoáº¡i trÃº"];
  }
  if (lower.includes("cáº­n lÃ¢m sÃ ng")) {
    return AREA_STYLES["Cáº­n lÃ¢m sÃ ng"];
  }
  if (lower.includes("thá»§ thuáº­t")) {
    return AREA_STYLES["Thá»§ thuáº­t"];
  }
  if (lower.includes("hÃ nh chÃ­nh")) {
    return AREA_STYLES["HÃ nh chÃ­nh"];
  }
  for (const [key, val] of Object.entries(AREA_STYLES)) {
    if (lower.includes(key.toLowerCase())) {
      return val;
    }
  }
  return DEFAULT_AREA_STYLE;
}

// [QWEN3] RÃºt gá»n tÃªn nhÃ¢n sá»± thÃ nh tÃªn gá»i thÃ¢n máº­t / tÃªn chÃ­nh giá»‘ng nhÆ° trong áº£nh máº«u Excel
export function getStaffShortName(fullName: string): string {
  if (!fullName) return "";
  const trimmed = fullName.trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes("lyna")) return "Lyna";

  const compoundNames = [
    "PhÃºc Anh",
    "BÃ­ch Tháº£o",
    "BÃ­nh Tháº£o",
    "Kim Hoa",
    "Kim LiÃªn",
    "Kim Äiá»‡p",
    "TÃº Trang",
    "Má»¹ NhiÃªn",
    "Ngá»c Háº¡nh",
    "NhÃ¢n NghÄ©a",
    "ThÃºy Háº±ng",
  ];
  for (const comp of compoundNames) {
    if (trimmed.endsWith(comp)) return comp;
  }

  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

// [QWEN3] Äá»‹nh dáº¡ng gá»n cho tháº» nhÃ¢n viÃªn trong ma tráº­n phÃ¢n phÃ²ng: "ÄD TÃªn"
export function getStaffMatrixLabel(fullName: string): string {
  const shortName = getStaffShortName(fullName);
  if (!shortName) return "";
  if (shortName.startsWith("ÄD ") || shortName.startsWith("BS ")) return shortName;
  return `ÄD ${shortName}`;
}

// [QWEN3] RÃºt gá»n lÃ½ do nghá»‰: "phÃ©p", "á»‘m", "há»c", "khÃ¡c"
export function getLeaveReasonShortLabel(reason?: string, note?: string): string {
  if (!reason) {
    if (note && note.trim()) return note.trim().slice(0, 8);
    return "phÃ©p";
  }
  const r = reason.toLowerCase().trim();
  if (r === "om" || r === "á»‘m" || r.includes("á»‘m") || r.includes("bá»‡nh")) return "á»‘m";
  if (r === "dihoc" || r === "há»c" || r.includes("há»c")) return "há»c";
  if (r === "phep" || r === "phÃ©p" || r.includes("phÃ©p")) return "phÃ©p";
  if (note && note.trim()) return note.trim().slice(0, 8);
  return "phÃ©p";
}

// [QWEN3] Tháº» phÃ©p ghi chÃº táº¯t lÃ½ do nghá»‰: "ÄD Nga (á»‘m)", "ÄD BÃ­ch Tháº£o (phÃ©p)", "ÄD NghÄ©a (há»c)"
export function getStaffLeaveLabel(fullName: string, reason?: string, note?: string): string {
  const matrixLabel = getStaffMatrixLabel(fullName);
  const reasonShort = getLeaveReasonShortLabel(reason, note);
  return `${matrixLabel} (${reasonShort})`;
}

// [QWEN3] Báº£ng mÃ u riÃªng biá»‡t cho tá»«ng nhÃ¢n sá»± Ä‘á»ƒ dá»… nháº­n diá»‡n trong ma tráº­n
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

// MÃ u sáº¯c phÃ¢n nhÃ³m phÃ²ng chuáº©n theo áº£nh máº«u Excel thá»±c táº¿
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

  // 1. NhÃ³m VÃ ng: Da liá»…u, CSD, Máº¯t, TMH, TÃ¢m lÃ½, Tim máº¡ch, YHCT (hoáº·c Táº§ng 1)
  if (
    name.includes("da liá»…u") ||
    name.includes("chÄƒm sÃ³c da") ||
    name.includes("csd") ||
    name.includes("máº¯t") ||
    name.includes("tmh") ||
    name.includes("tÃ¢m lÃ½") ||
    name.includes("tháº§n kinh") ||
    name.includes("tim máº¡ch") ||
    name.includes("yhct") ||
    area.includes("táº§ng 1")
  ) {
    return {
      name: "ChuyÃªn khoa",
      badgeBg: "bg-amber-300",
      badgeText: "text-amber-950",
      rowBg: "bg-amber-50/40",
      order: 1,
    };
  }

  // 2. NhÃ³m Cam: ChuyÃªn gia, D.á»©/MD
  if (name.includes("chuyÃªn gia") || name.includes("miá»…n dá»‹ch") || name.includes("d.á»©")) {
    return {
      name: "ChuyÃªn gia",
      badgeBg: "bg-orange-200",
      badgeText: "text-orange-950",
      rowBg: "bg-orange-50/40",
      order: 3,
    };
  }

  // 3. NhÃ³m Há»“ng: Tiáº¿p nháº­n
  if (name.includes("tiáº¿p nháº­n")) {
    return {
      name: "Tiáº¿p nháº­n",
      badgeBg: "bg-pink-200",
      badgeText: "text-pink-950",
      rowBg: "bg-pink-50/40",
      order: 4,
    };
  }

  // 4. NhÃ³m Xanh lÃ¡: Nháº­p liá»‡u KSK, KHNV, Thanh trÃ¹ng
  if (name.includes("nháº­p liá»‡u") || name.includes("ksk") || name.includes("khnv") || name.includes("thanh trÃ¹ng")) {
    return {
      name: "KhÃ¡m sá»©c khá»e & NV",
      badgeBg: "bg-emerald-200",
      badgeText: "text-emerald-950",
      rowBg: "bg-emerald-50/40",
      order: 5,
    };
  }

  // 5. NhÃ³m Xanh dÆ°Æ¡ng: KhÃ¡m Ä‘a khoa & Cáº­n lÃ¢m sÃ ng (SiÃªu Ã¢m, Cáº¥p cá»©u, CXK, Ná»™i, Ngoáº¡i, Sáº£n, ECG, Äo sinh hiá»‡u...)
  return {
    name: "KhÃ¡m & Cáº­n lÃ¢m sÃ ng",
    badgeBg: "bg-sky-200",
    badgeText: "text-sky-950",
    rowBg: "bg-sky-50/40",
    order: 2,
  };
}
