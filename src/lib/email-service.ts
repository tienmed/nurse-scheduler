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

/**
 * [QWEN3] Tự động xác định Base URL của hệ thống:
 * - Ưu tiên AUTH_URL / NEXTAUTH_URL
 * - Tự động nhận diện domain Vercel Production nếu chạy trên cloud Vercel
 * - Mặc định localhost:3000 cho môi trường dev
 */
function getBaseUrl(): string {
  if (process.env.AUTH_URL) {
    return process.env.AUTH_URL.replace(/\/$/, "");
  }
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, "")}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export interface LeaveItemSummary {
  date: string;
  shift: LeaveShift;
  reason: LeaveReason;
  note?: string;
  isUrgent?: boolean;
  existingLeaveCount?: number;
  existingStaffNames?: string[];
  isQuotaExceeded?: boolean;
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
 * [QWEN3] Render danh sách xem nhanh lịch nghỉ 7 ngày tới (Tối ưu 100% Responsive trên Mobile)
 * Không sử dụng min-width hay overflow-x: auto để tránh lỗi co nhỏ (auto-shrink) trên ứng dụng Gmail
 */
function renderUpcoming7DaysTableHtml(items?: UpcomingLeavePreviewItem[], baseUrl = ""): string {
  const today = startOfToday();
  const next7 = addDays(today, 7);
  const dateRangeText = `(${format(today, "dd/MM")} - ${format(next7, "dd/MM/yyyy")})`;
  const calendarUrl = `${baseUrl}/dang-ky-phep?tab=calendar`;

  let rows = "";
  if (!items || items.length === 0) {
    rows = `
      <tr>
        <td colspan="4" style="padding:12px;text-align:center;color:#64748b;font-style:italic;font-size:12px;">
          Hiện tại chưa có nhân sự nào được duyệt nghỉ trong 7 ngày sắp tới.
        </td>
      </tr>
    `;
  } else {
    rows = items
      .map((item, idx) => {
        let dStr = item.date;
        try {
          dStr = format(parseISO(item.date), "dd/MM (EEE)", { locale: vi });
        } catch {}

        const isMorning = item.shift === "morning";
        const isAfternoon = item.shift === "afternoon";
        const shiftCode = isMorning ? "S" : isAfternoon ? "C" : "CN";
        const shiftBg = isMorning ? "#f59e0b" : isAfternoon ? "#2563eb" : "#7e22ce";
        const shiftDesc = isMorning ? "Sáng" : isAfternoon ? "Chiều" : "Cả ngày";

        let reasonBadge = `<span style="background-color:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;border:1px solid #bbf7d0;">Phép</span>`;
        if (item.reason === "om") {
          reasonBadge = `<span style="background-color:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;border:1px solid #fecaca;">Ốm</span>`;
        } else if (item.reason === "dihoc") {
          reasonBadge = `<span style="background-color:#e0e7ff;color:#3730a3;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;border:1px solid #c7d2fe;">Đi học</span>`;
        } else if (item.reason === "khac") {
          reasonBadge = `<span style="background-color:#f1f5f9;color:#334155;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;border:1px solid #e2e8f0;">Khác</span>`;
        }

        return `
          <tr style="border-bottom:1px solid #e2e8f0;${idx % 2 === 1 ? "background-color:#f8fafc;" : ""}">
            <td style="padding:7px 8px;font-weight:600;color:#0f172a;font-size:12px;white-space:nowrap;">${dStr}</td>
            <td style="padding:7px 8px;color:#1e293b;font-weight:bold;font-size:12px;">${item.staffName}</td>
            <td style="padding:7px 8px;white-space:nowrap;">${reasonBadge}</td>
            <td style="padding:7px 8px;text-align:center;white-space:nowrap;">
              <span style="background-color:${shiftBg};color:#ffffff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:900;">
                ${shiftCode}
              </span>
              <span style="font-size:10px;color:#64748b;margin-left:2px;">(${shiftDesc})</span>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  return `
    <div style="margin-top:20px;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;background:#ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.03);">
      <!-- Header bảng 7 ngày -->
      <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#0f172a;color:#ffffff;">
        <tr>
          <td style="padding:10px 12px;font-size:13px;font-weight:bold;text-align:left;">
            📋 Lịch nghỉ 7 ngày tới (Đã duyệt)
          </td>
          <td style="padding:10px 12px;font-size:11px;color:#94a3b8;text-align:right;">
            ${dateRangeText}
          </td>
        </tr>
      </table>

      <!-- Danh sách bảng 100% chiều rộng -->
      <table role="presentation" style="width:100%;border-collapse:collapse;text-align:left;font-size:12px;">
        <thead>
          <tr style="background-color:#f1f5f9;color:#475569;border-bottom:1px solid #e2e8f0;font-size:11px;text-transform:uppercase;">
            <th style="padding:8px 8px;">Ngày</th>
            <th style="padding:8px 8px;">Nhân sự</th>
            <th style="padding:8px 8px;">Loại</th>
            <th style="padding:8px 8px;text-align:center;">Ca</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="padding:8px 12px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:right;">
        <a href="${calendarUrl}" target="_blank" style="font-size:11px;font-weight:bold;color:#0d9488;text-decoration:none;">
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
 * Thiết kế chuẩn Mobile Card Layout: Co giãn 100% tự nhiên trên mọi kích thước màn hình
 * Không sử dụng min-width hay overflow-x: auto, đảm bảo hiển thị hoàn hảo trên ứng dụng Gmail di động
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

  // Render từng ca xin nghỉ thành các Thẻ Khối (Cards) 100% width, tự thích ứng trên Mobile
  const leaveCardsHtml = leaveItems
    .map((item) => {
      let dateLabel = item.date;
      try {
        dateLabel = format(parseISO(item.date), "dd/MM/yyyy (EEEE)", { locale: vi });
      } catch {}

      const shiftLabel = LEAVE_SHIFT_LABELS[item.shift] || item.shift;
      const isMorning = item.shift === "morning";
      const isAfternoon = item.shift === "afternoon";
      const shiftCode = isMorning ? "S" : isAfternoon ? "C" : "CN";
      const shiftBg = isMorning ? "#f59e0b" : isAfternoon ? "#2563eb" : "#7e22ce";

      const reasonLabel = LEAVE_REASON_LABELS[item.reason] || item.reason;
      let reasonBadge = `<span style="background-color:#dcfce7;color:#166534;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold;border:1px solid #bbf7d0;">${reasonLabel}</span>`;
      if (item.reason === "om") {
        reasonBadge = `<span style="background-color:#fee2e2;color:#991b1b;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold;border:1px solid #fecaca;">${reasonLabel}</span>`;
      } else if (item.reason === "dihoc") {
        reasonBadge = `<span style="background-color:#e0e7ff;color:#3730a3;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold;border:1px solid #c7d2fe;">${reasonLabel}</span>`;
      } else if (item.reason === "khac") {
        reasonBadge = `<span style="background-color:#f1f5f9;color:#334155;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold;border:1px solid #e2e8f0;">${reasonLabel}</span>`;
      }

      const urgentBadge = item.isUrgent
        ? `<span style="background-color:#fee2e2;color:#991b1b;padding:3px 8px;border-radius:9999px;font-size:10px;font-weight:bold;border:1px solid #fecaca;white-space:nowrap;">🚨 Cấp thiết</span>`
        : `<span style="background-color:#f0fdf4;color:#166534;padding:3px 8px;border-radius:9999px;font-size:10px;font-weight:bold;border:1px solid #bbf7d0;white-space:nowrap;">Bình thường</span>`;

      // Phân tích định mức và hiển thị cảnh báo
      const count = item.existingLeaveCount ?? 0;
      const names = item.existingStaffNames && item.existingStaffNames.length > 0
        ? item.existingStaffNames.join(", ")
        : "";

      let quotaHtml = "";
      if (item.isQuotaExceeded || count >= 2) {
        quotaHtml = `
          <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:6px 10px;color:#991b1b;font-size:12px;font-weight:bold;margin-top:5px;">
            ⚠️ ${count}/2 (VƯỢT ĐỊNH MỨC NGHỈ/CA)
            ${names ? `<div style="font-weight:normal;font-size:11px;color:#7f1d1d;margin-top:2px;">Đã có: <strong>${names}</strong></div>` : ""}
          </div>
        `;
      } else if (count === 1) {
        quotaHtml = `
          <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:6px 10px;color:#1e40af;font-size:12px;font-weight:bold;margin-top:5px;">
            ℹ️ 1/2 (Đã có 1 người - Còn trống 1 chỗ)
            ${names ? `<div style="font-weight:normal;font-size:11px;color:#1e3a8a;margin-top:2px;">Đã có: <strong>${names}</strong></div>` : ""}
          </div>
        `;
      } else {
        quotaHtml = `
          <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:6px 10px;color:#166534;font-size:12px;font-weight:bold;margin-top:5px;">
            ✓ 0/2 (Ca còn trống chỗ)
          </div>
        `;
      }

      return `
        <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #cbd5e1;border-radius:10px;background-color:#ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.03);">
          <!-- Hàng Tiêu đề Thẻ -->
          <tr style="background-color:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 12px;font-size:13px;font-weight:bold;color:#0f172a;text-align:left;">
              📅 ${dateLabel}
            </td>
            <td style="padding:10px 12px;text-align:right;white-space:nowrap;">
              <span style="background-color:${shiftBg};color:#ffffff;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:900;display:inline-block;">
                ${shiftCode} · ${shiftLabel}
              </span>
              <span style="margin-left:4px;display:inline-block;">
                ${urgentBadge}
              </span>
            </td>
          </tr>
          <!-- Hàng Chi tiết Thẻ -->
          <tr>
            <td colspan="2" style="padding:10px 12px;font-size:12px;line-height:1.5;color:#334155;">
              <div style="margin-bottom:6px;">
                <span style="color:#64748b;font-size:11px;font-weight:bold;text-transform:uppercase;">Loại nghỉ: </span>
                ${reasonBadge}
              </div>
              <div style="margin-bottom:6px;">
                <span style="color:#64748b;font-size:11px;font-weight:bold;text-transform:uppercase;">Tình trạng định mức ca:</span>
                ${quotaHtml}
              </div>
              ${item.note ? `
              <div style="background-color:#f1f5f9;border-left:3px solid #94a3b8;border-radius:4px;padding:6px 10px;margin-top:6px;font-size:12px;color:#475569;font-style:italic;">
                <strong>Ghi chú:</strong> ${item.note}
              </div>` : ""}
            </td>
          </tr>
        </table>
      `;
    })
    .join("");

  const urgentAlertHtml = hasUrgent
    ? `
    <div style="background-color:#fff7ed;border-left:4px solid #f97316;padding:12px 14px;margin-bottom:16px;border-radius:8px;">
      <p style="margin:0 0 4px 0;font-weight:bold;color:#9a3412;font-size:13px;">⚠️ Lưu ý: Đơn có ca vượt định mức (≥ 2 người/ca)</p>
      <p style="margin:0;font-size:12px;color:#7c2d12;line-height:1.5;">
        Nhân sự đã đánh dấu <strong>Cấp thiết</strong>.<br/>
        <strong>Giải trình:</strong> ${urgentNote || "Không có ghi chú thêm."}
      </p>
    </div>
  `
    : "";

  const upcoming7DaysTableHtml = renderUpcoming7DaysTableHtml(upcoming7DaysLeaves, baseUrl);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Yêu cầu duyệt nghỉ phép</title>
    </head>
    <body style="margin:0;padding:12px 6px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 auto;max-width:600px;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%);padding:18px 16px;color:#ffffff;text-align:left;">
            <p style="margin:0 0 4px 0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">NurseFlow · Hệ thống phân công điều dưỡng</p>
            <h1 style="margin:0;font-size:18px;font-weight:bold;line-height:1.3;">Yêu cầu phê duyệt Đơn xin nghỉ phép</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:16px 14px;">
            ${urgentAlertHtml}

            <!-- Thông tin nhân sự -->
            <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:16px;">
              <tr>
                <td style="padding:10px 12px;font-size:13px;">
                  <table role="presentation" style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td style="padding:3px 0;color:#64748b;width:110px;font-size:12px;">Điều dưỡng:</td>
                      <td style="padding:3px 0;font-weight:bold;color:#0f172a;font-size:13px;">${staff.name} (${staff.code})</td>
                    </tr>
                    <tr>
                      <td style="padding:3px 0;color:#64748b;font-size:12px;">Email:</td>
                      <td style="padding:3px 0;color:#0f172a;font-size:13px;">${staff.email}</td>
                    </tr>
                    <tr>
                      <td style="padding:3px 0;color:#64748b;font-size:12px;">Quỹ phép ${yearlyStats.year}:</td>
                      <td style="padding:3px 0;font-weight:bold;color:#0d9488;font-size:13px;">
                        Đã nghỉ: ${yearlyStats.totalDays} ngày (${yearlyStats.totalSessions} buổi)
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Tiêu đề danh sách ca -->
            <h2 style="font-size:14px;font-weight:bold;color:#0f172a;margin:0 0 10px 0;">
              Danh sách ca xin nghỉ phép (${leaveItems.length} ca):
            </h2>

            <!-- Khối Thẻ ca xin nghỉ - Tự động co giãn 100% trên Mobile & Desktop -->
            ${leaveCardsHtml}

            <!-- Nút bấm phê duyệt 1 chạm Touch-Friendly -->
            <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0 12px 0;">
              <tr>
                <td align="center">
                  <a href="${approveUrl}" target="_blank" style="display:block;width:100%;max-width:380px;box-sizing:border-box;background-color:#0d9488;color:#ffffff;text-decoration:none;padding:15px 18px;border-radius:12px;font-size:16px;font-weight:bold;text-align:center;box-shadow:0 4px 14px rgba(13,148,136,0.3);letter-spacing:0.3px;">
                    ✅ DUYỆT ĐƠN NGHỈ PHÉP (1 CHẠM)
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-top:10px;">
                  <a href="${calendarUrl}" target="_blank" style="display:block;width:100%;max-width:380px;box-sizing:border-box;background-color:#f1f5f9;color:#0f766e;text-decoration:none;padding:11px 16px;border-radius:10px;font-size:12px;font-weight:bold;text-align:center;border:1px solid #ccfbf1;">
                    📅 Xem lịch đăng ký nghỉ phép trên Web →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Khối xem nhanh lịch nghỉ 7 ngày tới -->
            ${upcoming7DaysTableHtml}

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 12px 0;" />
            <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
              Sau khi duyệt, dữ liệu sẽ được ghi nhận chính thức vào Google Sheets và tự động gửi email thông báo xác thực tới Điều dưỡng ${staff.name} (BCC tới ĐD Nghĩa).
            </p>
          </td>
        </tr>
      </table>
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
  skipBcc?: boolean;
  isAutoApprovedStudy?: boolean;
}

/**
 * [QWEN3] Gửi email thông báo đơn đã duyệt tới người xin nghỉ phép
 * Đồng thời BCC tới ĐD Nghĩa (nghiadn.pk@pnt.edu.vn)
 * Thiết kế chuẩn Mobile Card Layout: Co giãn 100% tự nhiên trên mọi kích thước màn hình
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

  const { staff, leaveItems, approvedAt, upcoming7DaysLeaves, skipBcc = false, isAutoApprovedStudy = false } = params;
  const approvedTimeStr = approvedAt || format(new Date(), "HH:mm dd/MM/yyyy");
  const baseUrl = getBaseUrl();
  const calendarUrl = `${baseUrl}/dang-ky-phep?tab=calendar`;

  const subject = isAutoApprovedStudy
    ? `[XÁC THỰC THÀNH CÔNG] Lịch nghỉ đi học của ĐD ${staff.name} đã được xác nhận`
    : `[XÁC THỰC ĐỒNG Ý] Đơn xin nghỉ phép của ĐD ${staff.name} đã được phê duyệt`;

  // Render từng ca đã duyệt thành các thẻ khối (Cards) 100% width trên Mobile
  const leaveCardsHtml = leaveItems
    .map((item) => {
      let dateLabel = item.date;
      try {
        dateLabel = format(parseISO(item.date), "dd/MM/yyyy (EEEE)", { locale: vi });
      } catch {}

      const shiftLabel = LEAVE_SHIFT_LABELS[item.shift] || item.shift;
      const isMorning = item.shift === "morning";
      const isAfternoon = item.shift === "afternoon";
      const shiftCode = isMorning ? "S" : isAfternoon ? "C" : "CN";
      const shiftBg = isMorning ? "#f59e0b" : isAfternoon ? "#2563eb" : "#7e22ce";

      const reasonLabel = LEAVE_REASON_LABELS[item.reason] || item.reason;
      let reasonBadge = `<span style="background-color:#dcfce7;color:#166534;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold;border:1px solid #bbf7d0;">${reasonLabel}</span>`;
      if (item.reason === "om") {
        reasonBadge = `<span style="background-color:#fee2e2;color:#991b1b;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold;border:1px solid #fecaca;">${reasonLabel}</span>`;
      } else if (item.reason === "dihoc") {
        reasonBadge = `<span style="background-color:#e0e7ff;color:#3730a3;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold;border:1px solid #c7d2fe;">${reasonLabel}</span>`;
      } else if (item.reason === "khac") {
        reasonBadge = `<span style="background-color:#f1f5f9;color:#334155;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold;border:1px solid #e2e8f0;">${reasonLabel}</span>`;
      }

      return `
        <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:10px;border:1px solid #cbd5e1;border-radius:10px;background-color:#ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.03);">
          <tr style="background-color:#f0fdf4;border-bottom:1px solid #dcfce7;">
            <td style="padding:10px 12px;font-size:13px;font-weight:bold;color:#0f172a;text-align:left;">
              📅 ${dateLabel}
            </td>
            <td style="padding:10px 12px;text-align:right;white-space:nowrap;">
              <span style="background-color:${shiftBg};color:#ffffff;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:900;display:inline-block;">
                ${shiftCode} · ${shiftLabel}
              </span>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:10px 12px;font-size:12px;line-height:1.5;color:#334155;">
              <div style="margin-bottom:4px;">
                <span style="color:#64748b;font-size:11px;font-weight:bold;text-transform:uppercase;">Loại nghỉ: </span>
                ${reasonBadge}
              </div>
              <div>
                <span style="color:#64748b;font-size:11px;font-weight:bold;text-transform:uppercase;">Trạng thái: </span>
                <span style="color:#059669;font-weight:bold;font-size:12px;">✓ Đã phê duyệt chính thức</span>
              </div>
            </td>
          </tr>
        </table>
      `;
    })
    .join("");

  const upcoming7DaysTableHtml = renderUpcoming7DaysTableHtml(upcoming7DaysLeaves, baseUrl);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Đơn nghỉ phép đã được phê duyệt</title>
    </head>
    <body style="margin:0;padding:12px 6px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 auto;max-width:600px;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:18px 16px;color:#ffffff;text-align:left;">
            <p style="margin:0 0 4px 0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">NurseFlow · Xác thực phê duyệt</p>
            <h1 style="margin:0;font-size:18px;font-weight:bold;line-height:1.3;">${isAutoApprovedStudy ? "Lịch nghỉ đi học đã được XÁC NHẬN" : "Đơn xin nghỉ phép đã được PHÊ DUYỆT"}</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:16px 14px;">
            <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#1e293b;">
              Kính gửi Điều dưỡng <strong>${staff.name}</strong> (${staff.code}),
            </p>
            <p style="margin:0 0 16px 0;font-size:13px;line-height:1.6;color:#334155;">
              ${isAutoApprovedStudy
                ? `Lịch xin nghỉ đi học của bạn đã được hệ thống kiểm tra định mức (không quá 3 người nghỉ/buổi) và <strong>tự động xác nhận thành công</strong> vào lúc <strong>${approvedTimeStr}</strong>. Dữ liệu đã được cập nhật chính thức vào hệ thống.`
                : `Phiếu xin nghỉ phép của bạn đã được quản lý (<strong>tienmed@gmail.com</strong>) kiểm tra và <strong>chính thức phê duyệt</strong> vào lúc <strong>${approvedTimeStr}</strong>. Dữ liệu đã được cập nhật chính thức vào hệ thống.`}
            </p>

            <!-- Tiêu đề danh sách ca -->
            <h2 style="font-size:14px;font-weight:bold;color:#0f172a;margin:0 0 10px 0;">
              Danh sách ca nghỉ đã duyệt:
            </h2>

            <!-- Danh sách ca đã duyệt dạng Thẻ Card Mobile -->
            ${leaveCardsHtml}

            <!-- LƯU Ý LÀM PHIẾU GIẤY THEO QUI ĐỊNH -->
            <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #3b82f6;border-radius:8px;padding:12px 14px;margin:16px 0 18px 0;">
              <p style="margin:0 0 4px 0;font-weight:bold;color:#1e40af;font-size:13px;">
                📝 LƯU Ý THỦ TỤC QUAN TRỌNG:
              </p>
              <p style="margin:0;font-size:12px;color:#1e3a8a;line-height:1.5;">
                Sau khi phiếu nghỉ đã được phê duyệt trên hệ thống, <strong>bạn vui lòng tiến hành làm phiếu giấy xin nghỉ phép theo đúng quy định</strong> của đơn vị/bệnh viện và nộp lại cho bộ phận quản lý.
              </p>
            </div>

            <!-- NÚT XEM LỊCH TRÊN HỆ THỐNG (TOUCH-FRIENDLY) -->
            <table role="presentation" style="width:100%;border-collapse:collapse;margin:10px 0 14px 0;">
              <tr>
                <td align="center">
                  <a href="${calendarUrl}" target="_blank" style="display:block;width:100%;max-width:380px;box-sizing:border-box;background-color:#0f766e;color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:12px;font-size:14px;font-weight:bold;text-align:center;box-shadow:0 3px 12px rgba(15,118,110,0.25);">
                    📅 XEM LỊCH ĐĂNG KÝ NGHỈ PHÉP TRÊN WEB →
                  </a>
                </td>
              </tr>
            </table>

            <!-- KHỐI XEM NHANH LỊCH NGHỈ 7 NGÀY TỚI TRỰC TIẾP TRONG EMAIL -->
            ${upcoming7DaysTableHtml}

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 12px 0;" />
            <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
              ${skipBcc
                ? "Email này được gửi tự động từ hệ thống NurseFlow riêng tới cá nhân người đăng ký để xác nhận lịch nghỉ thành công."
                : `Email này được gửi tự động từ hệ thống NurseFlow tới người gửi phiếu và được đồng gửi (BCC) tới ĐD Nghĩa (${NOTIFY_BCC_EMAIL}) để theo dõi và đối soát.`}
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const mailOptions: nodemailer.SendMailOptions = {
      from: `"NurseFlow Hệ Thống" <${smtpUser}>`,
      to: staff.email,
      subject,
      html: htmlContent,
    };

    if (!skipBcc) {
      mailOptions.bcc = NOTIFY_BCC_EMAIL;
    }

    const info = await transporter.sendMail(mailOptions);

    console.log("✅ [EmailService] Gửi email xác nhận duyệt thành công:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("❌ [EmailService] Lỗi khi gửi email xác nhận duyệt:", err);
    return { success: false, error: err?.message || "Lỗi gửi email." };
  }
}
