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

    // [QWEN3] Kiểm tra định mức cho từng ca & Xác định trạng thái tự động duyệt
    let hasLeaveQuotaExceeded = false;
    const exceededLeaveDates: string[] = [];

    const slotStatuses: ("approved" | "pending")[] = [];
    const slotIsAutoApprovedStudy: boolean[] = [];

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

      if (isRegisteredByAdmin) {
        slotStatuses.push("approved");
        slotIsAutoApprovedStudy.push(false);
        continue;
      }

      if (slot.reason === "dihoc") {
        // [QWEN3] Ca đi học: Kiểm tra theo BUỔI (Sáng/Chiều)
        // Tính tất cả nhân sự khác có lịch nghỉ trong ngày (loại trừ targetStaff và rejected)
        const sameDayAllLeaves = data.leaveRequests.filter(
          (l) => l.date === slot.date && l.staffId !== targetStaff.id && l.status !== "rejected",
        );

        let morningCount = 0;
        let afternoonCount = 0;
        for (const l of sameDayAllLeaves) {
          if (l.shift === "full-day") {
            morningCount++;
            afternoonCount++;
          } else if (l.shift === "morning") {
            morningCount++;
          } else if (l.shift === "afternoon") {
            afternoonCount++;
          }
        }

        // Quy tắc mốc 3 người theo BUỔI:
        // Nếu buổi đó đã có >= 3 người nghỉ (người mới sẽ là người thứ 4 trở đi, > 3 người)
        // -> Vượt ngưỡng, chuyển sang pending để Quản lý duyệt.
        // Nếu buổi đó đang < 3 người nghỉ (người mới là người thứ 1, 2 hoặc 3, <= 3 người)
        // -> Tự động duyệt ngay (approved).
        let isStudyQuotaExceeded = false;
        if (slot.shift === "morning") {
          isStudyQuotaExceeded = morningCount >= 3;
        } else if (slot.shift === "afternoon") {
          isStudyQuotaExceeded = afternoonCount >= 3;
        } else if (slot.shift === "full-day") {
          isStudyQuotaExceeded = morningCount >= 3 || afternoonCount >= 3;
        }

        if (isStudyQuotaExceeded) {
          slotStatuses.push("pending");
          slotIsAutoApprovedStudy.push(false);
        } else {
          slotStatuses.push("approved");
          slotIsAutoApprovedStudy.push(true);
        }
      } else {
        // [QWEN3] Ca nghỉ phép thông thường (phep)
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
          hasLeaveQuotaExceeded = true;
          slot.isUrgent = true;
          exceededLeaveDates.push(`${slot.date} (${slot.shift === "morning" ? "Sáng" : slot.shift === "afternoon" ? "Chiều" : "Cả ngày"})`);
        }

        slotStatuses.push("pending");
        slotIsAutoApprovedStudy.push(false);
      }
    }

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
      let noteContent = slot.note || "";
      if (isUrgent && urgentNote) {
        noteContent = `[CẤP THIẾT] ${urgentNote}${noteContent ? ` - ${noteContent}` : ""}`;
      }
      if (isRegisteredByAdmin) {
        noteContent = `[Admin ${currentStaff.name} đăng ký hộ] ${noteContent}`.trim();
      } else if (slotIsAutoApprovedStudy[index]) {
        noteContent = `[Tự động duyệt đi học - Định mức ≤ 3 người/buổi] ${noteContent}`.trim();
      }

      return {
        staffId: targetStaff.id,
        date: slot.date,
        shift: slot.shift,
        reason: slot.reason || "phep",
        note: noteContent,
        status: slotStatuses[index],
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

    // Trường hợp 2: TẤT CẢ các ca đều là đi học và ĐƯỢC TỰ ĐỘNG DUYỆT (buổi đó <= 3 người)
    // -> Chỉ gửi email duy nhất cho cá nhân người đăng ký xác nhận thành công (KHÔNG gửi Quản lý, KHÔNG BCC ĐD Nghĩa)
    const isAllAutoApprovedStudy =
      slots.length > 0 &&
      slots.every((s) => s.reason === "dihoc") &&
      slotStatuses.every((st) => st === "approved");

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

      const msg = `Lịch nghỉ đi học (${slots.length} ca) đã được HỆ THỐNG TỰ ĐỘNG XÁC NHẬN THÀNH CÔNG (định mức ≤ 3 người/buổi). Đã gửi email xác nhận riêng tới ${targetStaff.email}.${emailStatusNote}`;
      redirect(`/dang-ky-phep?tab=calendar&message=${encodeURIComponent(msg)}`);
    }

    // Trường hợp 3: Có ca cần Quản lý phê duyệt (nghỉ phép thông thường hoặc ca đi học vượt > 3 người/buổi)
    // -> Gửi email duyệt 1 chạm tới tienmed@gmail.com
    const leaveItemsWithQuotaDetails = slots.map((s, index) => {
      const isStudy = s.reason === "dihoc";
      const sameDayLeaves = data.leaveRequests.filter(
        (l) => l.date === s.date && (isStudy ? true : l.reason !== "dihoc") && l.staffId !== targetStaff.id && l.status !== "rejected",
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

      const quotaLimit = isStudy ? 3 : 2;
      const isExceeded = matchingLeaves.length >= quotaLimit;

      return {
        date: s.date,
        shift: s.shift,
        reason: s.reason || "phep",
        note: s.note,
        isUrgent: s.isUrgent || isUrgent,
        existingLeaveCount: matchingLeaves.length,
        existingStaffNames,
        isQuotaExceeded: isExceeded,
      };
    });

    const hasPendingStudyOverQuota = slots.some((s, i) => s.reason === "dihoc" && slotStatuses[i] === "pending");

    const emailResult = await sendLeaveApprovalRequestEmail({
      staff: currentStaff,
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
    });

    let emailStatusNote = "";
    if (!emailResult.success) {
      console.warn("⚠️ [EmailService] Không thể gửi email duyệt:", emailResult.error);
      emailStatusNote = ` (Lưu ý: Chưa gửi được email duyệt do: ${emailResult.error || "Lỗi cấu hình SMTP"})`;
    }

    let msg = "";
    if (hasPendingStudyOverQuota) {
      msg = "Lịch nghỉ đi học rơi vào buổi đã có trên 3 người nghỉ nên cần Quản lý (tienmed@gmail.com) phê duyệt." + emailStatusNote;
    } else if (isUrgent || hasLeaveQuotaExceeded) {
      msg = "Đã gửi phiếu xin nghỉ cấp thiết. Đơn đã được chuyển tạm thời và đang chờ quản lý xem xét duyệt." + emailStatusNote;
    } else {
      msg = "Đã gửi phiếu xin nghỉ phép thành công. Đang chờ quản lý (tienmed@gmail.com) phê duyệt." + emailStatusNote;
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