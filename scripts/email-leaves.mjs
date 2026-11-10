import { google } from "googleapis";
import nodemailer from "nodemailer";

const requiredEnv = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Thiếu biến môi trường bắt buộc: ${key}. Vui lòng chạy lệnh với node --env-file=.env.local`);
  }
}

// Chọn tài khoản gửi (email Nghiệp vụ)
const smtpUser = process.env.SMTP_USER_NV;
const smtpPass = process.env.SMTP_PASS_NV;
const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = process.env.SMTP_PORT || 465;

if (!smtpUser || !smtpPass) {
  console.error("Lỗi: Thiếu cấu hình SMTP_USER_NV hoặc SMTP_PASS_NV trong file .env.local.");
  process.exit(1);
}

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");

const auth = new google.auth.JWT({
  email,
  key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

function formatReason(rawReason) {
  const r = (rawReason || "").toLowerCase().trim();
  if (r === "personal" || r === "viec-rieng" || r === "rieng") {
    return { text: "Việc riêng", bg: "#f1f5f9", color: "#334155" };
  }
  if (r === "sick" || r === "om" || r === "nghi-om") {
    return { text: "Nghỉ ốm", bg: "#fef2f2", color: "#991b1b" };
  }
  if (r === "vacation" || r === "phep" || r === "annual" || r === "phep-nam") {
    return { text: "Phép năm", bg: "#f0fdf4", color: "#166534" };
  }
  if (r === "dihoc" || r === "hoc" || r === "study") {
    return { text: "Đi học", bg: "#eff6ff", color: "#1d4ed8" };
  }
  return { text: rawReason || "Khác", bg: "#f8fafc", color: "#475569" };
}

function formatShift(rawShift) {
  const s = (rawShift || "").toLowerCase().trim();
  if (s === "morning" || s === "sang") {
    return { text: "Ca Sáng", bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0" };
  }
  if (s === "afternoon" || s === "chieu") {
    return { text: "Ca Chiều", bg: "#f0f9ff", color: "#075985", border: "#bae6fd" };
  }
  return { text: "Cả Ngày", bg: "#fef3c7", color: "#92400e", border: "#fde68a" };
}

async function main() {
  const currentDay = new Date().getDay();
  if (currentDay === 5 || currentDay === 6) {
    console.log("Hệ thống được cấu hình không gửi email vào tối Thứ 6 và Thứ 7. Đang thoát...");
    return;
  }

  console.log("Đang kiểm tra dữ liệu ngày mai...");

  // Gọi API tự động chốt lịch nếu tuần mới chưa có dữ liệu
  try {
    console.log("Đang gọi API tự động sinh lịch...");
    await fetch("http://localhost:3000/api/schedule/generate");
  } catch (e) {
    console.error("Lỗi gọi API sinh lịch:", e);
  }

  // Lấy ngày MAI
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  const tomorrowStr = `${year}-${month}-${day}`;
  const displayDate = `${day}/${month}/${year}`;

  const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayOfWeekStr = dayNames[tomorrow.getDay()];
  const fullDateLabel = `${dayOfWeekStr}, ngày ${displayDate}`;

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["staff!A:Z", "leave_requests!A:Z", "weekly_schedule!A:Z", "positions!A:Z"],
  });

  const staffValues = res.data.valueRanges?.[0]?.values || [];
  const leaveValues = res.data.valueRanges?.[1]?.values || [];
  const positionValues = res.data.valueRanges?.[3]?.values || [];

  if (staffValues.length === 0) {
    console.log("Không tìm thấy dữ liệu nhân sự.");
    return;
  }

  // --- MAP DỮ LIỆU ---
  const staffHeaders = staffValues[0].map(String);
  const staffMap = new Map();
  const sIdIdx = staffHeaders.indexOf("id");
  const sNameIdx = staffHeaders.indexOf("name");
  for (let i = 1; i < staffValues.length; i++) {
    if (staffValues[i][sIdIdx]) {
      staffMap.set(staffValues[i][sIdIdx], staffValues[i][sNameIdx] || "Không rõ");
    }
  }

  const posHeaders = positionValues[0]?.map(String) || [];
  const posMap = new Map();
  const pIdIdx = posHeaders.indexOf("id");
  const pNameIdx = posHeaders.indexOf("name");
  for (let i = 1; i < positionValues.length; i++) {
    if (positionValues[i][pIdIdx]) {
      posMap.set(positionValues[i][pIdIdx], positionValues[i][pNameIdx] || "Không rõ");
    }
  }

  const leaveHeaders = leaveValues[0]?.map(String) || [];
  const leaveStaffIdIdx = leaveHeaders.indexOf("staffId");
  const leaveDateIdx = leaveHeaders.indexOf("date");
  const leaveShiftIdx = leaveHeaders.indexOf("shift");
  const leaveReasonIdx = leaveHeaders.indexOf("reason");
  const leaveNoteIdx = leaveHeaders.indexOf("note");

  // --- LOGIC 1: LỌC NGHỈ PHÉP NGÀY MAI ---
  const tomorrowLeavesList = [];

  for (let i = 1; i < leaveValues.length; i++) {
    const row = leaveValues[i];
    if (row[leaveDateIdx] === tomorrowStr) {
      const staffId = row[leaveStaffIdIdx];
      const shift = row[leaveShiftIdx] || "full-day";
      const rawReason = row[leaveReasonIdx] || "Không rõ";
      const note = row[leaveNoteIdx] || "";
      const name = staffMap.get(staffId) || "Nhân sự không xác định";

      const shiftInfo = formatShift(shift);
      const reasonInfo = formatReason(rawReason);

      tomorrowLeavesList.push({
        name,
        shift: shiftInfo,
        reason: reasonInfo,
        note: note.trim(),
      });
    }
  }

  // --- QUYẾT ĐỊNH GỬI EMAIL ---
  const shouldSend = tomorrowLeavesList.length > 0;

  if (!shouldSend) {
    console.log(`Ngày mai (${displayDate}) không có nhân sự nào nghỉ phép.`);
    console.log("Theo cấu hình, hệ thống sẽ KHÔNG gửi email.");
    return;
  }

  console.log(`Phát hiện điều kiện cần thông báo cho ngày mai (${displayDate}). Đang gửi email...`);

  // --- TẠO NỘI DUNG EMAIL GỌN GÀNG, TỐI ƯU MOBILE ---
  const leaveCardsHtml = tomorrowLeavesList
    .map(
      (item) => `
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #0d9488;border-radius:8px;padding:12px 14px;margin-bottom:10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:none;border-collapse:collapse;">
            <tr>
              <td style="font-size:15px;font-weight:600;color:#0f172a;vertical-align:middle;">
                ${item.name}
              </td>
              <td style="text-align:right;vertical-align:middle;">
                <span style="display:inline-block;padding:3px 10px;font-size:12px;font-weight:600;border-radius:12px;background:${item.shift.bg};color:${item.shift.color};border:1px solid ${item.shift.border};white-space:nowrap;">
                  ${item.shift.text}
                </span>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:6px;font-size:13px;color:#475569;">
                <span style="display:inline-block;padding:2px 8px;font-size:11px;font-weight:600;border-radius:4px;background:${item.reason.bg};color:${item.reason.color};">
                  ${item.reason.text}
                </span>
                ${
                  item.note
                    ? `<span style="margin-left:8px;color:#64748b;font-size:12px;font-style:italic;">💬 ${item.note}</span>`
                    : ""
                }
              </td>
            </tr>
          </table>
        </div>
      `
    )
    .join("");

  const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Thông báo nghỉ phép ngày mai (${displayDate})</title>
  <style>
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:20px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #0d9488 0%, #0f766e 100%);padding:22px 18px;text-align:center;">
              <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.85);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">
                HỆ THỐNG ĐIỀU PHỐI ĐIỀU DƯỠNG NUSRES
              </div>
              <h1 style="margin:0 0 10px 0;font-size:19px;font-weight:700;color:#ffffff;line-height:1.3;">
                Thông Báo Nghỉ Phép Ngày Mai
              </h1>
              <div style="display:inline-block;background:rgba(255,255,255,0.2);padding:4px 14px;border-radius:20px;font-size:13px;font-weight:500;color:#ffffff;">
                📅 ${fullDateLabel}
              </div>
            </td>
          </tr>

          <!-- Content List -->
          <tr>
            <td style="padding:18px 16px 10px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-bottom:1px solid #f1f5f9;">
                <tr>
                  <td style="padding-bottom:10px;font-size:14px;font-weight:700;color:#0f766e;">
                    📋 Danh sách nghỉ phép (${tomorrowLeavesList.length} lượt)
                  </td>
                </tr>
              </table>

              ${leaveCardsHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:16px 18px 20px 18px;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:12px;color:#64748b;font-weight:500;">
                Nusres System &bull; Lịch trực & Điều phối y tế
              </p>
              <p style="margin:0;font-size:11px;color:#94a3b8;font-style:italic;">
                Lưu ý: Đây là email tự động từ hệ thống, vui lòng không phản hồi.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // --- GỬI EMAIL ---
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const mailOptions = {
    from: `"Nusres System" <${smtpUser}>`,
    bcc: "tienmed@gmail.com, nghiadn.pk@pnt.edu.vn, thientrang250392pnt@gmail.com",
    subject: `[Nusres] Danh sách nghỉ phép ngày mai - ${dayOfWeekStr} (${displayDate})`,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Gửi email thành công! Message ID:", info.messageId);
    try {
      const { exec } = await import("child_process");
      const psScript = `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); $textNodes = $template.GetElementsByTagName('text'); $textNodes.Item(0).AppendChild($template.CreateTextNode('Nusres - Lịch Vận Hành')) > $null; $textNodes.Item(1).AppendChild($template.CreateTextNode('Đã gửi email lịch vận hành ngày ${displayDate} thành công!')) > $null; $toast = [Windows.UI.Notifications.ToastNotification]::new($template); [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Nusres System').Show($toast);`;
      const encodedCommand = Buffer.from(psScript, "utf16le").toString("base64");
      exec(`powershell -NoProfile -EncodedCommand ${encodedCommand}`);
    } catch {}
  } catch (err) {
    console.error("❌ Lỗi khi gửi email:", err);
  }
}

main().catch((error) => {
  console.error("Lỗi khi chạy kịch bản gửi email:", error instanceof Error ? error.message : error);
  process.exit(1);
});
