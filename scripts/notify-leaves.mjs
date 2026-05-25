import { google } from "googleapis";
import notifier from "node-notifier";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  console.log("--- Đang khởi động hệ thống kiểm tra thông báo hợp nhất (Kiểm tra tối thiểu 1 nhân sự) ---");

  const now = new Date();
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const todayStr = formatDate(now);

  // Gọi API tự động chốt lịch nếu tuần mới chưa có dữ liệu
  try {
    console.log("Đang gọi API tự động sinh lịch...");
    await fetch("http://localhost:3000/api/schedule/generate");
  } catch(e) {
    console.error("Lỗi gọi API sinh lịch:", e);
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
    if (staffValues[i][sIdIdx]) staffMap.set(staffValues[i][sIdIdx], staffValues[i][sNameIdx] || "Không rõ");
  }

  // Map Positions
  const posHeaders = positionValues[0]?.map(String) || [];
  const posMap = new Map();
  const pIdIdx = posHeaders.indexOf("id");
  const pNameIdx = posHeaders.indexOf("name");
  for (let i = 1; i < positionValues.length; i++) {
    if (positionValues[i][pIdIdx]) posMap.set(positionValues[i][pIdIdx], positionValues[i][pNameIdx] || "Không rõ");
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

  // --- LOGIC 1: NHÂN SỰ NGHỈ HÔM NAY ---
  const todayLeaves = [];
  const leaveSet = new Set(); 
  for (let i = 1; i < leaveValues.length; i++) {
    const row = leaveValues[i];
    if (row[lDateIdx] === todayStr) {
      const staffId = row[lStaffIdIdx];
      const shift = row[lShiftIdx] || "full-day";
      const name = staffMap.get(staffId) || "Không rõ";
      let shiftLabel = shift === "morning" ? "Sáng" : (shift === "afternoon" ? "Chiều" : "Cả ngày");
      todayLeaves.push(`${name} (${shiftLabel})`);
      leaveSet.add(`${staffId}_${shift}`);
    }
  }

  // --- LOGIC 2: XUNG ĐỘT LỊCH TRỰC & KIỂM TRA PHÒNG TRỐNG ---
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
        const name = staffMap.get(staffId) || "Không rõ";
        status.assigned.push(name);
        
        // Check Conflict
        if (leaveSet.has(`${staffId}_${shift}`) || leaveSet.has(`${staffId}_full-day`)) {
          const posName = posMap.get(positionId) || "Vị trí không xác định";
          let shiftLabel = shift === "morning" ? "Sáng" : (shift === "afternoon" ? "Chiều" : "Cả ngày");
          conflicts.push(`${name} - ${posName} (Ca ${shiftLabel})`);
        }
      } else {
        status.emptyCount++;
      }
    }
  }

  const criticalEmpty = []; // Vị trí có 0 người trực
  const partialEmpty = [];  // Vị trí có người trực nhưng vẫn còn slot trống

  for (const [key, status] of positionStatus.entries()) {
    const [positionId, shift] = key.split("_");
    const posName = posMap.get(positionId) || "Vị trí không xác định";
    let shiftLabel = shift === "morning" ? "Sáng" : (shift === "afternoon" ? "Chiều" : "Cả ngày");

    if (status.assigned.length === 0) {
      criticalEmpty.push(`${posName} (${shiftLabel})`);
    } else if (status.emptyCount > 0) {
      partialEmpty.push(`${posName} (${shiftLabel}): Thiếu ${status.emptyCount} người`);
    }
  }

  // --- LOGIC 3: NHÂN SỰ CHƯA PHÂN VỊ TRÍ (KHÔNG CÓ PHÉP) ---
  // Lấy danh sách nhân sự active
  const sActiveIdx = staffHeaders.indexOf("active");
  const activeStaffIds = [];
  for (let i = 1; i < staffValues.length; i++) {
    const row = staffValues[i];
    const id = row[sIdIdx];
    const active = row[sActiveIdx];
    // active có thể là "true", "TRUE", "1", hoặc thiếu cột (mặc định active)
    if (id && (active === undefined || active === "true" || active === "TRUE" || active === "1")) {
      activeStaffIds.push(id);
    }
  }

  // Tìm nhân sự không có assignment và không có leave cho từng ca hôm nay
  const shifts = ["morning", "afternoon"];
  const unassignedStaff = []; // { name, shift }

  // Xây dựng set nhân sự đã được phân công hôm nay (theo ca)
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

  // Chủ nhật (0) hoặc Thứ 7 chiều → bỏ qua ca đó
  const dayOfWeek = now.getDay();
  const shiftsToCheck = dayOfWeek === 0
    ? [] // Chủ nhật: không kiểm tra
    : dayOfWeek === 6
      ? ["morning"] // Thứ 7: chỉ ca sáng
      : ["morning", "afternoon"];

  for (const shift of shiftsToCheck) {
    const assignedSet = assignedByShift.get(shift) || new Set();
    for (const staffId of activeStaffIds) {
      // Đã có assignment? → skip
      if (assignedSet.has(staffId)) continue;
      // Đang nghỉ phép? → skip
      if (leaveSet.has(`${staffId}_${shift}`) || leaveSet.has(`${staffId}_full-day`)) continue;
      
      const name = staffMap.get(staffId) || "Không rõ";
      const shiftLabel = shift === "morning" ? "Sáng" : "Chiều";
      unassignedStaff.push({ name, shiftLabel });
    }
  }

  // --- TỔNG HỢP THÔNG BÁO ---
  let messageParts = [];

  // 1. Nhân sự chưa phân vị trí (MỚI - hiển thị đầu tiên vì quan trọng)
  if (unassignedStaff.length > 0) {
    const grouped = {};
    for (const u of unassignedStaff) {
      if (!grouped[u.shiftLabel]) grouped[u.shiftLabel] = [];
      grouped[u.shiftLabel].push(u.name);
    }
    const lines = Object.entries(grouped)
      .map(([shift, names]) => `Ca ${shift}: ${names.join(", ")}`)
      .join("\n");
    messageParts.push(`🟡 Chưa phân vị trí (${unassignedStaff.length}):\n${lines}`);
  }

  // 2. Nghỉ phép
  if (todayLeaves.length > 0) {
    messageParts.push(`📋 Nhân sự nghỉ (${todayLeaves.length}):\n${todayLeaves.join(", ")}`);
  }

  // 3. Xung đột
  if (conflicts.length > 0) {
    messageParts.push(`⚠️ XUNG ĐỘT (Trực vs Nghỉ):\n${conflicts.join("\n")}`);
  }

  // 4. Vị trí trống (Không có ai trực)
  if (!hasScheduleToday) {
    messageParts.push("🔴 CẢNH BÁO: Hôm nay chưa có dữ liệu lịch trực!");
  } else if (criticalEmpty.length > 0) {
    messageParts.push(`🔴 PHÒNG TRỐNG (0 nhân sự):\n${criticalEmpty.join("\n")}`);
  } else if (partialEmpty.length > 0) {
    messageParts.push(`✅ Đã có tối thiểu 1 nhân sự ở mọi phòng.\n(Lưu ý: Có ${partialEmpty.length} vị trí chưa gán đủ số lượng)`);
  } else {
    messageParts.push("✅ Mọi vị trí đều đã gán đủ nhân sự.");
  }

  const finalMessage = messageParts.join("\n\n");
  console.log(finalMessage);

  notifier.notify({
    title: "Nusres: Cảnh báo vận hành",
    message: finalMessage,
    sound: true,
    wait: false,
    appID: "Nusres.App",
  });
}

main().catch(console.error);
