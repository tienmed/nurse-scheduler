import { getCachedAppData } from "@/lib/google-sheets";
import { aiService } from "@/lib/ai-service";
import { format, startOfMonth, endOfMonth } from "date-fns";

export async function optimizeMonthlyScheduleWithAI(month: Date) {
  const data = await getCachedAppData();
  
  // Chuáº©n bá»‹ dá»¯ liá»‡u cho AI
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
    - ThÃ¡ng: ${format(month, "MM/yyyy")}
    - Sá»‘ lÆ°á»£ng Ä‘iá»u dÆ°á»¡ng: ${context.staff.length}
    - Äáº£m báº£o má»—i ca trá»±c cÃ³ Ä‘á»§ ngÆ°á»i theo quota cá»§a vá»‹ trÃ­.
    - Æ¯u tiÃªn ngÆ°á»i khÃ´ng cÃ³ yÃªu cáº§u nghá»‰ phÃ©p vÃ o ngÃ y Ä‘Ã³.
    - Cá»‘ gáº¯ng phÃ¢n bá»• Ä‘á»u sá»‘ ca trá»±c Ä‘Ãªm/sÃ¡ng cho má»i ngÆ°á»i.
  `;

  return await aiService.optimizeSchedule(context, constraints);
}

export async function validateWeeklyScheduleWithAI(weekStart: string) {
  const data = await getCachedAppData();
  
  // Láº¥y lá»‹ch trá»±c cá»§a tuáº§n cá»¥ thá»ƒ
  const weeklySchedule = data.weeklySchedule.filter(s => s.weekStart === weekStart);
  
  if (weeklySchedule.length === 0) {
    return "KhÃ´ng tÃ¬m tháº¥y dá»¯ liá»‡u lá»‹ch trá»±c cho tuáº§n nÃ y Ä‘á»ƒ kiá»ƒm tra.";
  }

  return await aiService.validateSchedule(weeklySchedule);
}

export async function getPersonalAISummary(staffId: string) {
  const data = await getCachedAppData();
  const staff = data.staff.find(s => s.id === staffId);
  
  if (!staff) return "KhÃ´ng tÃ¬m tháº¥y thÃ´ng tin nhÃ¢n viÃªn.";

  const personalSchedule = data.weeklySchedule.filter(s => s.staffId === staffId);
  
  return await aiService.generateNotification(staff.name, personalSchedule);
}

export async function getMonthlyExecutiveSummaryWithAI(monthKey: string) {
  const data = await getCachedAppData();
  
  // Tá»•ng há»£p dá»¯ liá»‡u cho bÃ¡o cÃ¡o Ä‘iá»u hÃ nh
  const reportData = {
    month: monthKey,
    stats: {
      totalStaff: data.staff.length,
      activeStaff: data.staff.filter(s => s.active).length,
      totalLeaveRequests: data.leaveRequests.filter(l => l.date.startsWith(monthKey)).length,
      totalWeeklyAssignments: data.weeklySchedule.filter(s => s.weekStart.startsWith(monthKey)).length
    },
    // ChÃºng ta cÃ³ thá»ƒ bá»• sung thÃªm dá»¯ liá»‡u chi tiáº¿t náº¿u cáº§n, 
    // nhÆ°ng Ä‘á»ƒ tiáº¿t kiá»‡m token thÃ¬ gá»­i cÃ¡c con sá»‘ tá»•ng há»£p lÃ  Ä‘á»§.
  };

  return await aiService.generateExecutiveReport(reportData);
}
