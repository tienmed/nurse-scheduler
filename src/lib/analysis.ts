import { differenceInCalendarDays, parseISO, isAfter, subDays, startOfToday } from "date-fns";
import type { WeeklyAssignment, StaffMember, Position } from "./types";
import { calculatePositionRotations } from "./schedule";

export interface RotationWarning {
  staffId: string;
  staffName: string;
  positionId: string;
  positionName: string;
  durationDays: number;
  months: number;
  firstDate: string;
  lastDate: string;
  isStagnant: boolean;
}

/**
 * [QWEN3] PhÃ¢n tÃ­ch vÃ  phÃ¡t hiá»‡n nhÃ¢n sá»± á»Ÿ má»™t vá»‹ trÃ­ quÃ¡ lÃ¢u (máº·c Ä‘á»‹nh > 180 ngÃ y)
 */
export function getRotationWarnings(
  weeklySchedule: WeeklyAssignment[],
  staff: StaffMember[],
  positions: Position[],
  thresholdDays: number = 180
): RotationWarning[] {
  const summaries = calculatePositionRotations(weeklySchedule);
  const staffMap = new Map(staff.map(s => [s.id, s]));
  const posMap = new Map(positions.map(p => [p.id, p]));
  
  const today = startOfToday();
  const activeCutoff = subDays(today, 14); // Chá»‰ tÃ­nh nhá»¯ng ngÆ°á»i cÃ²n Ä‘ang lÃ m vá»‹ trÃ­ Ä‘Ã³ trong 2 tuáº§n qua

  return summaries
    .map(s => {
      const first = parseISO(s.firstDate);
      const last = parseISO(s.lastDate);
      const durationDays = differenceInCalendarDays(last, first);
      
      const staffMember = staffMap.get(s.staffId);
      const position = posMap.get(s.positionId);
      
      return {
        staffId: s.staffId,
        staffName: staffMember?.name || "N/A",
        positionId: s.positionId,
        positionName: position?.name || "N/A",
        durationDays,
        months: Math.floor(durationDays / 30),
        firstDate: s.firstDate,
        lastDate: s.lastDate,
        isStagnant: durationDays >= thresholdDays && isAfter(last, activeCutoff)
      };
    })
    .filter(w => w.isStagnant)
    .sort((a, b) => b.durationDays - a.durationDays);
}
