import type { LeaveRecord, LeaveShift, LeaveReason, StaffMember } from "./types";

export const LEAVE_QUOTA_LIMIT = 2; // Định mức nghỉ phép thông thường: tối đa 2 người/buổi
export const STUDY_QUOTA_LIMIT = 3; // Định mức đi học: tối đa 3 người/buổi

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

  if (isRegisteredByAdmin) {
    return {
      status: "approved",
      isAutoApproved: false,
      isAutoApprovedLeave: false,
      isAutoApprovedStudy: false,
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

  // Lọc các bản ghi nghỉ của nhân sự khác trong cùng ngày (loại bỏ rejected và chính staff)
  // Với ca nghỉ phép: không tính ca đi học vào định mức 2 người
  const sameDayLeaves = existingLeaves.filter((l) => {
    if (l.date !== slot.date) return false;
    if (l.staffId === targetStaffId) return false;
    if (l.status === "rejected") return false;
    if (!isStudy && l.reason === "dihoc") return false;
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
