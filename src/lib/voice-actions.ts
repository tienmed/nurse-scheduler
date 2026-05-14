import { getCachedAppData, writeAppDataKeysToSheets, invalidateAppDataCache } from "@/lib/google-sheets";
import { format, startOfToday } from "date-fns";

export async function executeVoiceCoordination(command: {
  action: 'MOVE' | 'LEAVE' | 'UNKNOWN';
  staffName?: string;
  sourcePosition?: string;
  targetPosition?: string;
  replacedStaffName?: string;
  date?: string;
  shift?: 'morning' | 'afternoon' | 'full-day';
  reason?: string;
  time?: string;
}) {
  if (command.action === 'UNKNOWN' || !command.staffName) {
    return { success: false, message: "Không hiểu lệnh điều phối." };
  }

  const data = await getCachedAppData();
  const todayStr = format(startOfToday(), "yyyy-MM-dd");
  const now = new Date();
  const currentShift = now.getHours() < 13 ? 'morning' : 'afternoon';
  
  // 1. Tìm nhân viên A
  const staffA = data.staff.find(s => 
    s.name.toLowerCase().includes(command.staffName!.toLowerCase())
  );
  if (!staffA) return { success: false, message: `Không tìm thấy nhân viên "${command.staffName}".` };

  // 2. Xử lý hành động MOVE
  if (command.action === 'MOVE') {
    // ... (logic MOVE đã có)
    if (!command.targetPosition) return { success: false, message: "Thiếu vị trí đích." };

    const posTarget = data.positions.find(p => 
      p.name.toLowerCase().includes(command.targetPosition!.toLowerCase())
    );
    if (!posTarget) return { success: false, message: `Không tìm thấy vị trí đích "${command.targetPosition}".` };

    data.weeklySchedule = data.weeklySchedule.filter(s => 
      !(s.staffId === staffA.id && s.date === todayStr && s.shift === currentShift)
    );

    let bMessage = "";
    if (command.replacedStaffName) {
      const staffB = data.staff.find(s => s.name.toLowerCase().includes(command.replacedStaffName!.toLowerCase()));
      if (staffB) {
        const isAssigned = data.weeklySchedule.some(s => 
          s.staffId === staffB.id && s.date === todayStr && s.shift === currentShift && s.positionId === posTarget.id
        );
        if (isAssigned) {
          data.weeklySchedule = data.weeklySchedule.filter(s => 
            !(s.staffId === staffB.id && s.date === todayStr && s.shift === currentShift && s.positionId === posTarget.id)
          );
          bMessage = ` (đã thay thế ${staffB.name})`;
        }
      }
    }

    data.weeklySchedule.push({
      id: `voice-${Date.now()}`,
      weekStart: todayStr,
      date: todayStr,
      shift: currentShift as any,
      staffId: staffA.id,
      positionId: posTarget.id,
      slotIndex: 0,
      status: 'published',
      source: 'manual',
      note: `Điều phối giọng nói: Chuyển sang ${posTarget.name}${bMessage}`
    });

    await writeAppDataKeysToSheets(data, ['weeklySchedule']);
    invalidateAppDataCache();

    return { success: true, message: `Đã chuyển ${staffA.name} sang ${posTarget.name}${bMessage}.` };
  }

  // 3. Xử lý hành động LEAVE (Báo nghỉ nhanh)
  if (command.action === 'LEAVE') {
    let targetDate = todayStr;
    if (command.date === 'tomorrow') {
      targetDate = format(new Date(now.getTime() + 24 * 60 * 60 * 1000), "yyyy-MM-dd");
    } else if (command.date && command.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      targetDate = command.date;
    }

    const shift = command.shift || currentShift;

    data.leaveRequests.push({
      id: `voice-leave-${Date.now()}`,
      staffId: staffA.id,
      date: targetDate,
      shift: shift as any,
      reason: (command.reason || 'personal') as any,
      note: `Báo nghỉ qua giọng nói lúc ${format(now, "HH:mm")}`
    });

    await writeAppDataKeysToSheets(data, ['leaveRequests']);
    invalidateAppDataCache();

    const dateLabel = command.date === 'tomorrow' ? "ngày mai" : "hôm nay";
    const shiftLabel = shift === 'full-day' ? "cả ngày" : (shift === 'morning' ? "ca sáng" : "ca chiều");

    return { 
      success: true, 
      message: `Đã ghi nhận ${staffA.name} nghỉ ${shiftLabel} ${dateLabel}.` 
    };
  }

  return { success: false, message: "Hành động chưa được hỗ trợ." };
}
