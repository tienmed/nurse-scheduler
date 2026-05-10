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

async function main() {
  const currentDay = new Date().getDay();
  if (currentDay === 5 || currentDay === 6) {
    console.log("Hệ thống được cấu hình không gửi email vào tối Thứ 6 và Thứ 7. Đang thoát...");
    return;
  }

  console.log("Đang kiểm tra dữ liệu ngày mai...");

  // Lấy ngày MAI
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  const tomorrowStr = `${year}-${month}-${day}`;
  const displayDate = `${day}/${month}/${year}`;

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["staff!A:Z", "leave_requests!A:Z", "weekly_schedule!A:Z", "positions!A:Z"],
  });

  const staffValues = res.data.valueRanges?.[0]?.values || [];
  const leaveValues = res.data.valueRanges?.[1]?.values || [];
  const scheduleValues = res.data.valueRanges?.[2]?.values || [];
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
    if (staffValues[i][sIdIdx]) staffMap.set(staffValues[i][sIdIdx], staffValues[i][sNameIdx] || "Không rõ");
  }

  const posHeaders = positionValues[0]?.map(String) || [];
  const posMap = new Map();
  const pIdIdx = posHeaders.indexOf("id");
  const pNameIdx = posHeaders.indexOf("name");
  for (let i = 1; i < positionValues.length; i++) {
    if (positionValues[i][pIdIdx]) posMap.set(positionValues[i][pIdIdx], positionValues[i][pNameIdx] || "Không rõ");
  }

  const leaveHeaders = leaveValues[0]?.map(String) || [];
  const leaveStaffIdIdx = leaveHeaders.indexOf("staffId");
  const leaveDateIdx = leaveHeaders.indexOf("date");
  const leaveShiftIdx = leaveHeaders.indexOf("shift");
  const leaveReasonIdx = leaveHeaders.indexOf("reason");
  const leaveNoteIdx = leaveHeaders.indexOf("note");

  const schedHeaders = scheduleValues[0]?.map(String) || [];
  const scDateIdx = schedHeaders.indexOf("date");
  const scStaffIdIdx = schedHeaders.indexOf("staffId");
  const scShiftIdx = schedHeaders.indexOf("shift");
  const scPositionIdIdx = schedHeaders.indexOf("positionId");

  // --- LOGIC 1: LỌC NGHỈ PHÉP NGÀY MAI ---
  const tomorrowLeavesList = [];
  let hasNonStudyLeave = false;

  for (let i = 1; i < leaveValues.length; i++) {
    const row = leaveValues[i];
    if (row[leaveDateIdx] === tomorrowStr) {
      const staffId = row[leaveStaffIdIdx];
      const shift = row[leaveShiftIdx] || "full-day";
      const reason = row[leaveReasonIdx] || "Không rõ";
      const note = row[leaveNoteIdx] || "";
      const name = staffMap.get(staffId) || "Nhân sự không xác định";

      if (reason !== "dihoc") {
        hasNonStudyLeave = true;
      }

      let shiftLabel = "Cả ngày";
      if (shift === "morning") shiftLabel = "Sáng";
      if (shift === "afternoon") shiftLabel = "Chiều";

      let reasonLabel = reason;
      if (reason === "personal") reasonLabel = "Việc riêng";
      if (reason === "sick") reasonLabel = "Nghỉ ốm";
      if (reason === "vacation" || reason === "phep") reasonLabel = "Phép năm";
      if (reason === "dihoc") reasonLabel = "Đi học";

      const noteStr = note ? ` - Ghi chú: ${note}` : "";
      tomorrowLeavesList.push({ name, shiftLabel, reasonLabel, noteStr, isDihoc: reason === "dihoc" });
    }
  }

  // --- LOGIC 2: KIỂM TRA VỊ TRÍ PHÒNG TRỐNG NGÀY MAI ---
  const positionStatus = new Map();
  let hasScheduleTomorrow = false;

  for (let i = 1; i < scheduleValues.length; i++) {
    const row = scheduleValues[i];
    if (row[scDateIdx] === tomorrowStr) {
      hasScheduleTomorrow = true;
      const staffId = row[scStaffIdIdx];
      const shift = row[scShiftIdx];
      const positionId = row[scPositionIdIdx];

      const key = `${positionId}_${shift}`;
      if (!positionStatus.has(key)) {
        positionStatus.set(key, { assignedCount: 0 });
      }
      if (staffId && staffId.trim() !== "") {
        positionStatus.get(key).assignedCount++;
      }
    }
  }

  const criticalEmpty = [];
  for (const [key, status] of positionStatus.entries()) {
    if (status.assignedCount === 0) {
      const [positionId, shift] = key.split("_");
      const posName = posMap.get(positionId) || "Vị trí không xác định";
      let shiftLabel = shift === "morning" ? "Sáng" : (shift === "afternoon" ? "Chiều" : "Cả ngày");
      criticalEmpty.push(`${posName} (${shiftLabel})`);
    }
  }

  // --- LOGIC 3: NHÂN SỰ CHƯA PHÂN VỊ TRÍ NGÀY MAI (KHÔNG CÓ PHÉP) ---
  const sActiveIdx = staffHeaders.indexOf("active");
  const activeStaffIds = [];
  for (let i = 1; i < staffValues.length; i++) {
    const row = staffValues[i];
    const id = row[sIdIdx];
    const active = row[sActiveIdx];
    if (id && (active === undefined || active === "true" || active === "TRUE" || active === "1")) {
      activeStaffIds.push(id);
    }
  }

  // Build leave set for tomorrow
  const tomorrowLeaveSet = new Set();
  for (let i = 1; i < leaveValues.length; i++) {
    const row = leaveValues[i];
    if (row[leaveDateIdx] === tomorrowStr) {
      const staffId = row[leaveStaffIdIdx];
      const shift = row[leaveShiftIdx] || "full-day";
      tomorrowLeaveSet.add(`${staffId}_${shift}`);
    }
  }

  // Build assigned set for tomorrow (theo ca)
  const assignedByShift = new Map();
  for (const s of ["morning", "afternoon"]) {
    assignedByShift.set(s, new Set());
  }
  for (let i = 1; i < scheduleValues.length; i++) {
    const row = scheduleValues[i];
    if (row[scDateIdx] === tomorrowStr) {
      const staffId = row[scStaffIdIdx];
      const shift = row[scShiftIdx];
      if (staffId && staffId.trim() !== "" && assignedByShift.has(shift)) {
        assignedByShift.get(shift).add(staffId);
      }
    }
  }

  // Xác định ca cần kiểm tra (Chủ nhật=0 → skip, Thứ 7=6 → chỉ sáng)
  const tomorrowDayOfWeek = tomorrow.getDay();
  const shiftsToCheck = tomorrowDayOfWeek === 0
    ? []
    : tomorrowDayOfWeek === 6
      ? ["morning"]
      : ["morning", "afternoon"];

  const unassignedStaff = [];
  for (const shift of shiftsToCheck) {
    const assignedSet = assignedByShift.get(shift) || new Set();
    for (const staffId of activeStaffIds) {
      if (assignedSet.has(staffId)) continue;
      if (tomorrowLeaveSet.has(`${staffId}_${shift}`) || tomorrowLeaveSet.has(`${staffId}_full-day`)) continue;

      const name = staffMap.get(staffId) || "Không rõ";
      const shiftLabel = shift === "morning" ? "Sáng" : "Chiều";
      unassignedStaff.push({ name, shiftLabel });
    }
  }

  // --- QUYẾT ĐỊNH GỬI EMAIL ---
  // Gửi khi: (1) Có nghỉ phép khác đi học, HOẶC (2) Có phòng trống, HOẶC (3) Có nhân sự chưa phân vị trí
  const shouldSend = hasNonStudyLeave || criticalEmpty.length > 0 || unassignedStaff.length > 0;

  if (!shouldSend) {
    if (tomorrowLeavesList.length > 0) {
      console.log(`Ngày mai (${displayDate}) có ${tomorrowLeavesList.length} người nghỉ nhưng tất cả đều "Đi học".`);
    } else {
      console.log(`Ngày mai (${displayDate}) không có nhân sự nào nghỉ phép.`);
    }
    if (hasScheduleTomorrow && criticalEmpty.length === 0) {
      console.log("Tất cả phòng mở đều đã bố trí ít nhất 1 nhân sự.");
    }
    if (unassignedStaff.length === 0) {
      console.log("Tất cả nhân sự đều đã được phân vị trí hoặc có phép.");
    }
    console.log("Theo cấu hình, hệ thống sẽ KHÔNG gửi email.");
    return;
  }

  console.log(`Phát hiện điều kiện cần thông báo cho ngày mai (${displayDate}). Đang gửi email...`);

  // --- TẠO NỘI DUNG EMAIL ---
  let htmlSections = [];

  // Phần 0 (MỚI): Nhân sự chưa phân vị trí
  if (unassignedStaff.length > 0) {
    const grouped = {};
    for (const u of unassignedStaff) {
      if (!grouped[u.shiftLabel]) grouped[u.shiftLabel] = [];
      grouped[u.shiftLabel].push(u.name);
    }
    const unassignedRows = Object.entries(grouped)
      .map(([shift, names]) =>
        `<tr>
          <td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:600;color:#b45309;">${shift}</td>
          <td style="padding:6px 12px;border:1px solid #e5e7eb;">${names.join(", ")}</td>
        </tr>`)
      .join("");

    htmlSections.push(`
      <h3 style="color:#b45309;">🟡 Nhân sự chưa phân vị trí (${unassignedStaff.length} lượt)</h3>
      <p>Các nhân sự sau <b>không có lịch nghỉ phép</b> nhưng <b>chưa được gán vào vị trí</b> nào:</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead><tr style="background:#fffbeb;">
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Ca</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Nhân sự</th>
        </tr></thead>
        <tbody>${unassignedRows}</tbody>
      </table>
    `);
  }

  // Phần 1: Danh sách nghỉ phép (chỉ hiện nếu có người nghỉ không phải đi học)
  if (hasNonStudyLeave) {
    const leaveRows = tomorrowLeavesList
      .filter(l => !l.isDihoc)
      .map(l => `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;">${l.name}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${l.shiftLabel}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${l.reasonLabel}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${l.noteStr}</td></tr>`)
      .join("");

    htmlSections.push(`
      <h3 style="color:#0f766e;">📋 Danh sách nghỉ phép</h3>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead><tr style="background:#f0fdf4;">
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Nhân sự</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Ca</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Lý do</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Ghi chú</th>
        </tr></thead>
        <tbody>${leaveRows}</tbody>
      </table>
    `);
  }

  // Phần 2: Vị trí phòng trống
  if (criticalEmpty.length > 0) {
    const emptyRows = criticalEmpty
      .map(p => `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">${p}</td></tr>`)
      .join("");

    htmlSections.push(`
      <h3 style="color:#dc2626;">🔴 Vị trí phòng chưa có nhân sự</h3>
      <p>Các vị trí sau đang mở nhưng <b>chưa có ai</b> được bố trí trực:</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead><tr style="background:#fef2f2;">
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Vị trí - Ca trực</th>
        </tr></thead>
        <tbody>${emptyRows}</tbody>
      </table>
    `);
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
      <h2 style="color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 8px;">
        Thông báo vận hành ngày mai (${displayDate})
      </h2>
      ${htmlSections.join("<hr style='border:none;border-top:1px solid #e5e7eb;margin:20px 0;'/>")}
      <br/>
      <p style="color:#6b7280;font-size:12px;"><i>Lưu ý: Đây là email tự động từ hệ thống Nusres, vui lòng không phản hồi.</i></p>
    </div>
  `;

  // --- GỬI EMAIL ---
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const mailOptions = {
    from: `"Nusres System" <${smtpUser}>`,
    to: "tienmed@gmail.com",
    subject: `[Nusres] Báo cáo vận hành ngày mai (${displayDate})${unassignedStaff.length > 0 ? ` — ⚠️ ${unassignedStaff.length} chưa phân công` : ""}`,
    html: htmlContent,
  };

  // CC cô Trang nếu có nghỉ phép (khác đi học)
  if (hasNonStudyLeave) {
    mailOptions.cc = "trangdlt@pnt.edu.vn";
    console.log("CC: trangdlt@pnt.edu.vn (có lịch nghỉ phép)");
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Gửi email thành công! Message ID:", info.messageId);
  } catch (err) {
    console.error("❌ Lỗi khi gửi email:", err);
  }
}

main().catch((error) => {
  console.error("Lỗi khi chạy kịch bản gửi email:", error instanceof Error ? error.message : error);
  process.exit(1);
});
