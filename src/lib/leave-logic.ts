import type { LeaveRecord, LeaveShift, LeaveReason, StaffMember } from "./types";

export const LEAVE_QUOTA_LIMIT = 2; // Định mức nghỉ phép thông thường: tối đa 2 người/buổi
export const STUDY_QUOTA_LIMIT = 3; // Định mức đi học: tối đa 3 người/buổi

/**
 * [QWEN3] Danh sách email của các nhân sự đặc thù được miễn tính vào cơ số giới hạn nghỉ phép
 * (BS. Trịnh Trung Tiến - Ban Giám đốc phụ trách phòng khám)
 */
export const EXEMPT_QUOTA_EMAILS = [
  "tienmed@gmail.com",
  "bstien@pnt.edu.vn",
];

/**
 * [QWEN3] Kiểm tra một nhân sự có được miễn cơ số tính toán giới hạn nghỉ phép hay không.
 * Các trường hợp được miễn:
 * 1. BS. Trịnh Trung Tiến (theo tên hoặc email)
 * 2. Nhân sự có mã chức danh Bác sĩ (code === "BS") hoặc Ban Giám đốc (role/notes)
 * 3. Ghi chú có tag [MIEN_QUOTA] hoặc [EXEMPT_QUOTA]
 */
export function isQuotaExemptStaff(staff?: StaffMember | null, staffId?: string, allStaff: StaffMember[] = []): boolean {
  const target = staff || allStaff.find((s) => s.id === staffId);
  if (!target) return false;

  const email = (target.email || "").trim().toLowerCase();
  if (EXEMPT_QUOTA_EMAILS.some((e) => e.toLowerCase() === email)) {
    return true;
  }

  const code = (target.code || "").trim().toUpperCase();
  if (code === "BS") {
    return true;
  }

  const name = (target.name || "").trim().toLowerCase();
  const normalizedName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

  if (normalizedName.includes("trinh trung tien") || normalizedName.includes("tienmed")) {
    return true;
  }

  const notes = (target.notes || "").toUpperCase();
  if (notes.includes("[MIEN_QUOTA]") || notes.includes("[EXEMPT_QUOTA]") || notes.includes("[BAN GIÁM ĐỐC]")) {
    return true;
  }

  return false;
}

export interface SlotEvaluationResult {
  status: "approved" | "pending";
  isAutoApproved: boolean;
  isAutoApprovedLeave: boolean;
  isAutoApprovedStudy: boolean;
  isQuotaExceeded: boolean;
  morningCount: number;
  afternoonCount: number;
  relevantCount: number;
  quotaLimit: number;
  existingStaffNames: string[];
}

/**
 * Đánh giá định mức ca nghỉ và quyết định phê duyệt tự động.
 * Quy tắc cốt lõi:
 * - Nghỉ phép ("phep"): Nếu là người đầu tiên hoặc người thứ 2 của buổi (morningCount hoặc afternoonCount < 2),
 *   hệ thống TỰ ĐỘNG DUYỆT NGAY (status = "approved").
 * - Nếu buổi đó đã có từ 2 người trở lên (người mới là người thứ 3 trở đi), chuyển sang "pending" (yêu cầu giải trình cấp thiết).
 * - Ca đi học ("dihoc"): Áp dụng định mức tối đa 3 người/buổi (buổi < 3 người tự động duyệt).
 * - Ca do Quản trị viên đăng ký hộ: Luôn được duyệt chính thức ngay lập tức.
 * - Ca bị từ chối ("rejected") hoặc ca của chính nhân sự mục tiêu không được tính vào định mức.
 * - Ca đi học không làm ảnh hưởng (không chiếm) định mức 2 người của ca nghỉ phép thông thường.
 */
export function evaluateSlotQuota(params: {
  slot: { date: string; shift: LeaveShift; reason: LeaveReason };
  existingLeaves: LeaveRecord[];
  targetStaffId: string;
  allStaff?: StaffMember[];
  isRegisteredByAdmin?: boolean;
}): SlotEvaluationResult {
  const { slot, existingLeaves, targetStaffId, allStaff = [], isRegisteredByAdmin = false } = params;

  // [QWEN3] Kiểm tra nếu nhân sự mục tiêu là người được miễn cơ số (BS. Trịnh Trung Tiến / Bác sĩ):
  // Luôn tự động duyệt chính thức, không bao giờ bị tính vượt định mức hay chặn đăng ký.
  const targetStaff = allStaff.find((s) => s.id === targetStaffId);
  const isTargetExempt = isQuotaExemptStaff(targetStaff, targetStaffId, allStaff);

  if (isRegisteredByAdmin || isTargetExempt) {
    return {
      status: "approved",
      isAutoApproved: isTargetExempt,
      isAutoApprovedLeave: isTargetExempt && slot.reason !== "dihoc",
      isAutoApprovedStudy: isTargetExempt && slot.reason === "dihoc",
      isQuotaExceeded: false,
      morningCount: 0,
      afternoonCount: 0,
      relevantCount: 0,
      quotaLimit: slot.reason === "dihoc" ? STUDY_QUOTA_LIMIT : LEAVE_QUOTA_LIMIT,
      existingStaffNames: [],
    };
  }

  const isStudy = slot.reason === "dihoc";
  const quotaLimit = isStudy ? STUDY_QUOTA_LIMIT : LEAVE_QUOTA_LIMIT;

  // Lọc các bản ghi nghỉ của nhân sự khác trong cùng ngày (loại bỏ rejected, chính staff, và nhân sự được miễn quota như BS. Tiến)
  // Với ca nghỉ phép: không tính ca đi học vào định mức 2 người
  const sameDayLeaves = existingLeaves.filter((l) => {
    if (l.date !== slot.date) return false;
    if (l.staffId === targetStaffId) return false;
    if (l.status === "rejected") return false;
    if (!isStudy && l.reason === "dihoc") return false;
    // [QWEN3] Không tính ca nghỉ của BS. Trịnh Trung Tiến / Bác sĩ vào cơ số giới hạn
    if (isQuotaExemptStaff(undefined, l.staffId, allStaff)) return false;
    return true;
  });

  let morningCount = 0;
  let afternoonCount = 0;
  const morningStaffNames: string[] = [];
  const afternoonStaffNames: string[] = [];

  for (const l of sameDayLeaves) {
    const person = allStaff.find((s) => s.id === l.staffId);
    const staffName = person?.name || l.staffId;

    if (l.shift === "full-day") {
      morningCount++;
      afternoonCount++;
      if (!morningStaffNames.includes(staffName)) morningStaffNames.push(staffName);
      if (!afternoonStaffNames.includes(staffName)) afternoonStaffNames.push(staffName);
    } else if (l.shift === "morning") {
      morningCount++;
      if (!morningStaffNames.includes(staffName)) morningStaffNames.push(staffName);
    } else if (l.shift === "afternoon") {
      afternoonCount++;
      if (!afternoonStaffNames.includes(staffName)) afternoonStaffNames.push(staffName);
    }
  }

  let isQuotaExceeded = false;
  let relevantCount = 0;
  let existingStaffNames: string[] = [];

  if (slot.shift === "morning") {
    relevantCount = morningCount;
    isQuotaExceeded = morningCount >= quotaLimit;
    existingStaffNames = morningStaffNames;
  } else if (slot.shift === "afternoon") {
    relevantCount = afternoonCount;
    isQuotaExceeded = afternoonCount >= quotaLimit;
    existingStaffNames = afternoonStaffNames;
  } else {
    // Ca cả ngày (full-day): Vượt định mức nếu một trong hai buổi đã đủ quota
    relevantCount = Math.max(morningCount, afternoonCount);
    isQuotaExceeded = morningCount >= quotaLimit || afternoonCount >= quotaLimit;
    // Hợp nhất danh sách nhân sự không trùng lặp
    existingStaffNames = Array.from(new Set([...morningStaffNames, ...afternoonStaffNames]));
  }

  const isAutoApproved = !isQuotaExceeded;
  const isAutoApprovedLeave = !isStudy && isAutoApproved;
  const isAutoApprovedStudy = isStudy && isAutoApproved;

  return {
    status: isAutoApproved ? "approved" : "pending",
    isAutoApproved,
    isAutoApprovedLeave,
    isAutoApprovedStudy,
    isQuotaExceeded,
    morningCount,
    afternoonCount,
    relevantCount,
    quotaLimit,
    existingStaffNames,
  };
}

/**
 * [QWEN3] Kiểm tra một đơn nghỉ có được xem là Đã duyệt hiệu lực hay không.
 * Quy tắc:
 * 1. Đơn có status === "approved" hoặc không có status (mặc định cũ).
 * 2. Đơn ở trạng thái "pending" (Chờ duyệt) nhưng ngày nghỉ thuộc QUÁ KHỨ (date < hôm nay theo giờ VN):
 *    Xem như đã duyệt trên thực tế vì ca nghỉ đã diễn ra.
 */
export function isEffectiveApprovedLeave(leave: { date: string; status?: string; shift?: string }): boolean {
  if (leave.status === "rejected") return false;
  if (leave.status === "approved" || !leave.status) return true;
  if (leave.status === "pending") {
    const vnToday = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }))
      .toISOString()
      .split("T")[0];
    return leave.date < vnToday;
  }
  return false;
}

