import { addDays, compareAsc, differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  DEFAULT_SCHEDULE_RULES,
  LEAVE_REASON_LABELS,
  SHIFT_LABELS,
  WEEKDAY_LABELS,
} from "@/lib/constants";
import { getMonthBounds } from "@/lib/date";
import type {
  LeaveRecord,
  LeaveSummary,
  Position,
  PositionRule,
  RotationSummary,
  ScheduleRule,
  ShiftType,
  StaffMember,
  TemplateAssignment,
  WeeklyAssignment,
  WorkloadSummary,
} from "@/lib/types";

/**
 * Thứ 7 (dayOfWeek=6) ca sáng được coi là ca tăng ca.
 */
export const OVERTIME_DAY_OF_WEEK = 6;

export function isOvertimeSlot(date: string, shift: ShiftType) {
  const parsed = parseISO(date);
  return parsed.getDay() === OVERTIME_DAY_OF_WEEK && shift === "morning";
}

function sortAssignments<T extends { date: string; shift: ShiftType }>(items: T[]) {
  return [...items].sort((left, right) => {
    const dateCompare = compareAsc(parseISO(left.date), parseISO(right.date));
    if (dateCompare !== 0) {
      return dateCompare;
    }

    if (left.shift === right.shift) {
      return 0;
    }

    return left.shift === "morning" ? -1 : 1;
  });
}

function sortScheduleRules(rules: ScheduleRule[]) {
  return [...rules].sort((left, right) => {
    if (left.dayOfWeek !== right.dayOfWeek) {
      return left.dayOfWeek - right.dayOfWeek;
    }

    if (left.shift === right.shift) {
      return 0;
    }

    return left.shift === "morning" ? -1 : 1;
  });
}

export function getActiveScheduleRules(rules: ScheduleRule[]) {
  const source = rules.length > 0 ? rules : DEFAULT_SCHEDULE_RULES;
  return sortScheduleRules(source).filter((rule) => rule.active);
}

export function getLeaveConflict(
  staffId: string,
  date: string,
  shift: ShiftType,
  leaveRequests: LeaveRecord[],
) {
  return leaveRequests.find(
    (leave) =>
      leave.staffId === staffId &&
      leave.date === date &&
      (leave.shift === "full-day" || leave.shift === shift),
  );
}

export function buildAssignmentsFromTemplate(
  templateSchedule: TemplateAssignment[],
  positions: Position[],
  weekStart: string,
  leaveRequests: LeaveRecord[],
  scheduleRules: ScheduleRule[],
  positionRules: PositionRule[] = [],
) {
  const weekStartDate = parseISO(weekStart);
  const inactivePositionRules = positionRules.filter((r) => !r.active);

  const allowedSlots = new Set(
    getActiveScheduleRules(scheduleRules).map(
      (rule) => `${rule.dayOfWeek}-${rule.shift}`,
    ),
  );

  return sortAssignments(
    templateSchedule
      .filter((assignment) =>
        allowedSlots.has(`${assignment.dayOfWeek}-${assignment.shift}`),
      )
      .filter((assignment) => {
        // Lọc bỏ nếu vị trí bị đóng
        const isPositionClosed = inactivePositionRules.some(
          (r) =>
            Number(r.dayOfWeek) === Number(assignment.dayOfWeek) &&
            String(r.shift) === String(assignment.shift) &&
            String(r.positionId) === String(assignment.positionId),
        );
        return !isPositionClosed;
      })
      .map((assignment) => {
        const date = format(
          addDays(weekStartDate, assignment.dayOfWeek - 1),
          "yyyy-MM-dd",
        );
        const leave = getLeaveConflict(
          assignment.staffId,
          date,
          assignment.shift,
          leaveRequests,
        );

        return {
          id: `weekly-${weekStart}-${assignment.shift}-${assignment.positionId}-${assignment.staffId}-${assignment.dayOfWeek}-${assignment.slotIndex || 0}`,
          weekStart,
          date,
          shift: assignment.shift,
          positionId: assignment.positionId,
          staffId: assignment.staffId,
          slotIndex: assignment.slotIndex,
          source: "template" as const,
          status: leave ? ("needs-review" as const) : ("draft" as const),
          note: leave
            ? `Trùng lịch nghỉ ${LEAVE_REASON_LABELS[leave.reason].toLowerCase()}`
            : assignment.note ?? "",
        };
      }),
  );
}

export function getWeeklyAssignments(
  weeklySchedule: WeeklyAssignment[],
  weekStart: string,
) {
  return sortAssignments(
    weeklySchedule.filter((assignment) => assignment.weekStart === weekStart),
  );
}

export function getWeekBoard(
  weeklySchedule: WeeklyAssignment[],
  positions: Position[],
  staff: StaffMember[],
  leaveRequests: LeaveRecord[],
  weekStart: string,
  scheduleRules: ScheduleRule[],
  positionRules: PositionRule[] = [],
) {
  const assignments = getWeeklyAssignments(weeklySchedule, weekStart);
  const staffMap = new Map(staff.map((member) => [member.id, member]));
  const closedPositions = positionRules.filter((r) => !r.active);

  return getActiveScheduleRules(scheduleRules).map((slot) => {
    const date = format(
      addDays(parseISO(weekStart), slot.dayOfWeek - 1),
      "yyyy-MM-dd",
    );

    return {
      date,
      dayOfWeek: slot.dayOfWeek,
      shift: slot.shift,
      title: `${WEEKDAY_LABELS[slot.dayOfWeek]} · ${SHIFT_LABELS[slot.shift]}`,
      entries: positions
        .filter((position) => {
          // Chỉ lấy vị trí đang mở
          const isPositionClosed = closedPositions.some(
            (r) =>
              Number(r.dayOfWeek) === Number(slot.dayOfWeek) &&
              String(r.shift) === String(slot.shift) &&
              String(r.positionId) === String(position.id),
          );
          return !isPositionClosed;
        })
        .map((position) => {
          const posAssignments = assignments.filter(
          (item) =>
            item.date === date &&
            item.shift === slot.shift &&
            item.positionId === position.id,
        );

        const quota = position.quota || 1;
        const slots = [];

        // Đẻ đủ số khe dựa theo quota
        const iterations = Math.max(quota, posAssignments.length);

        for (let i = 0; i < iterations; i++) {
          const assignment = posAssignments.find((a) => (a.slotIndex || 0) === i) ?? null;
          let person = assignment ? staffMap.get(assignment.staffId) ?? null : null;

          if (!assignment) {
            const defaultStaffId = position.staffOrder?.[i];
            if (defaultStaffId) {
              person = staffMap.get(defaultStaffId) ?? null;
            }
          }

          const leave = assignment
            ? getLeaveConflict(assignment.staffId, date, slot.shift, leaveRequests)
            : person
              ? getLeaveConflict(person.id, date, slot.shift, leaveRequests)
              : null;

          slots.push({
            assignment,
            person,
            leave,
            slotIndex: i,
          });
        }

        return {
          position,
          slots,
        };
      }),
    };
  });
}

export function calculateMonthlyWorkload(
  weeklySchedule: WeeklyAssignment[],
  monthKey: string,
): WorkloadSummary[] {
  const { start, end } = getMonthBounds(monthKey);
  const summaries = new Map<string, Set<string>>();
  const positionSets = new Map<string, Set<string>>();
  const shifts = new Map<string, WorkloadSummary>();

  weeklySchedule
    .filter((assignment) => assignment.date >= start && assignment.date <= end)
    .forEach((assignment) => {
      const dayBucket = summaries.get(assignment.staffId) ?? new Set<string>();
      dayBucket.add(assignment.date);
      summaries.set(assignment.staffId, dayBucket);

      const posBucket = positionSets.get(assignment.staffId) ?? new Set<string>();
      posBucket.add(assignment.positionId);
      positionSets.set(assignment.staffId, posBucket);

      const current = shifts.get(assignment.staffId) ?? {
        staffId: assignment.staffId,
        workDays: 0,
        shifts: 0,
        morningShifts: 0,
        afternoonShifts: 0,
        overtimeShifts: 0,
        positionsCovered: 0,
      };

      current.shifts += 1;
      current.morningShifts += assignment.shift === "morning" ? 1 : 0;
      current.afternoonShifts += assignment.shift === "afternoon" ? 1 : 0;
      current.overtimeShifts += isOvertimeSlot(assignment.date, assignment.shift) ? 1 : 0;

      shifts.set(assignment.staffId, current);
    });

  return [...shifts.values()].map((summary) => ({
    ...summary,
    workDays: summaries.get(summary.staffId)?.size ?? 0,
    positionsCovered: positionSets.get(summary.staffId)?.size ?? 0,
  }));
}

export function calculateMonthlyLeaves(
  leaveRequests: LeaveRecord[],
  monthKey: string,
): LeaveSummary[] {
  const { start, end } = getMonthBounds(monthKey);
  const summaries = new Map<string, LeaveSummary>();

  leaveRequests
    .filter((leave) => leave.date >= start && leave.date <= end)
    .forEach((leave) => {
      const current = summaries.get(leave.staffId) ?? {
        staffId: leave.staffId,
        days: 0,
        phep: 0,
        om: 0,
        dihoc: 0,
        khac: 0,
      };

      current.days += leave.shift === "full-day" ? 1 : 0.5;
      current[leave.reason] += 1;
      summaries.set(leave.staffId, current);
    });

  return [...summaries.values()];
}

export function calculatePositionRotations(
  weeklySchedule: WeeklyAssignment[],
): RotationSummary[] {
  const rotations = new Map<string, RotationSummary>();

  sortAssignments(weeklySchedule).forEach((assignment) => {
    const key = `${assignment.staffId}-${assignment.positionId}`;
    const current = rotations.get(key);

    if (!current) {
      rotations.set(key, {
        staffId: assignment.staffId,
        positionId: assignment.positionId,
        firstDate: assignment.date,
        lastDate: assignment.date,
        shifts: 1,
      });
      return;
    }

    current.lastDate = assignment.date;
    current.shifts += 1;
  });

  return [...rotations.values()].sort((left, right) => {
    const dateGap =
      differenceInCalendarDays(parseISO(right.lastDate), parseISO(left.lastDate));
    if (dateGap !== 0) {
      return dateGap;
    }
    return right.shifts - left.shifts;
  });
}

export function getStatusTone(status: WeeklyAssignment["status"]) {
  switch (status) {
    case "published":
      return "emerald";
    case "adjusted":
      return "amber";
    case "needs-review":
      return "rose";
    default:
      return "slate";
  }
}

export interface SuggestionResult {
  staff: StaffMember;
  score: number;
  reasons: string[];
}

/**
 * Gợi ý nhân sự phù hợp cho một vị trí/ngày/ca cụ thể.
 * Ưu tiên: (1) không trùng nghỉ phép, (2) Cùng khu vực / vị trí chuyên môn,
 * (3) Không bị bận ca khác, (4) Ưu tiên workload rảnh.
 */
export function suggestStaffForSlot(
  staff: StaffMember[],
  positions: Position[],
  date: string,
  shift: ShiftType,
  positionId: string,
  leaveRequests: LeaveRecord[],
  workload: WorkloadSummary[],
  weeklySchedule: WeeklyAssignment[] = [],
): SuggestionResult[] {
  const isOvertime = isOvertimeSlot(date, shift);
  const workloadMap = new Map(workload.map((w) => [w.staffId, w]));
  const targetPos = positions.find((p) => p.id === positionId);
  const staffOrder = targetPos?.staffOrder || [];

  // Lấy các assignment trong cùng buổi
  const currentShiftAssignments = weeklySchedule.filter(
    (a) => a.date === date && a.shift === shift
  );
  
  // Trích xuất những người đã có ca trong cùng buổi
  const busyStaffMap = new Map<string, string[]>();
  for (const a of currentShiftAssignments) {
    const list = busyStaffMap.get(a.staffId) || [];
    const posName = positions.find((p) => p.id === a.positionId)?.name || a.positionId;
    list.push(posName);
    busyStaffMap.set(a.staffId, list);
  }

  const available = staff.filter((member) => {
    if (!member.active) return false;
    const conflict = getLeaveConflict(member.id, date, shift, leaveRequests);
    if (conflict) return false;
    return true;
  });

  const suggestions = available.map((member) => {
    const reasons: string[] = [];
    let score = 0;
    const w = workloadMap.get(member.id);

    // Ưu tiên hiển thị
    const orderIdx = staffOrder.indexOf(member.id);
    if (orderIdx !== -1) {
      reasons.unshift(`Ưu tiên #${orderIdx + 1}`);
      score += (1000 - orderIdx * 10);
    } else if (member.positionIds.includes(positionId)) {
      reasons.push("Cùng khu vực");
      score += 100;
    }

    const busyPositions = busyStaffMap.get(member.id);
    if (busyPositions) {
      // Đã bị xoá khỏi mảng available nếu có LeaveConflict,
      // nên ở đây chắc chắn là "kiêm nhiệm" các vị trí khác
       if (busyPositions.includes(targetPos?.name || "")) {
         // Đang bị trùng CHÍNH cái vị trí đang chọn (nghịch lý nhưng nếu db có lưu trước đó)
         // Thực tế là nếu họ đã có trong vị trí này (chẳng hạn slot 0), nếu click slot 1 họ cũng hiện ra list list.
         reasons.push(`Đang ở ca này`);
       } else {
         reasons.push(`Đã xếp: ${busyPositions.join(", ")}`);
       }
       score -= 50; 
    } else {
      reasons.push("Rảnh ca này");
      score += 20; 
    }

    // Nếu là ngày tăng ca
    if (isOvertime && member.prefersOvertime) {
      reasons.push("Sẵn sàng TC");
      score += 50;
    }

    // Đánh giá số ca
    const shiftsCount = w?.shifts ?? 0;
    if (shiftsCount <= 3) {
      reasons.push("Ít ca");
      score += (20 - shiftsCount); // Càng ít càng được củng cố
    } else {
      score -= (shiftsCount * 2);
    }

    return { staff: member, reasons, score };
  });

  return suggestions.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Cùng điểm thì người ít ca trước
    const aShifts = workloadMap.get(a.staff.id)?.shifts ?? 0;
    const bShifts = workloadMap.get(b.staff.id)?.shifts ?? 0;
    return aShifts - bShifts;
  });
}

export function getDefaultDayAndShift(weekStart: string): { day: number; shift: "morning" | "afternoon" } {
  const now = new Date();
  const weekStartDate = parseISO(weekStart);
  const weekEndDate = addDays(weekStartDate, 5); // Thứ 7

  if (now >= weekStartDate && now <= addDays(weekEndDate, 1)) {
    const currentDay = now.getDay(); 
    const hour = now.getHours();
    
    if (currentDay === 0 || currentDay > 6) {
      return { day: 1, shift: "morning" };
    }
    
    return {
      day: currentDay, 
      shift: hour < 12 ? "morning" : "afternoon",
    };
  }

  return { day: 1, shift: "morning" };
}
