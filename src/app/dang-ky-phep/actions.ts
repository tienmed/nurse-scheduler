"use server";

import { format, parseISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppData, invalidateAppDataCache, upsertManyLeaveRequests, calculateYearlyApprovedLeaveStats } from "@/lib/repository";
import { getUserContext } from "@/lib/session";
import { sendLeaveApprovalRequestEmail, getUpcoming7DaysApprovedLeaves } from "@/lib/email-service";
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
 * - Kiểm tra định mức từng ca
 * - Ghi nhận tạm (status: pending)
 * - Gửi email thông báo kèm nút Duyệt 1 chạm tới tienmed@gmail.com
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

    const isEditorOrAdmin = user.role === "admin" || user.role === "coordinator" || user.email.toLowerCase() === "admin@nurseflow.local";

    // Kiểm tra phân quyền loại nghỉ: Chỉ Admin/Điều phối mới được đăng ký Đi học hoặc Nghỉ ốm
    for (const slot of slots) {
      if ((slot.reason === "om" || slot.reason === "dihoc") && !isEditorOrAdmin) {
        throw new Error("Nhân sự không thể tự đăng ký trường hợp Đi học hoặc Nghỉ ốm. Các trường hợp này do Quản trị viên trực tiếp ghi nhận.");
      }
    }

    // Kiểm tra định mức cho từng ca
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

      // Đếm số người đã đăng ký cùng ca (loại trừ đi học và ca của chính nhân sự này)
      const sameDayLeaves = data.leaveRequests.filter(
        (l) => l.date === slot.date && l.reason !== "dihoc" && l.staffId !== currentStaff.id && l.status !== "rejected",
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

    // Nếu vượt quota mà người dùng chưa xác nhận cấp thiết hoặc chưa điền lý do
    if (hasQuotaExceeded && (!isUrgent || !urgentNote)) {
      throw new Error(
        `Các ca sau đã có từ 2 nhân sự đăng ký: ${exceededDates.join(", ")}. Vui lòng đánh dấu "Nghỉ cấp thiết" và điền lý do giải trình để gửi duyệt.`,
      );
    }

    // Tính thống kê phép năm của nhân sự
    const yearlyStats = calculateYearlyApprovedLeaveStats(currentStaff.id, data.leaveRequests);

    // Sinh mã approveToken bảo mật 1 lần
    const approveToken = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const newEntries = slots.map((slot) => ({
      staffId: currentStaff.id,
      date: slot.date,
      shift: slot.shift,
      reason: slot.reason || "phep",
      note: isUrgent && urgentNote ? `[CẤP THIẾT] ${urgentNote}` : slot.note || "",
      status: "pending" as const,
      approveToken,
      createdAt: nowIso,
    }));

    // Lưu vào Google Sheets
    await upsertManyLeaveRequests(newEntries);
    invalidateAppDataCache();

    // Revalidate paths
    ["/dang-ky-phep", "/leave", "/schedule", "/"].forEach((p) => {
      revalidatePath(p);
    });

    // Lấy danh sách 7 ngày tới đã được duyệt để người duyệt xem nhanh trong email
    const upcoming7DaysLeaves = getUpcoming7DaysApprovedLeaves(data.leaveRequests, data.staff);

    // Gửi email duyệt tới tienmed@gmail.com
    await sendLeaveApprovalRequestEmail({
      staff: currentStaff,
      leaveItems: slots.map((s) => ({
        date: s.date,
        shift: s.shift,
        reason: s.reason || "phep",
        note: s.note,
        isUrgent: s.isUrgent || isUrgent,
      })),
      yearlyStats,
      approveToken,
      hasUrgent: isUrgent || hasQuotaExceeded,
      urgentNote: isUrgent ? urgentNote : undefined,
      upcoming7DaysLeaves,
    });

    const msg = isUrgent || hasQuotaExceeded
      ? "Đã gửi phiếu xin nghỉ cấp thiết. Đơn đã được chuyển tạm thời và gửi email tới quản lý để xem xét duyệt."
      : "Đã gửi phiếu xin nghỉ phép thành công. Đang chờ quản lý (tienmed@gmail.com) phê duyệt.";

    redirect(`/dang-ky-phep?tab=calendar&message=${encodeURIComponent(msg)}`);
  } catch (error: any) {
    if (isRedirectError(error)) {
      throw error;
    }
    const errText = error instanceof Error ? error.message : "Không thể gửi phiếu nghỉ phép.";
    redirect(`/dang-ky-phep?error=${encodeURIComponent(errText)}`);
  }
}
