import { google } from "googleapis";
import nodemailer from "nodemailer";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SHEET_HEADERS, SHEET_NAMES } from "@/lib/constants";
import { fetchEffectivePositionRulesForWeek } from "@/lib/clinic-schedule-api";
import { getNextWeekStart, getWeekStartFromInput } from "@/lib/date";
import { buildSmartWeeklyAssignments, getWeeklyAssignments } from "@/lib/schedule";
import { createScheduleConfirmToken } from "@/lib/schedule-confirm-token";
import { buildWeeklyScheduleEmailHtml } from "@/lib/weekly-email-html";

const RECIPIENTS = ["nghiadn.pk@pnt.edu.vn", "tienmed@gmail.com"];

const requiredEnv = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "AUTH_SECRET",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(
      `Thiếu biến môi trường bắt buộc: ${key}. Chạy với --env-file=.env.local --env-file=email.env`,
    );
  }
}

const args = process.argv.slice(2);
const isPreview = args.includes("--preview");
const forceRegenerate = args.includes("--regenerate");
const weekArg = args.find((a) => a.startsWith("--week="))?.split("=")[1];
const outArg = args.find((a) => a.startsWith("--out="))?.split("=")[1];

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
  const approved = leaveRequests.filter((l) => l.status === "approved" || !l.status);
  if (!leaveCancellations || leaveCancellations.length === 0) return approved;

  const fullDayCancelSet = new Set(
    leaveCancellations.filter((c) => c.shift === "full-day").map((c) => `${c.staffId}-${c.date}`),
  );
  const shiftCancelSet = new Set(
    leaveCancellations.map((c) => `${c.staffId}-${c.date}-${c.shift}`),
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

function resolveBaseUrl() {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  return "https://nurse-scheduler-flax.vercel.app";
}

async function main() {
  const targetWeekStart = weekArg ? getWeekStartFromInput(weekArg) : getNextWeekStart();
  console.log(`[WeeklyEmail] Tuần mục tiêu: ${targetWeekStart} | Preview: ${isPreview}`);

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

  const sheetRanges = [
    `${SHEET_NAMES.staff}!A:Z`,
    `${SHEET_NAMES.positions}!A:Z`,
    `${SHEET_NAMES.scheduleRules}!A:Z`,
    `${SHEET_NAMES.templateSchedule}!A:Z`,
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
      ? r.positionIds.split(",").map((x) => x.trim()).filter(Boolean)
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
    quota: r.quota ? Number(r.quota) : 1,
    staffOrder: r.staffOrder
      ? r.staffOrder.split(",").map((x) => x.trim()).filter(Boolean)
      : [],
  }));

  const scheduleRules = parseRows(valueRanges[2]?.values).map((r) => ({
    id: r.id,
    dayOfWeek: Number(r.dayOfWeek),
    shift: r.shift,
    active: asBoolean(r.active || "true"),
    label: r.label || "",
  }));

  const templateSchedule = parseRows(valueRanges[3]?.values).map((r) => ({
    id: r.id,
    dayOfWeek: Number(r.dayOfWeek),
    shift: r.shift,
    positionId: r.positionId,
    staffId: r.staffId,
    slotIndex: Number(r.slotIndex || 0),
    note: r.note || "",
  }));

  const weeklySchedule = parseRows(valueRanges[4]?.values).map((r) => ({
    id: r.id,
    weekStart: r.weekStart,
    date: r.date,
    shift: r.shift,
    positionId: r.positionId,
    staffId: r.staffId,
    slotIndex: Number(r.slotIndex || 0),
    source: r.source || "manual",
    status: r.status || "draft",
    note: r.note || "",
  }));

  const leaveRequests = parseRows(valueRanges[5]?.values).map((r) => ({
    id: r.id,
    staffId: r.staffId,
    date: r.date,
    shift: r.shift,
    reason: r.reason || "phep",
    note: r.note || "",
    status: r.status || "approved",
    approveToken: r.approveToken || "",
    createdAt: r.createdAt || "",
  }));

  const positionRules = parseRows(valueRanges[6]?.values).map((r) => ({
    id: r.id,
    positionId: r.positionId,
    dayOfWeek: Number(r.dayOfWeek),
    shift: r.shift,
    active: asBoolean(r.active || "true"),
  }));

  const leaveCancellations = parseRows(valueRanges[7]?.values).map((r) => ({
    id: r.id,
    leaveRequestId: r.leaveRequestId || "",
    staffId: r.staffId,
    date: r.date,
    shift: r.shift,
    cancelledAt: r.cancelledAt || "",
  }));

  const holidays = parseRows(valueRanges[8]?.values).map((r) => ({
    id: r.id,
    date: r.date,
    name: r.name,
    note: r.note || "",
  }));

  const effectiveLeaves = computeEffectiveLeaves(leaveRequests, leaveCancellations);
  const clinicSync = await fetchEffectivePositionRulesForWeek(
    targetWeekStart,
    positions,
    positionRules,
    { weeklySchedule },
  );
  console.log(
    clinicSync.synced
      ? `[WeeklyEmail] Đã đối chiếu lịch phòng khám từ schedule-embed: ${clinicSync.totalActiveDoctorSlots} ca bác sĩ hoạt động.`
      : clinicSync.fallbackSource === "previous-week"
        ? `[WeeklyEmail] Tuần ${targetWeekStart} chưa có lịch bác sĩ trên schedule-embed, áp dụng lịch mở phòng của tuần ${clinicSync.sourceWeekStart} (${clinicSync.totalActiveDoctorSlots} ca bác sĩ).`
        : `[WeeklyEmail] Tuần ${targetWeekStart} chưa có lịch bác sĩ trên schedule-embed, dùng lịch nền + kinh nghiệm.`,
  );

  let targetAssignments = getWeeklyAssignments(weeklySchedule, targetWeekStart);

  if (targetAssignments.length === 0 || forceRegenerate) {
    console.log(
      `[WeeklyEmail] Đang sinh phân công thông minh (lịch phòng khám + kinh nghiệm + thói quen 1-2 tuần) cho tuần ${targetWeekStart}...`,
    );
    const smartRows = buildSmartWeeklyAssignments({
      templateSchedule,
      positions,
      staff,
      weeklySchedule,
      weekStart: targetWeekStart,
      leaveRequests: effectiveLeaves,
      scheduleRules,
      positionRules: clinicSync.effectivePositionRules,
      holidays,
      initialStatus: "draft",
      forceOpenPositionSlots: clinicSync.forceOpenPositionSlots,
    }).map((item, idx) => ({
      ...item,
      id: `weekly-${targetWeekStart}-${Date.now()}-${idx}`,
    }));

    targetAssignments = smartRows;

    if (!isPreview && smartRows.length > 0 && !forceRegenerate) {
      const headers = [...SHEET_HEADERS.weeklySchedule];
      const appendValues = smartRows.map((row) => headers.map((h) => String(row[h] ?? "")));
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_NAMES.weeklySchedule}!A1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: appendValues },
      });
      console.log(`[WeeklyEmail] Đã lưu ${smartRows.length} dòng dự thảo vào Google Sheets.`);
    }
  } else {
    console.log(`[WeeklyEmail] Tuần ${targetWeekStart} đã có ${targetAssignments.length} ca trên Google Sheets.`);
  }

  const baseUrl = resolveBaseUrl();
  const confirmToken = createScheduleConfirmToken(targetWeekStart);

  const { subject, html, stats } = buildWeeklyScheduleEmailHtml({
    weekStart: targetWeekStart,
    positions,
    staff,
    assignments: targetAssignments,
    leaveRequests: effectiveLeaves,
    scheduleRules,
    positionRules: clinicSync.effectivePositionRules,
    holidays,
    baseUrl,
    confirmToken,
    clinicSyncInfo: {
      synced: clinicSync.synced,
      totalActiveDoctorSlots: clinicSync.totalActiveDoctorSlots,
      fallbackSource: clinicSync.fallbackSource,
      sourceWeekStart: clinicSync.sourceWeekStart,
    },
  });

  console.log(
    `[WeeklyEmail] Thống kê: ${stats.positionCount} vị trí | Ô trống: ${stats.emptySlotCount} | Quá tải: ${stats.overloadCount} | Phép: ${stats.leaveCount}`,
  );

  if (isPreview || outArg) {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const defaultOut = path.resolve(scriptDir, "..", "tmp-weekly-email-preview.html");
    const targetOut = outArg ? path.resolve(outArg) : defaultOut;
    mkdirSync(path.dirname(targetOut), { recursive: true });
    writeFileSync(targetOut, html, "utf8");
    console.log(`✅ [Preview] Đã xuất bản HTML dữ liệu thật tại: ${targetOut}`);
    console.log(`Subject: ${subject}`);
    return;
  }

  const smtpUser = process.env.SMTP_USER_NV;
  const smtpPass = process.env.SMTP_PASS_NV;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);

  if (!smtpUser || !smtpPass) {
    throw new Error("Thiếu SMTP_USER_NV hoặc SMTP_PASS_NV trong môi trường.");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const info = await transporter.sendMail({
    from: `"NurseFlow Hệ Thống" <${smtpUser}>`,
    to: RECIPIENTS.join(", "),
    subject,
    html,
  });

  console.log(`✅ Đã gửi email lịch tuần sau (${targetWeekStart}) thành công! Message ID: ${info.messageId}`);
}

main().catch((err) => {
  console.error("❌ [WeeklyEmail] Lỗi:", err instanceof Error ? err.message : err);
  process.exit(1);
});
