import { google } from "googleapis";
import nodemailer from "nodemailer";

const requiredEnv = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Thiáº¿u biáº¿n mÃ´i trÆ°á»ng báº¯t buá»™c: ${key}. Vui lÃ²ng cháº¡y lá»‡nh vá»›i node --env-file=.env.local`);
  }
}

// Chá»n tÃ i khoáº£n gá»­i (email Nghiá»‡p vá»¥)
const smtpUser = process.env.SMTP_USER_NV;
const smtpPass = process.env.SMTP_PASS_NV;
const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = process.env.SMTP_PORT || 465;

if (!smtpUser || !smtpPass) {
  console.error("Lá»—i: Thiáº¿u cáº¥u hÃ¬nh SMTP_USER_NV hoáº·c SMTP_PASS_NV trong file .env.local.");
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
    console.log("Há»‡ thá»‘ng Ä‘Æ°á»£c cáº¥u hÃ¬nh khÃ´ng gá»­i email vÃ o tá»‘i Thá»© 6 vÃ  Thá»© 7. Äang thoÃ¡t...");
    return;
  }

  console.log("Äang kiá»ƒm tra dá»¯ liá»‡u ngÃ y mai...");

  // Gá»i API tá»± Ä‘á»™ng chá»‘t lá»‹ch náº¿u tuáº§n má»›i chÆ°a cÃ³ dá»¯ liá»‡u
  try {
    console.log("Äang gá»i API tá»± Ä‘á»™ng sinh lá»‹ch...");
    await fetch("http://localhost:3000/api/schedule/generate");
  } catch(e) {
    console.error("Lá»—i gá»i API sinh lá»‹ch:", e);
  }

  // Láº¥y ngÃ y MAI
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
  const positionValues = res.data.valueRanges?.[3]?.values || [];

  if (staffValues.length === 0) {
    console.log("KhÃ´ng tÃ¬m tháº¥y dá»¯ liá»‡u nhÃ¢n sá»±.");
    return;
  }

  // --- MAP Dá»® LIá»†U ---
  const staffHeaders = staffValues[0].map(String);
  const staffMap = new Map();
  const sIdIdx = staffHeaders.indexOf("id");
  const sNameIdx = staffHeaders.indexOf("name");
  for (let i = 1; i < staffValues.length; i++) {
    if (staffValues[i][sIdIdx]) staffMap.set(staffValues[i][sIdIdx], staffValues[i][sNameIdx] || "KhÃ´ng rÃµ");
  }

  const posHeaders = positionValues[0]?.map(String) || [];
  const posMap = new Map();
  const pIdIdx = posHeaders.indexOf("id");
  const pNameIdx = posHeaders.indexOf("name");
  for (let i = 1; i < positionValues.length; i++) {
    if (positionValues[i][pIdIdx]) posMap.set(positionValues[i][pIdIdx], positionValues[i][pNameIdx] || "KhÃ´ng rÃµ");
  }

  const leaveHeaders = leaveValues[0]?.map(String) || [];
  const leaveStaffIdIdx = leaveHeaders.indexOf("staffId");
  const leaveDateIdx = leaveHeaders.indexOf("date");
  const leaveShiftIdx = leaveHeaders.indexOf("shift");
  const leaveReasonIdx = leaveHeaders.indexOf("reason");
  const leaveNoteIdx = leaveHeaders.indexOf("note");


  // --- LOGIC 1: Lá»ŒC NGHá»ˆ PHÃ‰P NGÃ€Y MAI ---
  const tomorrowLeavesList = [];

  for (let i = 1; i < leaveValues.length; i++) {
    const row = leaveValues[i];
    if (row[leaveDateIdx] === tomorrowStr) {
      const staffId = row[leaveStaffIdIdx];
      const shift = row[leaveShiftIdx] || "full-day";
      const reason = row[leaveReasonIdx] || "KhÃ´ng rÃµ";
      const note = row[leaveNoteIdx] || "";
      const name = staffMap.get(staffId) || "NhÃ¢n sá»± khÃ´ng xÃ¡c Ä‘á»‹nh";

      let shiftLabel = "Cáº£ ngÃ y";
      if (shift === "morning") shiftLabel = "SÃ¡ng";
      if (shift === "afternoon") shiftLabel = "Chiá»u";

      let reasonLabel = reason;
      if (reason === "personal") reasonLabel = "Viá»‡c riÃªng";
      if (reason === "sick") reasonLabel = "Nghá»‰ á»‘m";
      if (reason === "vacation" || reason === "phep") reasonLabel = "PhÃ©p nÄƒm";
      if (reason === "dihoc") reasonLabel = "Äi há»c";

      const noteStr = note ? ` - Ghi chÃº: ${note}` : "";
      tomorrowLeavesList.push({ name, shiftLabel, reasonLabel, noteStr });
    }
  }

  // --- QUYáº¾T Äá»ŠNH Gá»¬I EMAIL ---
  const shouldSend = tomorrowLeavesList.length > 0;

  if (!shouldSend) {
    console.log(`NgÃ y mai (${displayDate}) khÃ´ng cÃ³ nhÃ¢n sá»± nÃ o nghá»‰ phÃ©p.`);
    console.log("Theo cáº¥u hÃ¬nh, há»‡ thá»‘ng sáº½ KHÃ”NG gá»­i email.");
    return;
  }

  console.log(`PhÃ¡t hiá»‡n Ä‘iá»u kiá»‡n cáº§n thÃ´ng bÃ¡o cho ngÃ y mai (${displayDate}). Äang gá»­i email...`);

  // --- Táº O Ná»˜I DUNG EMAIL ---
  let htmlSections = [];

  // Danh sÃ¡ch nghá»‰ phÃ©p (Bao gá»“m táº¥t cáº£ lÃ½ do ká»ƒ cáº£ Äi há»c)
  const leaveRows = tomorrowLeavesList
    .map(l => `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;">${l.name}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${l.shiftLabel}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${l.reasonLabel}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${l.noteStr}</td></tr>`)
    .join("");

  htmlSections.push(`
    <h3 style="color:#0f766e;">ðŸ“‹ Danh sÃ¡ch nghá»‰ phÃ©p (${tomorrowLeavesList.length} lÆ°á»£t)</h3>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <thead><tr style="background:#f0fdf4;">
        <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">NhÃ¢n sá»±</th>
        <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Ca</th>
        <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">LÃ½ do</th>
        <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Ghi chÃº</th>
      </tr></thead>
      <tbody>${leaveRows}</tbody>
    </table>
  `);

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
      <h2 style="color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 8px;">
        ThÃ´ng bÃ¡o nghá»‰ phÃ©p ngÃ y mai (${displayDate})
      </h2>
      ${htmlSections.join("<hr style='border:none;border-top:1px solid #e5e7eb;margin:20px 0;'/>")}
      <br/>
      <p style="color:#6b7280;font-size:12px;"><i>LÆ°u Ã½: ÄÃ¢y lÃ  email tá»± Ä‘á»™ng tá»« há»‡ thá»‘ng Nusres, vui lÃ²ng khÃ´ng pháº£n há»“i.</i></p>
    </div>
  `;

  // --- Gá»¬I EMAIL ---
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const mailOptions = {
    from: `"Nusres System" <${smtpUser}>`,
    bcc: "tienmed@gmail.com, nghiadn.pk@pnt.edu.vn, thientrang250392pnt@gmail.com",
    subject: `[Nusres] Danh sÃ¡ch nghá»‰ phÃ©p ngÃ y mai (${displayDate})`,
    html: htmlContent,
  };



  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("âœ… Gá»­i email thÃ nh cÃ´ng! Message ID:", info.messageId);
    try {
      const { exec } = await import("child_process");
      const psCmd = `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); $textNodes = $template.GetElementsByTagName('text'); $textNodes.Item(0).AppendChild($template.CreateTextNode('Nusres - Lá»‹ch Váº­n HÃ nh')) > $null; $textNodes.Item(1).AppendChild($template.CreateTextNode('ÄÃ£ gá»­i email lá»‹ch váº­n hÃ nh ngÃ y ${displayDate} thÃ nh cÃ´ng!')) > $null; $toast = [Windows.UI.Notifications.ToastNotification]::new($template); [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Nusres System').Show($toast);`;
      exec(`powershell -NoProfile -Command "${psCmd}"`);
    } catch {}
  } catch (err) {
    console.error("âŒ Lá»—i khi gá»­i email:", err);
  }
}

main().catch((error) => {
  console.error("Lá»—i khi cháº¡y ká»‹ch báº£n gá»­i email:", error instanceof Error ? error.message : error);
  process.exit(1);
});
