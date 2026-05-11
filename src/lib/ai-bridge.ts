import { getCachedAppData } from "@/lib/google-sheets";
import { aiService } from "@/lib/ai-service";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";

export async function optimizeMonthlyScheduleWithAI(month: Date) {
  const data = await getCachedAppData();
  
  // Chuẩn bị dữ liệu cho AI
  const context = {
    staff: data.staff.filter(s => s.active).map(s => ({
      id: s.id,
      name: s.name,
      positions: s.positionIds
    })),
    positions: data.positions,
    leaveRequests: data.leaveRequests.filter(l => {
      const d = new Date(l.date);
      return d >= startOfMonth(month) && d <= endOfMonth(month);
    }),
    holidays: data.holidays.filter(h => {
      const d = new Date(h.date);
      return d >= startOfMonth(month) && d <= endOfMonth(month);
    }),
    rules: data.scheduleRules.filter(r => r.active)
  };

  const constraints = `
    - Tháng: ${format(month, "MM/yyyy")}
    - Số lượng điều dưỡng: ${context.staff.length}
    - Đảm bảo mỗi ca trực có đủ người theo quota của vị trí.
    - Ưu tiên người không có yêu cầu nghỉ phép vào ngày đó.
    - Cố gắng phân bổ đều số ca trực đêm/sáng cho mọi người.
  `;

  return await aiService.optimizeSchedule(context, constraints);
}

export async function validateWeeklyScheduleWithAI(weekStart: string) {
  const data = await getCachedAppData();
  
  // Lấy lịch trực của tuần cụ thể
  const weeklySchedule = data.weeklySchedule.filter(s => s.weekStart === weekStart);
  
  if (weeklySchedule.length === 0) {
    return "Không tìm thấy dữ liệu lịch trực cho tuần này để kiểm tra.";
  }

  return await aiService.validateSchedule(weeklySchedule);
}

export async function getPersonalAISummary(staffId: string) {
  const data = await getCachedAppData();
  const staff = data.staff.find(s => s.id === staffId);
  
  if (!staff) return "Không tìm thấy thông tin nhân viên.";

  const personalSchedule = data.weeklySchedule.filter(s => s.staffId === staffId);
  
  return await aiService.generateNotification(staff.name, personalSchedule);
}

export async function getMonthlyExecutiveSummaryWithAI(monthKey: string) {
  const data = await getCachedAppData();
  
  // Tổng hợp dữ liệu cho báo cáo điều hành
  const reportData = {
    month: monthKey,
    stats: {
      totalStaff: data.staff.length,
      activeStaff: data.staff.filter(s => s.active).length,
      totalLeaveRequests: data.leaveRequests.filter(l => l.date.startsWith(monthKey)).length,
      totalWeeklyAssignments: data.weeklySchedule.filter(s => s.weekStart.startsWith(monthKey)).length
    },
    // Chúng ta có thể bổ sung thêm dữ liệu chi tiết nếu cần, 
    // nhưng để tiết kiệm token thì gửi các con số tổng hợp là đủ.
  };

  return await aiService.generateExecutiveReport(reportData);
}
