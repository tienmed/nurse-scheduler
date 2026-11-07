import { google } from "googleapis";
import notifier from "node-notifier";

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
  console.log("--- Äang khá»Ÿi Ä‘á»™ng há»‡ thá»‘ng kiá»ƒm tra thÃ´ng bÃ¡o há»£p nháº¥t (Kiá»ƒm tra tá»‘i thiá»ƒu 1 nhÃ¢n sá»±) ---");

  const now = new Date();
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const todayStr = formatDate(now);

  // Gá»i API tá»± Ä‘á»™ng chá»‘t lá»‹ch náº¿u tuáº§n má»›i chÆ°a cÃ³ dá»¯ liá»‡u
  try {
    console.log("Äang gá»i API tá»± Ä‘á»™ng sinh lá»‹ch...");
    await fetch("http://localhost:3000/api/schedule/generate");
  } catch(e) {
    console.error("Lá»—i gá»i API sinh lá»‹ch:", e);
  }

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["staff!A:Z", "leave_requests!A:Z", "weekly_schedule!A:Z", "positions!A:Z"],
  });

  const staffValues = res.data.valueRanges?.[0]?.values || [];
  const leaveValues = res.data.valueRanges?.[1]?.values || [];
  const scheduleValues = res.data.valueRanges?.[2]?.values || [];
  const positionValues = res.data.valueRanges?.[3]?.values || [];

  if (staffValues.length === 0) return;

  // Map Staff
  const staffHeaders = staffValues[0].map(String);
  const staffMap = new Map();
  const sIdIdx = staffHeaders.indexOf("id");
  const sNameIdx = staffHeaders.indexOf("name");
  for (let i = 1; i < staffValues.length; i++) {
    if (staffValues[i][sIdIdx]) staffMap.set(staffValues[i][sIdIdx], staffValues[i][sNameIdx] || "KhÃ´ng rÃµ");
  }

  // Map Positions
  const posHeaders = positionValues[0]?.map(String) || [];
  const posMap = new Map();
  const pIdIdx = posHeaders.indexOf("id");
  const pNameIdx = posHeaders.indexOf("name");
  for (let i = 1; i < positionValues.length; i++) {
    if (positionValues[i][pIdIdx]) posMap.set(positionValues[i][pIdIdx], positionValues[i][pNameIdx] || "KhÃ´ng rÃµ");
  }

  const leaveHeaders = leaveValues[0]?.map(String) || [];
  const lStaffIdIdx = leaveHeaders.indexOf("staffId");
  const lDateIdx = leaveHeaders.indexOf("date");
  const lShiftIdx = leaveHeaders.indexOf("shift");

  const schedHeaders = scheduleValues[0]?.map(String) || [];
  const scDateIdx = schedHeaders.indexOf("date");
  const scStaffIdIdx = schedHeaders.indexOf("staffId");
  const scShiftIdx = schedHeaders.indexOf("shift");
  const scPositionIdIdx = schedHeaders.indexOf("positionId");

  // --- LOGIC 1: NHÃ‚N Sá»° NGHá»ˆ HÃ”M NAY ---
  const todayLeaves = [];
  const leaveSet = new Set(); 
  for (let i = 1; i < leaveValues.length; i++) {
    const row = leaveValues[i];
    if (row[lDateIdx] === todayStr) {
      const staffId = row[lStaffIdIdx];
      const shift = row[lShiftIdx] || "full-day";
      const name = staffMap.get(staffId) || "KhÃ´ng rÃµ";
      let shiftLabel = shift === "morning" ? "SÃ¡ng" : (shift === "afternoon" ? "Chiá»u" : "Cáº£ ngÃ y");
      todayLeaves.push(`${name} (${shiftLabel})`);
      leaveSet.add(`${staffId}_${shift}`);
    }
  }

  // --- LOGIC 2: XUNG Äá»˜T Lá»ŠCH TRá»°C & KIá»‚M TRA PHÃ’NG TRá»NG ---
  const conflicts = [];
  const positionStatus = new Map(); // Key: positionId_shift -> { assigned: [], emptyCount: 0 }
  let hasScheduleToday = false;

  for (let i = 1; i < scheduleValues.length; i++) {
    const row = scheduleValues[i];
    if (row[scDateIdx] === todayStr) {
      hasScheduleToday = true;
      const staffId = row[scStaffIdIdx];
      const shift = row[scShiftIdx];
      const positionId = row[scPositionIdIdx];
      
      const key = `${positionId}_${shift}`;
      if (!positionStatus.has(key)) {
        positionStatus.set(key, { assigned: [], emptyCount: 0 });
      }
      
      const status = positionStatus.get(key);
      if (staffId && staffId.trim() !== "") {
        const name = staffMap.get(staffId) || "KhÃ´ng rÃµ";
        status.assigned.push(name);
        
        // Check Conflict
        if (leaveSet.has(`${staffId}_${shift}`) || leaveSet.has(`${staffId}_full-day`)) {
          const posName = posMap.get(positionId) || "Vá»‹ trÃ­ khÃ´ng xÃ¡c Ä‘á»‹nh";
          let shiftLabel = shift === "morning" ? "SÃ¡ng" : (shift === "afternoon" ? "Chiá»u" : "Cáº£ ngÃ y");
          conflicts.push(`${name} - ${posName} (Ca ${shiftLabel})`);
        }
      } else {
        status.emptyCount++;
      }
    }
  }

  const criticalEmpty = []; // Vá»‹ trÃ­ cÃ³ 0 ngÆ°á»i trá»±c
  const partialEmpty = [];  // Vá»‹ trÃ­ cÃ³ ngÆ°á»i trá»±c nhÆ°ng váº«n cÃ²n slot trá»‘ng

  for (const [key, status] of positionStatus.entries()) {
    const [positionId, shift] = key.split("_");
    const posName = posMap.get(positionId) || "Vá»‹ trÃ­ khÃ´ng xÃ¡c Ä‘á»‹nh";
    let shiftLabel = shift === "morning" ? "SÃ¡ng" : (shift === "afternoon" ? "Chiá»u" : "Cáº£ ngÃ y");

    if (status.assigned.length === 0) {
      criticalEmpty.push(`${posName} (${shiftLabel})`);
    } else if (status.emptyCount > 0) {
      partialEmpty.push(`${posName} (${shiftLabel}): Thiáº¿u ${status.emptyCount} ngÆ°á»i`);
    }
  }

  // --- LOGIC 3: NHÃ‚N Sá»° CHÆ¯A PHÃ‚N Vá»Š TRÃ (KHÃ”NG CÃ“ PHÃ‰P) ---
  // Láº¥y danh sÃ¡ch nhÃ¢n sá»± active
  const sActiveIdx = staffHeaders.indexOf("active");
  const activeStaffIds = [];
  for (let i = 1; i < staffValues.length; i++) {
    const row = staffValues[i];
    const id = row[sIdIdx];
    const active = row[sActiveIdx];
    // active cÃ³ thá»ƒ lÃ  "true", "TRUE", "1", hoáº·c thiáº¿u cá»™t (máº·c Ä‘á»‹nh active)
    if (id && (active === undefined || active === "true" || active === "TRUE" || active === "1")) {
      activeStaffIds.push(id);
    }
  }

  // TÃ¬m nhÃ¢n sá»± khÃ´ng cÃ³ assignment vÃ  khÃ´ng cÃ³ leave cho tá»«ng ca hÃ´m nay
  const shifts = ["morning", "afternoon"];
  const unassignedStaff = []; // { name, shift }

  // XÃ¢y dá»±ng set nhÃ¢n sá»± Ä‘Ã£ Ä‘Æ°á»£c phÃ¢n cÃ´ng hÃ´m nay (theo ca)
  const assignedByShift = new Map(); // shift -> Set<staffId>
  for (const s of shifts) {
    assignedByShift.set(s, new Set());
  }
  for (let i = 1; i < scheduleValues.length; i++) {
    const row = scheduleValues[i];
    if (row[scDateIdx] === todayStr) {
      const staffId = row[scStaffIdIdx];
      const shift = row[scShiftIdx];
      if (staffId && staffId.trim() !== "" && assignedByShift.has(shift)) {
        assignedByShift.get(shift).add(staffId);
      }
    }
  }

  // Chá»§ nháº­t (0) hoáº·c Thá»© 7 chiá»u â†’ bá» qua ca Ä‘Ã³
  const dayOfWeek = now.getDay();
  const shiftsToCheck = dayOfWeek === 0
    ? [] // Chá»§ nháº­t: khÃ´ng kiá»ƒm tra
    : dayOfWeek === 6
      ? ["morning"] // Thá»© 7: chá»‰ ca sÃ¡ng
      : ["morning", "afternoon"];

  for (const shift of shiftsToCheck) {
    const assignedSet = assignedByShift.get(shift) || new Set();
    for (const staffId of activeStaffIds) {
      // ÄÃ£ cÃ³ assignment? â†’ skip
      if (assignedSet.has(staffId)) continue;
      // Äang nghá»‰ phÃ©p? â†’ skip
      if (leaveSet.has(`${staffId}_${shift}`) || leaveSet.has(`${staffId}_full-day`)) continue;
      
      const name = staffMap.get(staffId) || "KhÃ´ng rÃµ";
      const shiftLabel = shift === "morning" ? "SÃ¡ng" : "Chiá»u";
      unassignedStaff.push({ name, shiftLabel });
    }
  }

  // --- Tá»”NG Há»¢P THÃ”NG BÃO ---
  let messageParts = [];

  // 1. NhÃ¢n sá»± chÆ°a phÃ¢n vá»‹ trÃ­ (Má»šI - hiá»ƒn thá»‹ Ä‘áº§u tiÃªn vÃ¬ quan trá»ng)
  if (unassignedStaff.length > 0) {
    const grouped = {};
    for (const u of unassignedStaff) {
      if (!grouped[u.shiftLabel]) grouped[u.shiftLabel] = [];
      grouped[u.shiftLabel].push(u.name);
    }
    const lines = Object.entries(grouped)
      .map(([shift, names]) => `Ca ${shift}: ${names.join(", ")}`)
      .join("\n");
    messageParts.push(`ðŸŸ¡ ChÆ°a phÃ¢n vá»‹ trÃ­ (${unassignedStaff.length}):\n${lines}`);
  }

  // 2. Nghá»‰ phÃ©p
  if (todayLeaves.length > 0) {
    messageParts.push(`ðŸ“‹ NhÃ¢n sá»± nghá»‰ (${todayLeaves.length}):\n${todayLeaves.join(", ")}`);
  }

  // 3. Xung Ä‘á»™t
  if (conflicts.length > 0) {
    messageParts.push(`âš ï¸ XUNG Äá»˜T (Trá»±c vs Nghá»‰):\n${conflicts.join("\n")}`);
  }

  // 4. Vá»‹ trÃ­ trá»‘ng (KhÃ´ng cÃ³ ai trá»±c)
  if (!hasScheduleToday) {
    messageParts.push("ðŸ”´ Cáº¢NH BÃO: HÃ´m nay chÆ°a cÃ³ dá»¯ liá»‡u lá»‹ch trá»±c!");
  } else if (criticalEmpty.length > 0) {
    messageParts.push(`ðŸ”´ PHÃ’NG TRá»NG (0 nhÃ¢n sá»±):\n${criticalEmpty.join("\n")}`);
  } else if (partialEmpty.length > 0) {
    messageParts.push(`âœ… ÄÃ£ cÃ³ tá»‘i thiá»ƒu 1 nhÃ¢n sá»± á»Ÿ má»i phÃ²ng.\n(LÆ°u Ã½: CÃ³ ${partialEmpty.length} vá»‹ trÃ­ chÆ°a gÃ¡n Ä‘á»§ sá»‘ lÆ°á»£ng)`);
  } else {
    messageParts.push("âœ… Má»i vá»‹ trÃ­ Ä‘á»u Ä‘Ã£ gÃ¡n Ä‘á»§ nhÃ¢n sá»±.");
  }

  const finalMessage = messageParts.join("\n\n");
  console.log(finalMessage);

  notifier.notify({
    title: "Nusres: Cáº£nh bÃ¡o váº­n hÃ nh",
    message: finalMessage,
    sound: true,
    wait: false,
    appID: "Nusres.App",
  });
}

main().catch(console.error);
