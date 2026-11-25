import { google } from "googleapis";
import nodemailer from "nodemailer";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SHEET_NAMES } from "@/lib/constants";
import { buildMonthlyTimesheet } from "@/lib/schedule";
import { generateMonthlyTimesheetExcelBuffer } from "@/lib/monthly-timesheet-excel";
import {
  buildMonthlyTimesheetEmailHtml,
  getMonthlyTimesheetRecipients,
  parseMonthArg,
} from "@/lib/monthly-email-html";

const requiredGoogleEnv = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
];

for (const key of requiredGoogleEnv) {
  if (!process.env[key]) {
    throw new Error(
      `Thiếu biến môi trường bắt buộc: ${key}. Vui lòng chạy lệnh với: node --import ./scripts/register-alias.mjs --env-file=.env.local --env-file=email.env scripts/email-monthly-timesheet.mjs`
    );
  }
}

const args = process.argv.slice(2);
const isPreview = args.includes("--preview");
const outArg = args.find((a) => a.startsWith("--out="))?.split("=")[1];
const outHtmlArg = args.find((a) => a.startsWith("--out-html="))?.split("=")[1];

function asBoolean(value) {
  return String(value ?? "").trim().toLowerCase() === "true";
}

function parseRows(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0].map((h) => String(h ?? "").trim());
  return values
    .slice(1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => {
      const obj = {};
      headers.forEach((h, idx) => {
        if (h) obj[h] = String(row[idx] ?? "");
      });
      return obj;
    });
}

function computeEffectiveLeaves(leaveRequests, leaveCancellations) {
  const approved = leaveRequests.filter(
    (l) => l.status === "approved" || !l.status
  );
  if (!leaveCancellations || leaveCancellations.length === 0) return approved;

  const fullDayCancelSet = new Set(
    leaveCancellations
      .filter((c) => c.shift === "full-day")
      .map((c) => `${c.staffId}-${c.date}`)
  );
  const shiftCancelSet = new Set(
    leaveCancellations.map((c) => `${c.staffId}-${c.date}-${c.shift}`)
  );

  const effective = [];
  for (const leave of approved) {
    const dayKey = `${leave.staffId}-${leave.date}`;
    if (fullDayCancelSet.has(dayKey)) continue;

    if (leave.shift === "full-day") {
      const cancelMorning = shiftCancelSet.has(`${dayKey}-morning`);
      const cancelAfternoon = shiftCancelSet.has(`${dayKey}-afternoon`);
      if (cancelMorning && cancelAfternoon) continue;
      if (cancelMorning) {
        effective.push({ ...leave, shift: "afternoon" });
        continue;
      }
      if (cancelAfternoon) {
        effective.push({ ...leave, shift: "morning" });
        continue;
      }
      effective.push(leave);
      continue;
    }

    if (shiftCancelSet.has(`${dayKey}-${leave.shift}`)) continue;
    effective.push(leave);
  }
  return effective;
}

async function main() {
  const monthKey = parseMonthArg(args);
  console.log(
    `[MonthlyTimesheet] Tháng mục tiêu: ${monthKey} | Chế độ Preview: ${isPreview}`
  );

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: [
      isPreview
        ? "https://www.googleapis.com/auth/spreadsheets.readonly"
        : "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
  const sheets = google.sheets({ version: "v4", auth });

  console.log(`[MonthlyTimesheet] Đang tải dữ liệu từ Google Sheets...`);
  const sheetRanges = [
    `${SHEET_NAMES.staff}!A:Z`,
    `${SHEET_NAMES.positions}!A:Z`,
    `${SHEET_NAMES.scheduleRules}!A:Z`,
    `${SHEET_NAMES.weeklySchedule}!A:Z`,
    `${SHEET_NAMES.leaveRequests}!A:Z`,
    `${SHEET_NAMES.positionRules}!A:Z`,
    `${SHEET_NAMES.leaveCancellations}!A:Z`,
    `${SHEET_NAMES.holidays}!A:Z`,
  ];

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: sheetRanges,
  });

  const valueRanges = res.data.valueRanges || [];
  const staff = parseRows(valueRanges[0]?.values).map((r, idx) => ({
    id: r.id || `staff-${idx + 1}`,
    name: r.name,
    code: r.code,
    email: r.email || "",
    role: r.role || "viewer",
    positionIds: r.positionIds
      ? r.positionIds
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [],
    active: asBoolean(r.active || "true"),
    prefersOvertime: asBoolean(r.prefersOvertime || "false"),
    notes: r.notes || "",
  }));

  const positions = parseRows(valueRanges[1]?.values).map((r, idx) => ({
    id: r.id || `position-${idx + 1}`,
    name: r.name,
    area: r.area,
    description: r.description || "",
    quota: Number(r.quota || 1),
    staffOrder: r.staffOrder
      ? r.staffOrder
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [],
  }));

  const scheduleRules = parseRows(valueRanges[2]?.values).map((r, idx) => ({
    id: r.id || `rule-${idx + 1}`,
    dayOfWeek: Number(r.dayOfWeek),
    shift: r.shift,
    active: asBoolean(r.active ?? "true"),
    label: r.label || "",
  }));

  const weeklySchedule = parseRows(valueRanges[3]?.values).map((r, idx) => ({
    id: r.id || `weekly-${idx + 1}`,
    weekStart: r.weekStart || "",
    date: r.date,
    shift: r.shift,
    positionId: r.positionId,
    staffId: r.staffId,
    slotIndex: Number(r.slotIndex || 0),
    source: r.source || "manual",
    status: r.status || "published",
    note: r.note || "",
  }));

  const leaveRequests = parseRows(valueRanges[4]?.values).map((r, idx) => ({
    id: r.id || `leave-${idx + 1}`,
    staffId: r.staffId,
    date: r.date,
    shift: r.shift,
    reason: r.reason,
    note: r.note || "",
    status: r.status || "approved",
    approveToken: r.approveToken || "",
    createdAt: r.createdAt || "",
  }));

  const positionRules = parseRows(valueRanges[5]?.values).map((r, idx) => ({
    id: r.id || `posrule-${idx + 1}`,
    positionId: r.positionId,
    dayOfWeek: Number(r.dayOfWeek),
    shift: r.shift,
    active: asBoolean(r.active ?? "true"),
  }));

  const leaveCancellations = parseRows(valueRanges[6]?.values).map(
    (r, idx) => ({
      id: r.id || `cancel-${idx + 1}`,
      staffId: r.staffId,
      date: r.date,
      shift: r.shift,
      cancelledAt: r.cancelledAt || "",
    })
  );

  const holidays = parseRows(valueRanges[7]?.values).map((r, idx) => ({
    id: r.id || `holiday-${idx + 1}`,
    date: r.date,
    name: r.name,
    note: r.note || "",
  }));

  const effectiveLeaves = computeEffectiveLeaves(
    leaveRequests,
    leaveCancellations
  );

  console.log(
    `[MonthlyTimesheet] Dữ liệu tải về: ${staff.length} nhân sự | ${weeklySchedule.length} ca lịch | ${effectiveLeaves.length} ca phép hợp lệ | ${holidays.length} ngày lễ`
  );

  console.log(
    `[MonthlyTimesheet] Đang tổng hợp chấm công tháng ${monthKey}...`
  );
  const timesheet = buildMonthlyTimesheet(
    weeklySchedule,
    effectiveLeaves,
    staff,
    positions,
    scheduleRules,
    positionRules,
    monthKey,
    holidays
  );

  console.log(
    `[MonthlyTimesheet] Đang tạo bảng tính Excel chấm công chuẩn...`
  );
  const excelBuffer = await generateMonthlyTimesheetExcelBuffer({
    monthKey,
    timesheet,
    holidays,
  });

  const { subject, html, stats } = buildMonthlyTimesheetEmailHtml({
    monthKey,
    timesheet,
    holidays,
  });

  console.log(
    `[MonthlyTimesheet] Thống kê tháng ${monthKey}: ${stats.staffCount} nhân sự | ${stats.totalWorkDays} công đi làm | ${stats.totalLeaveDays} ngày phép (P:${stats.totalLeaveP}, H:${stats.totalLeaveH}, O:${stats.totalLeaveO}) | ${stats.totalOvertimeDays} ngày tăng ca (${stats.totalOvertimeShifts} ca)`
  );

  const excelFileName = `bao-cao-thang-${monthKey}.xlsx`;

  const recipients = getMonthlyTimesheetRecipients(args);

  if (isPreview || outArg || outHtmlArg) {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(scriptDir, "..");
    const defaultExcelOut = path.resolve(
      projectRoot,
      `tmp-monthly-timesheet-${monthKey}.xlsx`
    );
    const targetExcelOut = outArg ? path.resolve(outArg) : defaultExcelOut;

    const defaultHtmlOut = path.resolve(
      projectRoot,
      `tmp-monthly-email-${monthKey}.html`
    );
    const targetHtmlOut = outHtmlArg
      ? path.resolve(outHtmlArg)
      : defaultHtmlOut;

    mkdirSync(path.dirname(targetExcelOut), { recursive: true });
    writeFileSync(targetExcelOut, excelBuffer);

    mkdirSync(path.dirname(targetHtmlOut), { recursive: true });
    writeFileSync(targetHtmlOut, html, "utf8");

    console.log(`\n================= [PREVIEW MODE] =================`);
    console.log(`✅ Tiêu đề email: ${subject}`);
    console.log(`👥 Người nhận (${recipients.length}):`);
    recipients.forEach((email, i) => {
      console.log(`   ${i + 1}. ${email}`);
    });
    console.log(`📊 Đã xuất file Excel tại: ${targetExcelOut}`);
    console.log(`✉️ Đã xuất bản HTML email tại: ${targetHtmlOut}`);
    console.log(`==================================================\n`);
    return;
  }

  // Chế độ GỬI EMAIL THẬT
  const smtpUser = process.env.SMTP_USER_NV;
  const smtpPass = process.env.SMTP_PASS_NV;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);

  if (!smtpUser || !smtpPass) {
    throw new Error(
      "Thiếu SMTP_USER_NV hoặc SMTP_PASS_NV trong môi trường. Vui lòng kiểm tra email.env."
    );
  }

  console.log(
    `[MonthlyTimesheet] Đang kết nối SMTP ${smtpHost}:${smtpPort} với tài khoản ${smtpUser}...`
  );
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    family: 4, // Bắt buộc IPv4 để tránh ENETUNREACH khi mạng không định tuyến IPv6 tới smtp.gmail.com
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    auth: { user: smtpUser, pass: smtpPass },
  });

  console.log(
    `[MonthlyTimesheet] Đang gửi email bảng chấm công đến: ${recipients.join(", ")}...`
  );
  const info = await transporter.sendMail({
    from: `"NurseFlow Hệ Thống" <${smtpUser}>`,
    to: recipients.join(", "),
    subject,
    html,
    attachments: [
      {
        filename: excelFileName,
        content: excelBuffer,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });

  console.log(
    `✅ Đã gửi email chấm công tháng ${monthKey} thành công! Message ID: ${info.messageId}`
  );

  // Hiển thị Windows Toast Notification nếu hỗ trợ
  try {
    const { exec } = await import("child_process");
    const psScript = `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); $textNodes = $template.GetElementsByTagName('text'); $textNodes.Item(0).AppendChild($template.CreateTextNode('NurseFlow - Chấm Công Tháng')) > $null; $textNodes.Item(1).AppendChild($template.CreateTextNode('Đã gửi email bảng chấm công tháng ${monthKey} thành công!')) > $null; $toast = [Windows.UI.Notifications.ToastNotification]::new($template); [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('NurseFlow System').Show($toast);`;
    const encodedCommand = Buffer.from(psScript, "utf16le").toString("base64");
    exec(`powershell -NoProfile -EncodedCommand ${encodedCommand}`);
  } catch {}
}

main().catch((err) => {
  console.error(
    "❌ [MonthlyTimesheet] Lỗi:",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
