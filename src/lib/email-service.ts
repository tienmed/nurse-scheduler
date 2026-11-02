import nodemailer from "nodemailer";
import { format, parseISO, addDays, isWithinInterval, startOfToday } from "date-fns";
import { vi } from "date-fns/locale";
import { LEAVE_REASON_LABELS, LEAVE_SHIFT_LABELS } from "@/lib/constants";
import type { LeaveReason, LeaveRecord, LeaveShift, StaffMember } from "@/lib/types";

const ADMIN_APPROVER_EMAIL = "tienmed@gmail.com";
const NOTIFY_BCC_EMAIL = "nghiadn.pk@pnt.edu.vn";

function getSmtpTransporter() {
  const smtpUser = process.env.SMTP_USER_NV;
  const smtpPass = process.env.SMTP_PASS_NV;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);

  if (!smtpUser || !smtpPass) {
    console.warn("⚠️ [EmailService] Thiếu cấu hình SMTP_USER_NV hoặc SMTP_PASS_NV trong môi trường.");
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

function getBaseUrl(): string {
  if (process.env.AUTH_URL) {
    return process.env.AUTH_URL.replace(/\/$/, "");
  }
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export interface LeaveItemSummary {
  date: string;
  shift: LeaveShift;
  reason: LeaveReason;
  note?: string;
  isUrgent?: boolean;
}

export interface UpcomingLeavePreviewItem {
  date: string;
  staffName: string;
  shift: LeaveShift;
  reason: LeaveReason;
}

/**
 * [QWEN3] Lọc danh sách nhân sự đã được duyệt nghỉ trong 7 ngày tới
 */
export function getUpcoming7DaysApprovedLeaves(
  leaveRequests: LeaveRecord[],
  staffList: StaffMember[],
): UpcomingLeavePreviewItem[] {
  const today = startOfToday();
  const next7Days = addDays(today, 7);

  return leaveRequests
    .filter((l) => {
      try {
        const d = parseISO(l.date);
        const isApproved = l.status === "approved" || !l.status;
        return isApproved && isWithinInterval(d, { start: today, end: next7Days });
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => {
      const person = staffList.find((s) => s.id === l.staffId);
      return {
        date: l.date,
        staffName: person?.name || l.staffId,
        shift: l.shift,
        reason: l.reason,
      };
    });
}

/**
 * [QWEN3] Render bảng HTML xem nhanh lịch nghỉ 7 ngày tới trực tiếp trong email
 */
function renderUpcoming7DaysTableHtml(items?: UpcomingLeavePreviewItem[], baseUrl = ""): string {
  const today = startOfToday();
  const next7 = addDays(today, 7);
  const dateRangeText = `(Từ ${format(today, "dd/MM/yyyy")} đến ${format(next7, "dd/MM/yyyy")})`;
  const calendarUrl = `${baseUrl}/dang-ky-phep?tab=calendar`;

  let rows = "";
  if (!items || items.length === 0) {
    rows = `
      <tr>
        <td colspan="4" style="padding:16px;text-align:center;color:#64748b;font-style:italic;">
          Hiện tại chưa có nhân sự nào được duyệt nghỉ trong 7 ngày sắp tới.
        </td>
      </tr>
    `;
  } else {
    rows = items
      .map((item, idx) => {
        let dStr = item.date;
        try {
          dStr = format(parseISO(item.date), "dd/MM/yyyy (EEEE)", { locale: vi });
        } catch {}

        const isMorning = item.shift === "morning";
        const isAfternoon = item.shift === "afternoon";
        const shiftCode = isMorning ? "S" : isAfternoon ? "C" : "CN";
        const shiftBg = isMorning ? "#f59e0b" : isAfternoon ? "#2563eb" : "#7e22ce";
        const shiftDesc = isMorning ? "Sáng" : isAfternoon ? "Chiều" : "Cả ngày";

        let reasonBadge = `<span style="background-color:#dcfce7;color:#166534;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold;border:1px solid #bbf7d0;">Phép</span>`;
        if (item.reason === "om") {
          reasonBadge = `<span style="background-color:#fee2e2;color:#991b1b;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold;border:1px solid #fecaca;">Ốm</span>`;
        } else if (item.reason === "dihoc") {
          reasonBadge = `<span style="background-color:#e0e7ff;color:#3730a3;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold;border:1px solid #c7d2fe;">Đi học</span>`;
        } else if (item.reason === "khac") {
          reasonBadge = `<span style="background-color:#f1f5f9;color:#334155;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold;border:1px solid #e2e8f0;">Khác</span>`;
        }

        return `
          <tr style="border-bottom:1px solid #e2e8f0;${idx % 2 === 1 ? "background-color:#f8fafc;" : ""}">
            <td style="padding:10px 12px;font-weight:600;color:#0f172a;font-size:13px;">${dStr}</td>
            <td style="padding:10px 12px;color:#1e293b;font-weight:bold;font-size:13px;">${item.staffName}</td>
            <td style="padding:10px 12px;">${reasonBadge}</td>
            <td style="padding:10px 12px;text-align:center;">
              <span style="background-color:${shiftBg};color:#ffffff;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:900;">
                ${shiftCode}
              </span>
              <span style="font-size:11px;color:#64748b;margin-left:4px;">(${shiftDesc})</span>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  return `
    <div style="margin-top:28px;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;background:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <div style="background-color:#0f172a;padding:12px 16px;color:#ffffff;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:14px;font-weight:bold;">📋 Xem nhanh lịch nghỉ 7 ngày tới (Đã duyệt)</span>
        <span style="font-size:11px;color:#94a3b8;">${dateRangeText}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px;">
        <thead>
          <tr style="background-color:#f1f5f9;color:#475569;border-bottom:1px solid #e2e8f0;font-size:12px;">
            <th style="padding:10px 12px;">Ngày</th>
            <th style="padding:10px 12px;">Nhân sự</th>
            <th style="padding:10px 12px;">Loại nghỉ</th>
            <th style="padding:10px 12px;text-align:center;">Ca (S/C/CN)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div style="padding:10px 16px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:right;">
        <a href="${calendarUrl}" target="_blank" style="font-size:12px;font-weight:bold;color:#0d9488;text-decoration:none;">
          Mở Cổng Portal xem toàn bộ lịch trên Web →
        </a>
      </div>
    </div>
  `;
}

export interface SendApprovalRequestEmailParams {
  staff: StaffMember;
  leaveItems: LeaveItemSummary[];
  yearlyStats: {
    totalDays: number;
    totalSessions: number;
    year: number;
  };
  approveToken: string;
  hasUrgent: boolean;
  urgentNote?: string;
  upcoming7DaysLeaves?: UpcomingLeavePreviewItem[];
}

/**
 * [QWEN3] Gửi email yêu cầu phê duyệt đơn nghỉ phép tới tienmed@gmail.com
 * Kèm nút bấm Duyệt nhanh 1 chạm, nút xem lịch web, và bảng xem nhanh lịch nghỉ 7 ngày tới
 */
export async function sendLeaveApprovalRequestEmail(
  params: SendApprovalRequestEmailParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const transporter = getSmtpTransporter();
  const smtpUser = process.env.SMTP_USER_NV;

  if (!transporter || !smtpUser) {
    const errorMsg = "Chưa cấu hình tài khoản gửi SMTP.";
    console.error(`[EmailService] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const { staff, leaveItems, yearlyStats, approveToken, hasUrgent, urgentNote, upcoming7DaysLeaves } = params;
  const baseUrl = getBaseUrl();
  const approveUrl = `${baseUrl}/api/leave/approve?token=${encodeURIComponent(approveToken)}`;
  const calendarUrl = `${baseUrl}/dang-ky-phep?tab=calendar`;

  const subjectPrefix = hasUrgent ? "🚨 [CẤP THIẾT - CHỜ DUYỆT]" : "📋 [CHỜ DUYỆT]";
  const subject = `${subjectPrefix} Đơn xin nghỉ phép của ĐD ${staff.name} (${staff.code}) - ${leaveItems.length} ca`;

  const leaveRowsHtml = leaveItems
    .map((item, idx) => {
      let dateLabel = item.date;
      try {
        dateLabel = format(parseISO(item.date), "EEEE, dd/MM/yyyy", { locale: vi });
      } catch {}

      const shiftLabel = LEAVE_SHIFT_LABELS[item.shift] || item.shift;
      const isMorning = item.shift === "morning";
      const isAfternoon = item.shift === "afternoon";
      const shiftCode = isMorning ? "S" : isAfternoon ? "C" : "CN";
      const shiftBg = isMorning ? "#f59e0b" : isAfternoon ? "#2563eb" : "#7e22ce";

      const reasonLabel = LEAVE_REASON_LABELS[item.reason] || item.reason;
      const urgentBadge = item.isUrgent
        ? `<span style="background-color:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:bold;">Cấp thiết (Vượt định mức)</span>`
        : `<span style="background-color:#f0fdf4;color:#166534;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:bold;">Bình thường</span>`;

      return `
        <tr style="border-bottom:1px solid #e2e8f0;${idx % 2 === 1 ? "background-color:#f8fafc;" : ""}">
          <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${dateLabel}</td>
          <td style="padding:10px 14px;color:#334155;font-weight:600;">
            <span style="background-color:${shiftBg};color:#ffffff;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:900;">
              ${shiftCode}
            </span>
            <span style="margin-left:4px;">${shiftLabel}</span>
          </td>
          <td style="padding:10px 14px;color:#334155;">${reasonLabel}</td>
          <td style="padding:10px 14px;">${urgentBadge}</td>
          <td style="padding:10px 14px;color:#64748b;font-size:13px;">${item.note || "—"}</td>
        </tr>
      `;
    })
    .join("");

  const urgentAlertHtml = hasUrgent
    ? `
    <div style="background-color:#fff7ed;border-left:4px solid #f97316;padding:14px 18px;margin-bottom:20px;border-radius:8px;">
      <p style="margin:0 0 6px 0;font-weight:bold;color:#9a3412;font-size:14px;">⚠️ Lưu ý từ hệ thống: Đơn có ca vượt định mức (≥ 2 người/ca)</p>
      <p style="margin:0;font-size:13px;color:#7c2d12;line-height:1.5;">
        Nhân sự đã đăng ký theo diện <strong>Cấp thiết</strong>.<br/>
        <strong>Nội dung giải trình để duyệt:</strong> ${urgentNote || "Không có ghi chú thêm."}
      </p>
    </div>
  `
    : "";

  const upcoming7DaysTableHtml = renderUpcoming7DaysTableHtml(upcoming7DaysLeaves, baseUrl);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Yêu cầu duyệt nghỉ phép</title>
    </head>
    <body style="margin:0;padding:24px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
      <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
        
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%);padding:24px 28px;color:#ffffff;">
          <p style="margin:0 0 4px 0;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">NurseFlow · Hệ thống phân công điều dưỡng</p>
          <h1 style="margin:0;font-size:20px;font-weight:bold;line-height:1.3;">Yêu cầu phê duyệt Đơn xin nghỉ phép</h1>
        </div>

        <div style="padding:28px;">
          ${urgentAlertHtml}

          <!-- Thông tin nhân sự -->
          <div style="background-color:#f8fafc;border-radius:12px;padding:16px 20px;margin-bottom:22px;border:1px solid #e2e8f0;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr>
                <td style="padding:4px 0;color:#64748b;width:140px;">Họ tên điều dưỡng:</td>
                <td style="padding:4px 0;font-weight:bold;color:#0f172a;">${staff.name} (${staff.code})</td>
              </tr>
              <tr>
                <td style="padding:4px 0;color:#64748b;">Email nhân sự:</td>
                <td style="padding:4px 0;color:#0f172a;">${staff.email}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;color:#64748b;">Quỹ phép năm ${yearlyStats.year}:</td>
                <td style="padding:4px 0;font-weight:bold;color:#0d9488;">
                  Đã nghỉ: ${yearlyStats.totalDays} ngày (${yearlyStats.totalSessions} buổi)
                </td>
              </tr>
            </table>
          </div>

          <!-- Danh sách ca xin nghỉ -->
          <h2 style="font-size:15px;font-weight:bold;color:#0f172a;margin:0 0 12px 0;">Danh sách ca xin nghỉ phép (${leaveItems.length} ca):</h2>
          <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
              <thead>
                <tr style="background-color:#0f766e;color:#ffffff;font-size:12px;">
                  <th style="padding:10px 14px;">Ngày (dd/mm/yyyy)</th>
                  <th style="padding:10px 14px;">Ca (S/C/CN)</th>
                  <th style="padding:10px 14px;">Lý do</th>
                  <th style="padding:10px 14px;">Phân loại</th>
                  <th style="padding:10px 14px;">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                ${leaveRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- CÁC NÚT THAO TÁC DUYỆT & XEM LỊCH -->
          <div style="text-align:center;padding:16px 0 20px 0;">
            <a href="${approveUrl}" target="_blank" style="display:inline-block;background-color:#0d9488;color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:12px;font-size:16px;font-weight:bold;box-shadow:0 4px 14px rgba(13,148,136,0.35);margin-bottom:12px;">
              ✅ DUYỆT ĐƠN NGHỈ PHÉP (1 CHẠM)
            </a>
            <br/>
            <a href="${calendarUrl}" target="_blank" style="display:inline-block;background-color:#f1f5f9;color:#0f766e;text-decoration:none;padding:10px 24px;border-radius:10px;font-size:13px;font-weight:bold;border:1px solid #ccfbf1;">
              📅 Xem lịch đăng ký nghỉ phép (Đã duyệt) trên Web →
            </a>
          </div>

          <!-- KHỐI XEM NHANH LỊCH NGHỈ 7 NGÀY TỚI TRỰC TIẾP TRONG EMAIL -->
          ${upcoming7DaysTableHtml}

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 16px 0;" />
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
            Sau khi duyệt, dữ liệu sẽ được ghi nhận chính thức vào Google Sheets và tự động gửi email thông báo xác thực đồng ý tới Điều dưỡng ${staff.name} (BCC tới ĐD Nghĩa).
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"NurseFlow Hệ Thống" <${smtpUser}>`,
      to: ADMIN_APPROVER_EMAIL,
      subject,
      html: htmlContent,
    });

    console.log("✅ [EmailService] Gửi email yêu cầu duyệt thành công:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("❌ [EmailService] Lỗi khi gửi email duyệt:", err);
    return { success: false, error: err?.message || "Lỗi gửi email." };
  }
}

export interface SendApprovedNotificationEmailParams {
  staff: StaffMember;
  leaveItems: LeaveItemSummary[];
  approvedAt?: string;
  upcoming7DaysLeaves?: UpcomingLeavePreviewItem[];
}

/**
 * [QWEN3] Gửi email thông báo đơn đã duyệt tới người xin nghỉ phép
 * Đồng thời BCC tới ĐD Nghĩa (nghiadn.pk@pnt.edu.vn)
 * Kèm nút xem lịch web và bảng xem nhanh lịch nghỉ 7 ngày tới
 */
export async function sendLeaveApprovedNotificationEmail(
  params: SendApprovedNotificationEmailParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const transporter = getSmtpTransporter();
  const smtpUser = process.env.SMTP_USER_NV;

  if (!transporter || !smtpUser) {
    const errorMsg = "Chưa cấu hình tài khoản gửi SMTP.";
    console.error(`[EmailService] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const { staff, leaveItems, approvedAt, upcoming7DaysLeaves } = params;
  const approvedTimeStr = approvedAt || format(new Date(), "HH:mm dd/MM/yyyy");
  const baseUrl = getBaseUrl();
  const calendarUrl = `${baseUrl}/dang-ky-phep?tab=calendar`;

  const subject = `[XÁC THỰC ĐỒNG Ý] Đơn xin nghỉ phép của ĐD ${staff.name} đã được phê duyệt`;

  const leaveRowsHtml = leaveItems
    .map((item, idx) => {
      let dateLabel = item.date;
      try {
        dateLabel = format(parseISO(item.date), "EEEE, dd/MM/yyyy", { locale: vi });
      } catch {}

      const shiftLabel = LEAVE_SHIFT_LABELS[item.shift] || item.shift;
      const isMorning = item.shift === "morning";
      const isAfternoon = item.shift === "afternoon";
      const shiftCode = isMorning ? "S" : isAfternoon ? "C" : "CN";
      const shiftBg = isMorning ? "#f59e0b" : isAfternoon ? "#2563eb" : "#7e22ce";

      const reasonLabel = LEAVE_REASON_LABELS[item.reason] || item.reason;

      return `
        <tr style="border-bottom:1px solid #e2e8f0;${idx % 2 === 1 ? "background-color:#f8fafc;" : ""}">
          <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${dateLabel}</td>
          <td style="padding:10px 14px;color:#334155;font-weight:600;">
            <span style="background-color:${shiftBg};color:#ffffff;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:900;">
              ${shiftCode}
            </span>
            <span style="margin-left:4px;">${shiftLabel}</span>
          </td>
          <td style="padding:10px 14px;color:#334155;">${reasonLabel}</td>
          <td style="padding:10px 14px;color:#059669;font-weight:bold;">Đã duyệt chính thức</td>
        </tr>
      `;
    })
    .join("");

  const upcoming7DaysTableHtml = renderUpcoming7DaysTableHtml(upcoming7DaysLeaves, baseUrl);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Đơn nghỉ phép đã được phê duyệt</title>
    </head>
    <body style="margin:0;padding:24px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
      <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
        
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:24px 28px;color:#ffffff;">
          <p style="margin:0 0 4px 0;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">NurseFlow · Xác thực phê duyệt</p>
          <h1 style="margin:0;font-size:20px;font-weight:bold;line-height:1.3;">Đơn xin nghỉ phép đã được PHÊ DUYỆT</h1>
        </div>

        <div style="padding:28px;">
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#1e293b;">
            Kính gửi Điều dưỡng <strong>${staff.name}</strong> (${staff.code}),
          </p>
          <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#334155;">
            Phiếu xin nghỉ phép của bạn đã được quản lý (<strong>tienmed@gmail.com</strong>) kiểm tra và <strong>chính thức phê duyệt</strong> vào lúc <strong>${approvedTimeStr}</strong>. Dữ liệu đã được cập nhật chính thức vào hệ thống.
          </p>

          <!-- Danh sách ca đã duyệt -->
          <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
              <thead>
                <tr style="background-color:#059669;color:#ffffff;font-size:12px;">
                  <th style="padding:10px 14px;">Ngày (dd/mm/yyyy)</th>
                  <th style="padding:10px 14px;">Ca (S/C/CN)</th>
                  <th style="padding:10px 14px;">Lý do</th>
                  <th style="padding:10px 14px;">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                ${leaveRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- LƯU Ý LÀM PHIẾU GIẤY THEO QUI ĐỊNH -->
          <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #3b82f6;border-radius:8px;padding:16px 18px;margin-bottom:24px;">
            <p style="margin:0 0 6px 0;font-weight:bold;color:#1e40af;font-size:14px;">
              📝 LƯU Ý THỦ TỤC QUAN TRỌNG:
            </p>
            <p style="margin:0;font-size:13px;color:#1e3a8a;line-height:1.6;">
              Sau khi phiếu nghỉ đã được phê duyệt trên hệ thống, <strong>bạn vui lòng tiến hành làm phiếu giấy xin nghỉ phép theo đúng quy định</strong> của đơn vị/bệnh viện và nộp lại cho bộ phận quản lý.
            </p>
          </div>

          <!-- NÚT XEM LỊCH TRÊN HỆ THỐNG -->
          <div style="text-align:center;padding:8px 0 20px 0;">
            <a href="${calendarUrl}" target="_blank" style="display:inline-block;background-color:#0f766e;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:bold;box-shadow:0 3px 12px rgba(15,118,110,0.25);">
              📅 XEM LỊCH ĐĂNG KÝ NGHỈ PHÉP (ĐÃ DUYỆT) TRÊN HỆ THỐNG →
            </a>
          </div>

          <!-- KHỐI XEM NHANH LỊCH NGHỈ 7 NGÀY TỚI TRỰC TIẾP TRONG EMAIL -->
          ${upcoming7DaysTableHtml}

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 16px 0;" />
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
            Email này được gửi tự động từ hệ thống NurseFlow tới người gửi phiếu và được đồng gửi (BCC) tới ĐD Nghĩa (${NOTIFY_BCC_EMAIL}) để theo dõi và đối soát.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"NurseFlow Hệ Thống" <${smtpUser}>`,
      to: staff.email,
      bcc: NOTIFY_BCC_EMAIL,
      subject,
      html: htmlContent,
    });

    console.log("✅ [EmailService] Gửi email xác nhận duyệt thành công:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("❌ [EmailService] Lỗi khi gửi email xác nhận duyệt:", err);
    return { success: false, error: err?.message || "Lỗi gửi email." };
  }
}
