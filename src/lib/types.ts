export type Role = "admin" | "coordinator" | "viewer";

export type ShiftType = "morning" | "afternoon";

export type LeaveShift = ShiftType | "full-day";

export type LeaveReason = "phep" | "om" | "dihoc" | "khac";

export type AssignmentSource = "template" | "manual";

export type AssignmentStatus =
  | "draft"
  | "published"
  | "adjusted"
  | "needs-review";

export interface StaffMember {
  id: string;
  name: string;
  code: string;
  email: string;
  role: Role;
  positionIds: string[];
  active: boolean;
  prefersOvertime: boolean;
  notes?: string;
}

export interface Position {
  id: string;
  name: string;
  area: string;
  description?: string;
  quota?: number;
  staffOrder?: string[];
}

export interface ScheduleRule {
  id: string;
  dayOfWeek: number;
  shift: ShiftType;
  active: boolean;
  label?: string;
}

export interface PositionRule {
  id: string;
  positionId: string;
  dayOfWeek: number;
  shift: ShiftType;
  active: boolean;
}

export interface TemplateAssignment {
  id: string;
  dayOfWeek: number;
  shift: ShiftType;
  positionId: string;
  staffId: string;
  slotIndex?: number;
  note?: string;
}

export interface WeeklyAssignment {
  id: string;
  weekStart: string;
  date: string;
  shift: ShiftType;
  positionId: string;
  staffId: string;
  slotIndex?: number;
  source: AssignmentSource;
  status: AssignmentStatus;
  note?: string;
}

export interface LeaveRecord {
  id: string;
  staffId: string;
  date: string;
  shift: LeaveShift;
  reason: LeaveReason;
  note?: string;
}

export interface AccessControlEntry {
  id: string;
  email: string;
  role: Role;
  displayName?: string;
}

export interface AppData {
  staff: StaffMember[];
  positions: Position[];
  scheduleRules: ScheduleRule[];
  templateSchedule: TemplateAssignment[];
  weeklySchedule: WeeklyAssignment[];
  leaveRequests: LeaveRecord[];
  positionRules: PositionRule[];
  accessControl: AccessControlEntry[];
}

export interface SessionUser {
  name: string;
  email: string;
  role: Role;
  image?: string | null;
  demo: boolean;
}

export interface WorkloadSummary {
  staffId: string;
  workDays: number;
  shifts: number;
  morningShifts: number;
  afternoonShifts: number;
  overtimeShifts: number;
  positionsCovered: number;
}

export interface LeaveSummary {
  staffId: string;
  days: number;
  phep: number;
  om: number;
  dihoc: number;
  khac: number;
}

export interface RotationSummary {
  staffId: string;
  positionId: string;
  firstDate: string;
  lastDate: string;
  shifts: number;
}
