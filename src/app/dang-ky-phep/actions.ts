"use server";

import { format, parseISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppData, invalidateAppDataCache, upsertManyLeaveRequests, calculateYearlyApprovedLeaveStats, writeAppDataKeysToSheets } from "@/lib/repository";
import { getUserContext } from "@/lib/session";
import {
  sendLeaveApprovalRequestEmail,
  sendLeaveApprovedNotificationEmail,
  getUpcoming7DaysApprovedLeaves,
} from "@/lib/email-service";
import { evaluateSlotQuota } from "@/lib/leave-logic";
import { generateLeaveSubstitutionPlan } from "@/lib/substitution-logic";
import { isStudyStaff } from "@/lib/study-staff";
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

    const isTargetStaffStudy = isStudyStaff(targetStaff);

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
    // - Nhân sự thuộc diện Đi học hoặc Quản trị viên được phép đăng ký loại "dihoc".
    // - Điều dưỡng tự làm chỉ được đăng ký "phep" hoặc "dihoc" (nếu thuộc diện đi học).
    // - Loại "om" chỉ do Quản trị viên trực tiếp ghi nhận.
    // - Loại "khac" (Việc riêng / Khác) đã bị loại bỏ hoàn toàn.
    for (const slot of slots) {
      if (!isEditorOrAdmin) {
        if (slot.reason === "dihoc" && !isTargetStaffStudy) {
          throw new Error("Chỉ nhân sự thuộc diện Đi học hoặc Quản trị viên mới được đăng ký loại Đi học.");
        }
        if (slot.reason !== "phep" && slot.reason !== "dihoc") {
          throw new Error("Điều dưỡng chỉ được đăng ký loại Nghỉ phép hoặc Đi học (nếu thuộc diện đi học). Các trường hợp Nghỉ ốm do Quản trị viên trực tiếp ghi nhận.");
        }
      }
      if (slot.reason === "khac") {
        throw new Error("Lý do 'Việc riêng / Khác' không còn được áp dụng. Vui lòng chọn 'Nghỉ phép'.");
      }
    }

    // [QWEN3] Kiểm tra tính hợp lệ ngày nghỉ (không áp dụng Thứ 7 / Chủ nhật)
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
    }

    // [QWEN3] Đánh giá định mức và tự động duyệt từng ca dựa trên module chuẩn evaluateSlotQuota
    const slotEvaluations = slots.map((slot) =>
      evaluateSlotQuota({
        slot,
        existingLeaves: data.leaveRequests,
        targetStaffId: targetStaff.id,
        allStaff: data.staff,
        isRegisteredByAdmin,
      })
    );

    let hasLeaveQuotaExceeded = false;
    const exceededLeaveDates: string[] = [];

    slots.forEach((slot, index) => {
      const evalRes = slotEvaluations[index];
      if (slot.reason !== "dihoc" && evalRes.isQuotaExceeded) {
        hasLeaveQuotaExceeded = true;
        slot.isUrgent = true;
        const shiftLabel = slot.shift === "morning" ? "Sáng" : slot.shift === "afternoon" ? "Chiều" : "Cả ngày";
        exceededLeaveDates.push(`${slot.date} (${shiftLabel})`);
      }
    });

    // Nếu ca nghỉ phép vượt quota 2 người/ca mà chưa xác nhận cấp thiết hoặc chưa điền lý do
    if (hasLeaveQuotaExceeded && (!isUrgent || !urgentNote) && !isRegisteredByAdmin) {
      throw new Error(
        `Các ca nghỉ phép sau đã có từ 2 nhân sự đăng ký: ${exceededLeaveDates.join(", ")}. Vui lòng đánh dấu "Nghỉ cấp thiết" và điền lý do giải trình để gửi duyệt.`,
      );
    }

    // Tính thống kê phép năm của nhân sự mục tiêu
    const yearlyStats = calculateYearlyApprovedLeaveStats(targetStaff.id, data.leaveRequests);

    // Sinh mã approveToken bảo mật
    const approveToken = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // Chuẩn bị danh sách bản ghi lưu Google Sheets
    const newEntries = slots.map((slot, index) => {
      const evalRes = slotEvaluations[index];
      let noteContent = slot.note || "";
      if (isUrgent && urgentNote) {
        noteContent = `[CẤP THIẾT] ${urgentNote}${noteContent ? ` - ${noteContent}` : ""}`;
      }
      if (isRegisteredByAdmin) {
        noteContent = `[Admin ${currentStaff.name} đăng ký hộ] ${noteContent}`.trim();
      } else if (evalRes.isAutoApprovedStudy) {
        noteContent = `[Tự động duyệt đi học - Định mức ≤ 3 người/buổi] ${noteContent}`.trim();
      } else if (evalRes.isAutoApprovedLeave) {
        noteContent = `[Tự động duyệt nghỉ phép - Định mức ≤ 2 người/buổi] ${noteContent}`.trim();
      }

      return {
        staffId: targetStaff.id,
        date: slot.date,
        shift: slot.shift,
        reason: slot.reason || "phep",
        note: noteContent,
        status: evalRes.status,
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
    // Tính toán kế hoạch gợi ý thay thế vị trí cho các ca nghỉ phép trong tuần (nếu có)
    const substitutionPlan = generateLeaveSubstitutionPlan({
      slots,
      targetStaff,
      staff: data.staff,
      positions: data.positions,
      weeklySchedule: data.weeklySchedule,
      templateSchedule: data.templateSchedule,
      leaveRequests: data.leaveRequests,
    });

    // Trường hợp 1: Admin đăng ký hộ -> Đơn đã Duyệt chính thức ngay -> Gửi email xác thực tới nhân sự được đăng ký hộ (kèm BCC ĐD Nghĩa và Quản lý)
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
        substitutionPlan,
      });

      let emailStatusNote = "";
      if (!emailResult.success) {
        console.warn("⚠️ [EmailService] Không thể gửi email thông báo duyệt hộ:", emailResult.error);
        emailStatusNote = ` (Lưu ý: Chưa gửi được email xác nhận tới nhân sự do: ${emailResult.error || "Lỗi cấu hình SMTP"})`;
      }

      const msg = `Đã đăng ký và DUYỆT CHÍNH THỨC thành công ${slots.length} ca nghỉ cho ĐD ${targetStaff.name} (${targetStaff.code}). Vui lòng lên hệ thống E-Office PNT làm phiếu nghỉ theo quy định (không dùng bảng giấy). Hệ thống đã gửi email thông báo xác nhận.${emailStatusNote}`;
      redirect(`/dang-ky-phep?tab=calendar&message=${encodeURIComponent(msg)}`);
    }

    // Trường hợp 2: TẤT CẢ các ca đều là đi học và ĐƯỢC TỰ ĐỘNG DUYỆT (buổi đó <= 3 người)
    // -> Chỉ gửi email duy nhất cho cá nhân người đăng ký xác nhận thành công (KHÔNG gửi Quản lý, KHÔNG BCC ĐD Nghĩa)
    const isAllAutoApprovedStudy =
      slots.length > 0 &&
      slots.every((s) => s.reason === "dihoc") &&
      slotEvaluations.every((e) => e.status === "approved");

    if (isAllAutoApprovedStudy) {
      const emailResult = await sendLeaveApprovedNotificationEmail({
        staff: targetStaff,
        leaveItems: slots.map((s) => ({
          date: s.date,
          shift: s.shift,
          reason: s.reason || "dihoc",
          note: s.note,
          isUrgent: false,
        })),
        approvedAt: format(new Date(), "HH:mm dd/MM/yyyy"),
        upcoming7DaysLeaves,
        skipBcc: true, // [QWEN3] CHỈ GỬI CHO CÁ NHÂN NGƯỜI ĐĂNG KÝ
        isAutoApprovedStudy: true,
      });

      let emailStatusNote = "";
      if (!emailResult.success) {
        console.warn("⚠️ [EmailService] Không thể gửi email xác nhận đi học:", emailResult.error);
        emailStatusNote = ` (Lưu ý: Chưa gửi được email xác nhận cá nhân do: ${emailResult.error || "Lỗi cấu hình SMTP"})`;
      }

      const msg = `Lịch nghỉ đi học (${slots.length} ca) đã được HỆ THỐNG TỰ ĐỘNG XÁC NHẬN THÀNH CÔNG (định mức ≤ 3 người/buổi). Vui lòng lên hệ thống E-Office PNT làm phiếu nghỉ theo quy định (không dùng bảng giấy). Đã gửi email xác nhận riêng tới ${targetStaff.email}.${emailStatusNote}`;
      redirect(`/dang-ky-phep?tab=calendar&message=${encodeURIComponent(msg)}`);
    }

    // Phân loại các ca: đã tự động duyệt vs đang chờ duyệt (pending)
    const approvedIndices: number[] = [];
    const pendingIndices: number[] = [];

    slotEvaluations.forEach((evalRes, index) => {
      if (evalRes.status === "approved") {
        approvedIndices.push(index);
      } else {
        pendingIndices.push(index);
      }
    });

    let autoApproveEmailResult: { success: boolean; error?: string } | null = null;
    let pendingApprovalEmailResult: { success: boolean; error?: string } | null = null;

    // Gửi email xác nhận tự động duyệt cho các ca được duyệt tự động (nếu có)
    // Thông báo đã duyệt gửi tới nhân sự, đồng thời đồng gửi (BCC) cho Quản lý tienmed bên cạnh ĐD Nghĩa!
    if (approvedIndices.length > 0) {
      const approvedItems = approvedIndices.map((i) => ({
        date: slots[i].date,
        shift: slots[i].shift,
        reason: slots[i].reason || "phep",
        note: slots[i].note,
        isUrgent: false,
      }));

      autoApproveEmailResult = await sendLeaveApprovedNotificationEmail({
        staff: targetStaff,
        leaveItems: approvedItems,
        approvedAt: format(new Date(), "HH:mm dd/MM/yyyy"),
        upcoming7DaysLeaves,
        skipBcc: false, // [QWEN3] Thông báo đã duyệt kèm cho tienmed bên cạnh DD Nghĩa đã nhận!
        isAutoApproved: true,
        substitutionPlan,
      });
    }

    // Nếu có ca pending (vượt định mức) -> gửi email yêu cầu duyệt tới Quản lý tienmed
    if (pendingIndices.length > 0) {
      const leaveItemsWithQuotaDetails = slots.map((s, index) => {
        const evalRes = slotEvaluations[index];
        return {
          date: s.date,
          shift: s.shift,
          reason: s.reason || "phep",
          note: s.note,
          isUrgent: s.isUrgent || isUrgent,
          existingLeaveCount: evalRes.relevantCount,
          existingStaffNames: evalRes.existingStaffNames,
          isQuotaExceeded: evalRes.isQuotaExceeded,
          status: evalRes.status,
        };
      });

      const hasPendingStudyOverQuota = pendingIndices.some((i) => slots[i].reason === "dihoc");

      pendingApprovalEmailResult = await sendLeaveApprovalRequestEmail({
        staff: targetStaff,
        leaveItems: leaveItemsWithQuotaDetails,
        yearlyStats,
        approveToken,
        hasUrgent: isUrgent || hasLeaveQuotaExceeded || hasPendingStudyOverQuota,
        urgentNote: isUrgent
          ? urgentNote
          : hasPendingStudyOverQuota
            ? "Đăng ký đi học vào buổi đã có trên 3 người nghỉ (cần quản lý phê duyệt)"
            : undefined,
        upcoming7DaysLeaves,
        substitutionPlan,
      });
    }

    // Xây dựng thông điệp phản hồi cho người dùng
    let emailStatusNote = "";
    if (autoApproveEmailResult && !autoApproveEmailResult.success) {
      emailStatusNote += ` (Lưu ý: Chưa gửi được email tự động duyệt do: ${autoApproveEmailResult.error || "Lỗi SMTP"})`;
    }
    if (pendingApprovalEmailResult && !pendingApprovalEmailResult.success) {
      emailStatusNote += ` (Lưu ý: Chưa gửi được email yêu cầu duyệt do: ${pendingApprovalEmailResult.error || "Lỗi SMTP"})`;
    }

    let msg = "";
    if (pendingIndices.length === 0) {
      msg = `Đơn xin nghỉ phép (${slots.length} ca) đã được HỆ THỐNG TỰ ĐỘNG DUYỆT THÀNH CÔNG (định mức ≤ 2 người/buổi). Vui lòng lên hệ thống E-Office PNT làm phiếu nghỉ theo quy định (không dùng bảng giấy). Đã gửi email thông báo xác nhận tới bạn, ĐD Nghĩa và Quản lý tienmed.${emailStatusNote}`;
    } else if (approvedIndices.length === 0) {
      msg = `Đơn xin nghỉ có ${pendingIndices.length} ca vượt định mức (≥ 2 người/buổi) nên đã chuyển email tới Quản lý (tienmed@gmail.com) để xem xét phê duyệt. Khi được duyệt, vui lòng lên hệ thống E-Office PNT để làm phiếu nghỉ theo quy định (không thực hiện bảng giấy).${emailStatusNote}`;
    } else {
      msg = `Hệ thống đã TỰ ĐỘNG DUYỆT ${approvedIndices.length} ca (định mức ≤ 2 người/buổi). Còn ${pendingIndices.length} ca vượt định mức đã chuyển email tới Quản lý để xem xét phê duyệt. Vui lòng lên hệ thống E-Office PNT để hoàn tất phiếu nghỉ theo quy định (không dùng bảng giấy).${emailStatusNote}`;
    }

    redirect(`/dang-ky-phep?tab=calendar&message=${encodeURIComponent(msg)}`);
  } catch (error: any) {
    if (isRedirectError(error)) {
      throw error;
    }
    const errText = error instanceof Error ? error.message : "Không thể gửi phiếu nghỉ phép.";
    redirect(`/dang-ky-phep?error=${encodeURIComponent(errText)}`);
  }
}

/**
 * [QWEN3] Phê duyệt phiếu/ca nghỉ phép trực tiếp từ giao diện Web (Mobile/Desktop) dành cho Quản lý
 */
export async function approveLeaveFromWebAction(params: {
  leaveId?: string;
  approveToken?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const { user } = await getUserContext({ required: false });
    const userEmail = (user?.email || "").trim().toLowerCase();
    const privilegedEmails = [
      "tienmed@gmail.com",
      "nghiadn.pk@pnt.edu.vn",
      "bstien@pnt.edu.vn",
      "admin@nurseflow.local",
    ];

    const isManager =
      user?.role === "admin" ||
      user?.role === "coordinator" ||
      privilegedEmails.includes(userEmail);

    if (!isManager) {
      return { success: false, message: "Bạn không có quyền quản lý để phê duyệt đơn nghỉ phép." };
    }

    const { leaveId, approveToken } = params;
    if (!leaveId && !approveToken) {
      return { success: false, message: "Không tìm thấy thông tin ca nghỉ cần duyệt." };
    }

    const data = await getAppData();
    const matchingLeaves = data.leaveRequests.filter((l) => {
      if (approveToken && l.approveToken === approveToken) return true;
      if (leaveId && l.id === leaveId) return true;
      return false;
    });

    if (matchingLeaves.length === 0) {
      return { success: false, message: "Đơn nghỉ phép không tồn tại hoặc đã bị xóa." };
    }

    const staffId = matchingLeaves[0].staffId;
    const staff = data.staff.find((s) => s.id === staffId);
    const staffName = staff?.name || staffId;

    // Lọc các ca đang ở trạng thái pending
    const pendingSlots = matchingLeaves.filter((l) => l.status === "pending");
    if (pendingSlots.length === 0) {
      return { success: true, message: `Đơn của ${staffName} đã được duyệt từ trước đó.` };
    }

    const matchingIds = new Set(matchingLeaves.map((l) => l.id));
    data.leaveRequests = data.leaveRequests.map((l) => {
      if (matchingIds.has(l.id)) {
        return { ...l, status: "approved" };
      }
      return l;
    });

    await writeAppDataKeysToSheets(data, ["leaveRequests"]);
    invalidateAppDataCache();

    ["/", "/schedule", "/leave", "/dang-ky-phep", "/reports"].forEach((p) => {
      revalidatePath(p);
    });

    // Gửi email thông báo đã duyệt cho nhân sự
    if (staff?.email) {
      const emailItems = pendingSlots.map((l) => ({
        date: l.date,
        shift: l.shift,
        reason: l.reason,
        note: l.note,
      }));

      const upcoming7DaysLeaves = getUpcoming7DaysApprovedLeaves(data.leaveRequests, data.staff);
      const substitutionPlan = generateLeaveSubstitutionPlan({
        slots: emailItems,
        targetStaff: staff,
        staff: data.staff,
        positions: data.positions,
        weeklySchedule: data.weeklySchedule,
        templateSchedule: data.templateSchedule,
        leaveRequests: data.leaveRequests,
      });

      sendLeaveApprovedNotificationEmail({
        staff,
        leaveItems: emailItems,
        upcoming7DaysLeaves,
        substitutionPlan,
      }).catch((err) => {
        console.error("🚨 [approveLeaveFromWebAction] Lỗi gửi email thông báo đã duyệt:", err);
      });
    }

    return {
      success: true,
      message: `Đã duyệt thành công ${pendingSlots.length} ca nghỉ của Điều dưỡng ${staffName}.`,
    };
  } catch (error: any) {
    console.error("🚨 [approveLeaveFromWebAction] Lỗi:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Đã có lỗi xảy ra khi phê duyệt.",
    };
  }
}

/**
 * [QWEN3] Từ chối phiếu/ca nghỉ phép trực tiếp từ giao diện Web dành cho Quản lý
 */
export async function rejectLeaveFromWebAction(params: {
  leaveId?: string;
  approveToken?: string;
  reason?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const { user } = await getUserContext({ required: false });
    const userEmail = (user?.email || "").trim().toLowerCase();
    const privilegedEmails = [
      "tienmed@gmail.com",
      "nghiadn.pk@pnt.edu.vn",
      "bstien@pnt.edu.vn",
      "admin@nurseflow.local",
    ];

    const isManager =
      user?.role === "admin" ||
      user?.role === "coordinator" ||
      privilegedEmails.includes(userEmail);

    if (!isManager) {
      return { success: false, message: "Bạn không có quyền quản lý để từ chối đơn nghỉ phép." };
    }

    const { leaveId, approveToken } = params;
    if (!leaveId && !approveToken) {
      return { success: false, message: "Không tìm thấy thông tin ca nghỉ cần từ chối." };
    }

    const data = await getAppData();
    const matchingLeaves = data.leaveRequests.filter((l) => {
      if (approveToken && l.approveToken === approveToken) return true;
      if (leaveId && l.id === leaveId) return true;
      return false;
    });

    if (matchingLeaves.length === 0) {
      return { success: false, message: "Đơn nghỉ phép không tồn tại hoặc đã bị xóa." };
    }

    const staffId = matchingLeaves[0].staffId;
    const staff = data.staff.find((s) => s.id === staffId);
    const staffName = staff?.name || staffId;

    const matchingIds = new Set(matchingLeaves.map((l) => l.id));
    data.leaveRequests = data.leaveRequests.map((l) => {
      if (matchingIds.has(l.id)) {
        return { ...l, status: "rejected" };
      }
      return l;
    });

    await writeAppDataKeysToSheets(data, ["leaveRequests"]);
    invalidateAppDataCache();

    ["/", "/schedule", "/leave", "/dang-ky-phep", "/reports"].forEach((p) => {
      revalidatePath(p);
    });

    return {
      success: true,
      message: `Đã từ chối ${matchingLeaves.length} ca nghỉ của Điều dưỡng ${staffName}.`,
    };
  } catch (error: any) {
    console.error("🚨 [rejectLeaveFromWebAction] Lỗi:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Đã có lỗi xảy ra khi từ chối.",
    };
  }
}
