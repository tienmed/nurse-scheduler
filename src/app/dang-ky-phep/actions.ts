"use server";

import { format, parseISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppData, invalidateAppDataCache, upsertManyLeaveRequests, calculateYearlyApprovedLeaveStats } from "@/lib/repository";
import { getUserContext } from "@/lib/session";
import {
  sendLeaveApprovalRequestEmail,
  sendLeaveApprovedNotificationEmail,
  getUpcoming7DaysApprovedLeaves,
} from "@/lib/email-service";
import type { LeaveReason, LeaveShift } from "@/lib/types";

export interface RegisterSlotInput {
  date: string;
  shift: LeaveShift;
  reason: LeaveReason;
  note?: string;
  isUrgent?: boolean;
}

function isRedirectError(error: unknown): boolean {
  const err = error as { message?: string; digest?: string };
  return err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith("NEXT_REDIRECT") === true;
}

/**
 * [QWEN3] Server Action xử lý đăng ký nghỉ phép linh động từ Cổng Portal
 * - Bắt buộc đúng email trong hệ thống
 * - Hỗ trợ chế độ Admin đăng ký hộ cho nhân sự khác (tự động Duyệt chính thức ngay)
 * - Kiểm tra định mức từng ca
 * - Ràng buộc phân quyền loại nghỉ: Nhân sự thường chỉ được đăng ký Nghỉ phép (phep), loại bỏ Việc riêng/Khác
 * - Nếu nhân viên tự gửi: Ghi nhận tạm (status: pending) và gửi email duyệt 1 chạm tới tienmed@gmail.com
 * - Nếu Admin đăng ký hộ: Ghi nhận duyệt ngay (status: approved) và gửi email xác thực tới điều dưỡng
 */
export async function submitLeavePortalAction(formData: FormData) {
  try {
    const { user } = await getUserContext({ required: false });
    if (!user?.email) {
      throw new Error("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
    }

    const data = await getAppData();
    let currentStaff = data.staff.find(
      (s) => s.email.toLowerCase() === user.email.toLowerCase() && s.active !== false,
    );

    // [QWEN3] Cho phép tài khoản admin@nurseflow.local chạy thử nghiệm
    if (!currentStaff && user.email.toLowerCase() === "admin@nurseflow.local") {
      currentStaff = {
        id: "staff-admin-demo",
        name: user.name || "Quản trị viên (Demo)",
        code: "ADMIN",
        email: "admin@nurseflow.local",
        role: "admin",
        positionIds: [],
        active: true,
        prefersOvertime: false,
      };
    }

    if (!currentStaff) {
      throw new Error("Tài khoản của bạn không thuộc danh sách nhân sự hoạt động trong hệ thống.");
    }

    const isEditorOrAdmin =
      user.role === "admin" ||
      user.role === "coordinator" ||
      user.email.toLowerCase() === "admin@nurseflow.local";

    // [QWEN3] Xử lý mục tiêu nhân sự (Đăng ký cho chính mình hoặc Admin đăng ký hộ)
    const targetStaffId = formData.get("targetStaffId") as string;
    let targetStaff = currentStaff;
    let isRegisteredByAdmin = false;

    if (targetStaffId && targetStaffId !== currentStaff.id) {
      if (!isEditorOrAdmin) {
        throw new Error("Chỉ Quản trị viên mới có quyền đăng ký nghỉ phép hộ cho nhân sự khác.");
      }
      const found = data.staff.find((s) => s.id === targetStaffId);
      if (!found) {
        throw new Error("Không tìm thấy nhân sự được chọn trong hệ thống.");
      }
      targetStaff = found;
      isRegisteredByAdmin = true;
    }

    const slotsRaw = formData.get("slotsJson") as string;
    const isUrgent = formData.get("isUrgent") === "true";
    const urgentNote = (formData.get("urgentNote") as string || "").trim();

    if (!slotsRaw) {
      throw new Error("Vui lòng chọn ít nhất một ngày nghỉ.");
    }

    let slots: RegisterSlotInput[] = [];
    try {
      slots = JSON.parse(slotsRaw);
    } catch {
      throw new Error("Dữ liệu ca nghỉ không đúng định dạng.");
    }

    if (!Array.isArray(slots) || slots.length === 0) {
      throw new Error("Danh sách ca nghỉ trống. Vui lòng chọn ít nhất một ngày.");
    }

    if (slots.length > 30) {
      throw new Error("Mỗi phiếu chỉ được đăng ký tối đa 30 ca nghỉ.");
    }

    // [QWEN3] Phân quyền loại nghỉ:
    // - Điều dưỡng tự làm chỉ được đăng ký loại "phep" (Nghỉ phép).
    // - Quản trị viên (hoặc đăng ký hộ) được đăng ký cả "phep", "om", "dihoc".
    // - Loại "khac" (Việc riêng / Khác) đã bị loại bỏ hoàn toàn.
    for (const slot of slots) {
      if (!isEditorOrAdmin && slot.reason !== "phep") {
        throw new Error("Điều dưỡng chỉ được đăng ký loại Nghỉ phép. Các trường hợp Đi học hoặc Nghỉ ốm do Quản trị viên trực tiếp ghi nhận.");
      }
      if (slot.reason === "khac") {
        throw new Error("Lý do 'Việc riêng / Khác' không còn được áp dụng. Vui lòng chọn 'Nghỉ phép'.");
      }
    }

    // Kiểm tra định mức cho từng ca (loại trừ chính nhân sự mục tiêu)
    let hasQuotaExceeded = false;
    const exceededDates: string[] = [];

    for (const slot of slots) {
      if (!slot.date || !slot.shift) {
        throw new Error("Thiếu thông tin ngày hoặc ca làm việc.");
      }

      const slotDate = parseISO(slot.date);
      const dayOfWeek = slotDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const formattedDate = format(slotDate, "dd/MM/yyyy");
        const dayName = dayOfWeek === 6 ? "Thứ 7" : "Chủ nhật";
        throw new Error(
          `Ngày ${formattedDate} (${dayName}) không áp dụng nghỉ phép. Nghỉ phép chỉ áp dụng từ Thứ 2 đến Thứ 6.`
        );
      }

      // Đếm số người đã đăng ký cùng ca (loại trừ đi học và ca của chính nhân sự mục tiêu)
      const sameDayLeaves = data.leaveRequests.filter(
        (l) => l.date === slot.date && l.reason !== "dihoc" && l.staffId !== targetStaff.id && l.status !== "rejected",
      );

      let morningCount = 0;
      let afternoonCount = 0;

      for (const l of sameDayLeaves) {
        if (l.shift === "full-day") {
          morningCount++;
          afternoonCount++;
        } else if (l.shift === "morning") {
          morningCount++;
        } else if (l.shift === "afternoon") {
          afternoonCount++;
        }
      }

      const isMorningExceeded = (slot.shift === "full-day" || slot.shift === "morning") && morningCount >= 2;
      const isAfternoonExceeded = (slot.shift === "full-day" || slot.shift === "afternoon") && afternoonCount >= 2;

      if (isMorningExceeded || isAfternoonExceeded) {
        hasQuotaExceeded = true;
        slot.isUrgent = true;
        exceededDates.push(`${slot.date} (${slot.shift === "morning" ? "Sáng" : slot.shift === "afternoon" ? "Chiều" : "Cả ngày"})`);
      }
    }

    // Nếu vượt quota mà người dùng tự làm mà chưa xác nhận cấp thiết hoặc chưa điền lý do
    if (hasQuotaExceeded && (!isUrgent || !urgentNote) && !isRegisteredByAdmin) {
      throw new Error(
        `Các ca sau đã có từ 2 nhân sự đăng ký: ${exceededDates.join(", ")}. Vui lòng đánh dấu "Nghỉ cấp thiết" và điền lý do giải trình để gửi duyệt.`,
      );
    }

    // Tính thống kê phép năm của nhân sự mục tiêu
    const yearlyStats = calculateYearlyApprovedLeaveStats(targetStaff.id, data.leaveRequests);

    // Sinh mã approveToken bảo mật
    const approveToken = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // Chuẩn bị danh sách bản ghi lưu Google Sheets
    const newEntries = slots.map((slot) => {
      let noteContent = slot.note || "";
      if (isUrgent && urgentNote) {
        noteContent = `[CẤP THIẾT] ${urgentNote}${noteContent ? ` - ${noteContent}` : ""}`;
      }
      if (isRegisteredByAdmin) {
        noteContent = `[Admin ${currentStaff.name} đăng ký hộ] ${noteContent}`.trim();
      }

      return {
        staffId: targetStaff.id,
        date: slot.date,
        shift: slot.shift,
        reason: slot.reason || "phep",
        note: noteContent,
        status: isRegisteredByAdmin ? ("approved" as const) : ("pending" as const),
        approveToken,
        createdAt: nowIso,
      };
    });

    // Lưu vào Google Sheets
    await upsertManyLeaveRequests(newEntries);
    invalidateAppDataCache();

    // Revalidate paths
    ["/dang-ky-phep", "/leave", "/schedule", "/"].forEach((p) => {
      revalidatePath(p);
    });

    // Lấy danh sách 7 ngày tới đã được duyệt để người xem nhanh trong email
    const upcoming7DaysLeaves = getUpcoming7DaysApprovedLeaves(data.leaveRequests, data.staff);

    // [QWEN3] Phân luồng gửi email:
    // Trường hợp 1: Admin đăng ký hộ -> Đơn đã Duyệt chính thức ngay -> Gửi email xác thực tới nhân sự được đăng ký hộ (kèm BCC ĐD Nghĩa)
    if (isRegisteredByAdmin) {
      const emailResult = await sendLeaveApprovedNotificationEmail({
        staff: targetStaff,
        leaveItems: slots.map((s) => ({
          date: s.date,
          shift: s.shift,
          reason: s.reason || "phep",
          note: s.note,
          isUrgent: s.isUrgent || isUrgent,
        })),
        approvedAt: format(new Date(), "HH:mm dd/MM/yyyy"),
        upcoming7DaysLeaves,
      });

      let emailStatusNote = "";
      if (!emailResult.success) {
        console.warn("⚠️ [EmailService] Không thể gửi email thông báo duyệt hộ:", emailResult.error);
        emailStatusNote = ` (Lưu ý: Chưa gửi được email xác nhận tới nhân sự do: ${emailResult.error || "Lỗi cấu hình SMTP"})`;
      }

      const msg = `Đã đăng ký và DUYỆT CHÍNH THỨC thành công ${slots.length} ca nghỉ cho ĐD ${targetStaff.name} (${targetStaff.code}). Hệ thống đã gửi email thông báo xác nhận.${emailStatusNote}`;
      redirect(`/dang-ky-phep?tab=calendar&message=${encodeURIComponent(msg)}`);
    }

    // Trường hợp 2: Nhân sự tự đăng ký -> Lưu pending -> Gửi email duyệt 1 chạm tới tienmed@gmail.com
    const leaveItemsWithQuotaDetails = slots.map((s) => {
      const sameDayLeaves = data.leaveRequests.filter(
        (l) => l.date === s.date && l.reason !== "dihoc" && l.staffId !== targetStaff.id && l.status !== "rejected",
      );

      const matchingLeaves = sameDayLeaves.filter((l) => {
        if (s.shift === "full-day") return true;
        return l.shift === "full-day" || l.shift === s.shift;
      });

      const existingStaffNames: string[] = [];
      for (const ml of matchingLeaves) {
        const staffObj = data.staff.find((st) => st.id === ml.staffId);
        const name = staffObj?.name || ml.staffId;
        if (!existingStaffNames.includes(name)) {
          existingStaffNames.push(name);
        }
      }

      return {
        date: s.date,
        shift: s.shift,
        reason: s.reason || "phep",
        note: s.note,
        isUrgent: s.isUrgent || isUrgent,
        existingLeaveCount: matchingLeaves.length,
        existingStaffNames,
        isQuotaExceeded: matchingLeaves.length >= 2,
      };
    });

    const emailResult = await sendLeaveApprovalRequestEmail({
      staff: currentStaff,
      leaveItems: leaveItemsWithQuotaDetails,
      yearlyStats,
      approveToken,
      hasUrgent: isUrgent || hasQuotaExceeded,
      urgentNote: isUrgent ? urgentNote : undefined,
      upcoming7DaysLeaves,
    });

    let emailStatusNote = "";
    if (!emailResult.success) {
      console.warn("⚠️ [EmailService] Không thể gửi email duyệt:", emailResult.error);
      emailStatusNote = ` (Lưu ý: Chưa gửi được email duyệt do: ${emailResult.error || "Lỗi cấu hình SMTP"})`;
    }

    const msg = (isUrgent || hasQuotaExceeded
      ? "Đã gửi phiếu xin nghỉ cấp thiết. Đơn đã được chuyển tạm thời và đang chờ quản lý xem xét duyệt."
      : "Đã gửi phiếu xin nghỉ phép thành công. Đang chờ quản lý (tienmed@gmail.com) phê duyệt.") + emailStatusNote;

    redirect(`/dang-ky-phep?tab=calendar&message=${encodeURIComponent(msg)}`);
  } catch (error: any) {
    if (isRedirectError(error)) {
      throw error;
    }
    const errText = error instanceof Error ? error.message : "Không thể gửi phiếu nghỉ phép.";
    redirect(`/dang-ky-phep?error=${encodeURIComponent(errText)}`);
  }
}