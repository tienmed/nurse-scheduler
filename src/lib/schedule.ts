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
  RotationSummary,
  ScheduleRule,
  ShiftType,
  StaffMember,
  TemplateAssignment,
  WeeklyAssignment,
  WorkloadSummary,
} from "@/lib/types";

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
  weekStart: string,
  leaveRequests: LeaveRecord[],
  scheduleRules: ScheduleRule[],
) {
  const weekStartDate = parseISO(weekStart);
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
          id: `weekly-${weekStart}-${assignment.shift}-${assignment.positionId}-${assignment.staffId}-${assignment.dayOfWeek}`,
          weekStart,
          date,
          shift: assignment.shift,
          positionId: assignment.positionId,
          staffId: assignment.staffId,
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
) {
  const assignments = getWeeklyAssignments(weeklySchedule, weekStart);
  const staffMap = new Map(staff.map((member) => [member.id, member]));

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
      entries: positions.map((position) => {
        const assignment = assignments.find(
          (item) =>
            item.date === date &&
            item.shift === slot.shift &&
            item.positionId === position.id,
        );
        const person = assignment ? staffMap.get(assignment.staffId) ?? null : null;
        const leave = assignment
          ? getLeaveConflict(assignment.staffId, date, slot.shift, leaveRequests)
          : null;

        return {
          position,
          assignment,
          person,
          leave,
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
  const shifts = new Map<string, WorkloadSummary>();

  weeklySchedule
    .filter((assignment) => assignment.date >= start && assignment.date <= end)
    .forEach((assignment) => {
      const dayBucket = summaries.get(assignment.staffId) ?? new Set<string>();
      dayBucket.add(assignment.date);
      summaries.set(assignment.staffId, dayBucket);

      const current = shifts.get(assignment.staffId) ?? {
        staffId: assignment.staffId,
        workDays: 0,
        shifts: 0,
        morningShifts: 0,
        afternoonShifts: 0,
      };

      current.shifts += 1;
      current.morningShifts += assignment.shift === "morning" ? 1 : 0;
      current.afternoonShifts += assignment.shift === "afternoon" ? 1 : 0;

      shifts.set(assignment.staffId, current);
    });

  return [...shifts.values()].map((summary) => ({
    ...summary,
    workDays: summaries.get(summary.staffId)?.size ?? 0,
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
