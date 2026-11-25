import { format, parseISO } from "date-fns";
import { getMonthBounds } from "@/lib/date";
import type { Holiday } from "@/lib/types";
import type { MonthlyTimesheetStaffRow } from "@/lib/schedule";

export const MONTHLY_TIMESHEET_RECIPIENTS = [
  "trangdlt@pnt.edu.vn",
  "nghiadn.pk@pnt.edu.vn",
  "tienmed@gmail.com",
];

export function getMonthlyTimesheetRecipients(args: string[] = []): string[] {
  // 1. Nhận qua tham số dòng lệnh --to=a@pnt.edu.vn,b@pnt.edu.vn hoặc --to a@pnt.edu.vn
  let cliTo = args.find((a) => a.startsWith("--to="))?.split("=")[1];
  if (!cliTo) {
    const idx = args.indexOf("--to");
    if (idx !== -1 && idx + 1 < args.length) {
      cliTo = args[idx + 1];
    }
  }
  if (cliTo && cliTo.trim()) {
    return cliTo
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  }

  // 2. Nhận qua biến môi trường MONTHLY_TIMESHEET_RECIPIENTS
  const envTo = process.env.MONTHLY_TIMESHEET_RECIPIENTS;
  if (envTo && envTo.trim()) {
    return envTo
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  }

  // 3. Mặc định 3 người nhận theo yêu cầu nghiệp vụ
  return [...MONTHLY_TIMESHEET_RECIPIENTS];
}

export interface MonthlyTimesheetStats {
  staffCount: number;
  totalWorkDays: number;
  totalLeaveP: number;
  totalLeaveH: number;
  totalLeaveO: number;
  totalLeaveDays: number;
  totalOvertimeShifts: number;
  totalOvertimeDays: number;
}

export interface MonthlyEmailOptions {
  monthKey: string;
  timesheet: MonthlyTimesheetStaffRow[];
  holidays?: Holiday[];
  generatedAt?: Date;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getPreviousMonthKey(referenceDate?: Date): string {
  const base = referenceDate ?? new Date();
  // Chuyển sang múi giờ Việt Nam (Asia/Ho_Chi_Minh / UTC+7) theo chuẩn [P0-TIME-01]
  const vnDateStr = base.toLocaleString("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const vnDate = new Date(vnDateStr);
  const d = new Date(
    vnDate.getFullYear(),
    vnDate.getMonth() - 1,
    1
  );
  return format(d, "yyyy-MM");
}

export function parseMonthArg(
  args: string[],
  referenceDate?: Date
): string {
  let monthArg = args.find((a) => a.startsWith("--month="))?.split("=")[1];
  if (!monthArg) {
    const idx = args.indexOf("--month");
    if (idx !== -1 && idx + 1 < args.length) {
      monthArg = args[idx + 1];
    }
  }
  if (!monthArg) {
    return getPreviousMonthKey(referenceDate);
  }
  const trimmed = monthArg.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) {
    throw new Error(
      `Định dạng --month không hợp lệ: "${monthArg}". Định dạng chuẩn là YYYY-MM (ví dụ: --month=2026-10)`
    );
  }
  return trimmed;
}

export function calculateMonthlyTimesheetStats(
  timesheet: MonthlyTimesheetStaffRow[]
): MonthlyTimesheetStats {
  let totalWorkShifts = 0;
  let totalLeavePShifts = 0;
  let totalLeaveHShifts = 0;
  let totalLeaveOShifts = 0;
  let totalOvertimeShifts = 0;

  for (const row of timesheet) {
    totalWorkShifts += row.totalWork;
    totalLeavePShifts += row.totalLeaveP;
    totalLeaveHShifts += row.totalLeaveH;
    totalLeaveOShifts += row.totalLeaveO;
    totalOvertimeShifts += row.totalOvertime;
  }

  const totalLeaveP = totalLeavePShifts / 2;
  const totalLeaveH = totalLeaveHShifts / 2;
  const totalLeaveO = totalLeaveOShifts / 2;

  return {
    staffCount: timesheet.length,
    totalWorkDays: totalWorkShifts / 2,
    totalLeaveP,
    totalLeaveH,
    totalLeaveO,
    totalLeaveDays: totalLeaveP + totalLeaveH + totalLeaveO,
    totalOvertimeShifts,
    totalOvertimeDays: totalOvertimeShifts / 2,
  };
}

export function buildMonthlyTimesheetEmailHtml({
  monthKey,
  timesheet,
  generatedAt = new Date(),
}: MonthlyEmailOptions): {
  subject: string;
  html: string;
  stats: MonthlyTimesheetStats;
} {
  const stats = calculateMonthlyTimesheetStats(timesheet);
  const { start, end } = getMonthBounds(monthKey);
  const startDate = parseISO(start);
  const endDate = parseISO(end);

  const displayMonth = format(startDate, "MM/yyyy");
  const periodRange = `${format(startDate, "dd/MM/yyyy")} – ${format(endDate, "dd/MM/yyyy")}`;
  const generatedTimeStr = format(generatedAt, "HH:mm dd/MM/yyyy");

  const subject = `[NurseFlow] Bảng tổng hợp chấm công tháng ${displayMonth}`;

  // Bảng tổng hợp nhân sự dạng HTML
  const staffRowsHtml = timesheet
    .map((row, idx) => {
      const workDays = row.totalWork > 0 ? (row.totalWork / 2).toString() : "0";
      const leaves: string[] = [];
      if (row.totalLeaveP > 0) leaves.push(`P: ${row.totalLeaveP / 2}`);
      if (row.totalLeaveH > 0) leaves.push(`H: ${row.totalLeaveH / 2}`);
      if (row.totalLeaveO > 0) leaves.push(`O: ${row.totalLeaveO / 2}`);
      const leaveText = leaves.length > 0 ? leaves.join(" | ") : "0";
      const otText =
        row.totalOvertime > 0 ? (row.totalOvertime / 2).toString() : "0";

      const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
      const otStyle =
        row.totalOvertime > 0
          ? "color:#b45309;font-weight:700;"
          : "color:#64748b;";
      const leaveStyle =
        leaves.length > 0
          ? "color:#475569;font-weight:600;"
          : "color:#94a3b8;";

      return `
        <tr style="background-color:${bg};">
          <td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">${idx + 1}</td>
          <td style="padding:7px 12px;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(row.name)}</td>
          <td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;font-size:13px;font-weight:700;color:#0f766e;">${workDays}</td>
          <td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;font-size:12px;${leaveStyle}">${escapeHtml(leaveText)}</td>
          <td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;font-size:13px;${otStyle}">${otText}</td>
        </tr>
      `;
    })
    .join("");

  const totalLeaveSummary = [];
  if (stats.totalLeaveP > 0) totalLeaveSummary.push(`P: ${stats.totalLeaveP}`);
  if (stats.totalLeaveH > 0) totalLeaveSummary.push(`H: ${stats.totalLeaveH}`);
  if (stats.totalLeaveO > 0) totalLeaveSummary.push(`O: ${stats.totalLeaveO}`);
  const totalLeaveSummaryStr =
    totalLeaveSummary.length > 0 ? totalLeaveSummary.join(" · ") : "0";

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(subject)}</title>
  <style>
    body, table, td, th, p, a, div, span {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td, th {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
  </style>
</head>
<body style="margin:0;padding:16px 8px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:720px;margin:0 auto;background-color:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #cbd5e1;box-shadow:0 4px 16px rgba(15,23,42,0.06);">
    <!-- Header -->
    <tr>
      <td style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%);padding:22px 20px;color:#ffffff;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#ccfbf1;margin-bottom:6px;">
          NURSEFLOW &bull; BÁO CÁO ĐIỀU HÀNH THÁNG
        </div>
        <h1 style="margin:0 0 10px 0;font-size:20px;font-weight:700;line-height:1.35;color:#ffffff;">
          Báo Cáo Chấm Công Tháng ${escapeHtml(displayMonth)}
        </h1>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="background-color:rgba(255,255,255,0.18);padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;color:#ffffff;">
              📅 Kỳ công: ${escapeHtml(periodRange)}
            </td>
            <td style="width:8px;"></td>
            <td style="background-color:#dcfce7;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;color:#166534;">
              📎 Đã đính kèm Excel
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:20px 18px 16px 18px;">
        <!-- Lời chào trang trọng -->
        <div style="background-color:#f8fafc;border-left:4px solid #0d9488;border-radius:4px;padding:12px 14px;margin-bottom:20px;">
          <p style="margin:0 0 6px 0;font-size:13px;line-height:1.5;color:#334155;">
            <strong>Kính gửi:</strong>
          </p>
          <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:#334155;">
            <li><strong>ĐD. Đặng Lê Tú Trang</strong> – Điều dưỡng Quản lý / Hành chính KHNV</li>
            <li><strong>ĐD. Đặng Nhân Nghĩa</strong> – Phụ trách điều phối điều dưỡng</li>
            <li><strong>BS. Trịnh Trung Tiến</strong> – Ban Giám đốc / Phụ trách phòng khám</li>
          </ul>
          <p style="margin:8px 0 0 0;font-size:13px;line-height:1.5;color:#475569;">
            Hệ thống NurseFlow xin kính gửi bảng tổng hợp số liệu chấm công tháng <strong>${escapeHtml(displayMonth)}</strong> của đội ngũ điều dưỡng. Tệp tin Excel bảng công chi tiết từng ca trong tháng đã được đính kèm theo thư này.
          </p>
        </div>

        <!-- 4 Khối tóm tắt KPI -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;border-collapse:collapse;">
          <tr>
            <td style="width:25%;padding:4px;">
              <div style="background-color:#f0fdfa;border:1px solid #ccfbf1;border-radius:10px;padding:12px 10px;text-align:center;">
                <div style="font-size:10px;font-weight:700;color:#0f766e;text-transform:uppercase;margin-bottom:4px;">Nhân sự</div>
                <div style="font-size:22px;font-weight:800;color:#0f766e;">${stats.staffCount}</div>
                <div style="font-size:11px;color:#14b8a6;margin-top:2px;">điều dưỡng</div>
              </div>
            </td>
            <td style="width:25%;padding:4px;">
              <div style="background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:12px 10px;text-align:center;">
                <div style="font-size:10px;font-weight:700;color:#047857;text-transform:uppercase;margin-bottom:4px;">Ngày làm</div>
                <div style="font-size:22px;font-weight:800;color:#047857;">${stats.totalWorkDays}</div>
                <div style="font-size:11px;color:#059669;margin-top:2px;">ngày công</div>
              </div>
            </td>
            <td style="width:25%;padding:4px;">
              <div style="background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:12px 10px;text-align:center;">
                <div style="font-size:10px;font-weight:700;color:#334155;text-transform:uppercase;margin-bottom:4px;">Tổng phép</div>
                <div style="font-size:22px;font-weight:800;color:#334155;">${stats.totalLeaveDays}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;">ngày nghỉ</div>
              </div>
            </td>
            <td style="width:25%;padding:4px;">
              <div style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 10px;text-align:center;">
                <div style="font-size:10px;font-weight:700;color:#b45309;text-transform:uppercase;margin-bottom:4px;">Tăng ca T7</div>
                <div style="font-size:22px;font-weight:800;color:#b45309;">${stats.totalOvertimeDays}</div>
                <div style="font-size:11px;color:#d97706;margin-top:2px;">ngày (${stats.totalOvertimeShifts} ca)</div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Bảng tổng hợp số liệu từng nhân sự -->
        <div style="margin-bottom:18px;">
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;display:flex;align-items:center;">
            <span>📋 BẢNG TỔNG HỢP CÔNG THÁNG THEO NHÂN SỰ</span>
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%);color:#ffffff;">
                <th style="padding:8px 8px;font-size:11px;font-weight:700;text-align:center;width:40px;border:1px solid #0f766e;">STT</th>
                <th style="padding:8px 12px;font-size:11px;font-weight:700;text-align:left;border:1px solid #0f766e;">Họ và Tên</th>
                <th style="padding:8px 8px;font-size:11px;font-weight:700;text-align:center;width:85px;border:1px solid #0f766e;">Σ Ngày làm</th>
                <th style="padding:8px 8px;font-size:11px;font-weight:700;text-align:center;width:110px;border:1px solid #0f766e;">Σ Nghỉ phép</th>
                <th style="padding:8px 8px;font-size:11px;font-weight:700;text-align:center;width:80px;border:1px solid #0f766e;">Σ Tăng ca</th>
              </tr>
            </thead>
            <tbody>
              ${staffRowsHtml}
              <!-- Dòng Tổng cộng -->
              <tr style="background-color:#f1f5f9;font-weight:700;border-top:2px solid #cbd5e1;">
                <td colspan="2" style="padding:9px 12px;border:1px solid #cbd5e1;font-size:12px;color:#0f172a;text-align:right;">
                  TỔNG CỘNG (${stats.staffCount} ĐD):
                </td>
                <td style="padding:9px 8px;border:1px solid #cbd5e1;font-size:13px;color:#0f766e;text-align:center;">
                  ${stats.totalWorkDays}
                </td>
                <td style="padding:9px 8px;border:1px solid #cbd5e1;font-size:11px;color:#334155;text-align:center;">
                  ${escapeHtml(totalLeaveSummaryStr)}
                </td>
                <td style="padding:9px 8px;border:1px solid #cbd5e1;font-size:13px;color:#b45309;text-align:center;">
                  ${stats.totalOvertimeDays}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Box ghi chú ký hiệu và quy chuẩn -->
        <div style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:12px 14px;margin-bottom:18px;">
          <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:6px;">
            💡 Chú Thích Quy Ước Chấm Công:
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:12px;color:#475569;line-height:1.7;">
            <tr>
              <td style="padding-right:16px;">• <strong style="color:#0d9488;">✔</strong>: Đi làm đúng ca (1 buổi = 0.5 ngày công)</td>
              <td style="padding-right:16px;">• <strong style="color:#d97706;">T</strong>: Ca tăng ca Sáng Thứ 7</td>
            </tr>
            <tr>
              <td style="padding-right:16px;">• <strong style="color:#475569;">P</strong>: Nghỉ phép năm / việc riêng</td>
              <td style="padding-right:16px;">• <strong style="color:#4338ca;">H</strong>: Nghỉ đi học đào tạo</td>
            </tr>
            <tr>
              <td colspan="2">• <strong style="color:#e11d48;">O</strong>: Nghỉ ốm / thai sản</td>
            </tr>
          </table>
        </div>

        <!-- Thông báo file đính kèm -->
        <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 16px;margin-bottom:16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width:36px;vertical-align:middle;font-size:24px;">📊</td>
              <td style="vertical-align:middle;padding-left:8px;">
                <div style="font-size:13px;font-weight:700;color:#1e40af;">
                  Tệp đính kèm: <code>bao-cao-thang-${escapeHtml(monthKey)}.xlsx</code>
                </div>
                <div style="font-size:12px;color:#3b82f6;margin-top:2px;">
                  Bảng tính Excel chứa chi tiết điểm danh từng buổi Sáng / Chiều suốt toàn bộ ${endDate.getDate()} ngày trong tháng ${escapeHtml(displayMonth)}.
                </div>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#f8fafc;padding:16px 20px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;line-height:1.6;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <strong>NurseFlow</strong> &bull; Hệ thống Quản trị Lịch Phân Công Điều Dưỡng<br>
              Phòng khám Đa khoa Trường Đại học Y khoa Phạm Ngọc Thạch<br>
              <span style="color:#94a3b8;">Email được gửi tự động vào 08:00 sáng ngày đầu tiên của tháng mới. Xuất bản lúc: ${escapeHtml(generatedTimeStr)}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, stats };
}
