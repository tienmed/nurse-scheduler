/**
 * [QWEN3] Quản lý danh sách và kiểm tra nhân sự thuộc diện đi học
 * - Tiêu chí 1: Ghi chú trong bảng staff có chứa tag [DI_HOC] hoặc [DI HOC] (không phân biệt hoa thường)
 * - Tiêu chí 2: Cấu hình mặc định hệ thống (ban đầu bao gồm ĐD Nghĩa - nghiadn.pk@pnt.edu.vn)
 */

import type { StaffMember } from "@/lib/types";

// Danh sách email nhân sự đi học mặc định của hệ thống
export const DEFAULT_STUDY_EMAILS = [
  "nghiadn.pk@pnt.edu.vn",
];

/**
 * Kiểm tra một nhân sự có thuộc diện đi học hay không
 */
export function isStudyStaff(staff?: StaffMember | null): boolean {
  if (!staff) return false;

  // 1. Kiểm tra theo email trong danh sách mặc định
  const email = (staff.email || "").toLowerCase().trim();
  if (DEFAULT_STUDY_EMAILS.some((e) => e.toLowerCase() === email)) {
    return true;
  }

  // 2. Kiểm tra theo cờ [DI_HOC] trong ghi chú (cột notes)
  const notes = (staff.notes || "").toUpperCase();
  if (notes.includes("[DI_HOC]") || notes.includes("[DI HOC]") || notes.includes("[ĐI HỌC]")) {
    return true;
  }

  return false;
}

/**
 * Lấy danh sách ID của tất cả nhân sự đang thuộc diện đi học
 */
export function getStudyStaffIds(staffList: StaffMember[]): string[] {
  return staffList.filter((s) => isStudyStaff(s)).map((s) => s.id);
}
