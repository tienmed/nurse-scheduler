import type {
  AccessControlEntry,
  LeaveReason,
  LeaveShift,
  Role,
  ScheduleRule,
  ShiftType,
} from "@/lib/types";

export const APP_NAME = "NurseFlow";

export const APP_TAGLINE =
  "Äiá»u phá»‘i lá»‹ch Ä‘iá»u dÆ°á»¡ng theo tuáº§n, cáº­p nháº­t Ä‘á»™t xuáº¥t vÃ  bÃ¡m dá»¯ liá»‡u Google Sheets.";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Quáº£n trá»‹",
  coordinator: "Äiá»u phá»‘i",
  viewer: "Theo dÃµi",
};

export const SHIFT_LABELS: Record<ShiftType, string> = {
  morning: "SÃ¡ng",
  afternoon: "Chiá»u",
};

export const LEAVE_SHIFT_LABELS: Record<LeaveShift, string> = {
  morning: "Ca sÃ¡ng",
  afternoon: "Ca chiá»u",
  "full-day": "Cáº£ ngÃ y",
};

export const LEAVE_REASON_LABELS: Record<LeaveReason, string> = {
  phep: "PhÃ©p",
  om: "á»m",
  khac: "KhÃ¡c",
};

export const WEEKDAY_LABELS = [
  "Chá»§ nháº­t",
  "Thá»© 2",
  "Thá»© 3",
  "Thá»© 4",
  "Thá»© 5",
  "Thá»© 6",
  "Thá»© 7",
] as const;

export const DEFAULT_SCHEDULE_RULES: ScheduleRule[] = [
  { id: "slot-1-morning", dayOfWeek: 1, shift: "morning", active: true, label: "SÃ¡ng thá»© 2" },
  { id: "slot-1-afternoon", dayOfWeek: 1, shift: "afternoon", active: true, label: "Chiá»u thá»© 2" },
  { id: "slot-2-morning", dayOfWeek: 2, shift: "morning", active: true, label: "SÃ¡ng thá»© 3" },
  { id: "slot-2-afternoon", dayOfWeek: 2, shift: "afternoon", active: true, label: "Chiá»u thá»© 3" },
  { id: "slot-3-morning", dayOfWeek: 3, shift: "morning", active: true, label: "SÃ¡ng thá»© 4" },
  { id: "slot-3-afternoon", dayOfWeek: 3, shift: "afternoon", active: true, label: "Chiá»u thá»© 4" },
  { id: "slot-4-morning", dayOfWeek: 4, shift: "morning", active: true, label: "SÃ¡ng thá»© 5" },
  { id: "slot-4-afternoon", dayOfWeek: 4, shift: "afternoon", active: true, label: "Chiá»u thá»© 5" },
  { id: "slot-5-morning", dayOfWeek: 5, shift: "morning", active: true, label: "SÃ¡ng thá»© 6" },
  { id: "slot-5-afternoon", dayOfWeek: 5, shift: "afternoon", active: true, label: "Chiá»u thá»© 6" },
  { id: "slot-6-morning", dayOfWeek: 6, shift: "morning", active: true, label: "SÃ¡ng thá»© 7" },
  { id: "slot-6-afternoon", dayOfWeek: 6, shift: "afternoon", active: false, label: "Chiá»u thá»© 7" },
];

export const SHEET_NAMES = {
  staff: "staff",
  positions: "positions",
  scheduleRules: "schedule_rules",
  templateSchedule: "template_schedule",
  weeklySchedule: "weekly_schedule",
  leaveRequests: "leave_requests",
  accessControl: "access_control",
} as const;

export const SHEET_HEADERS = {
  staff: ["id", "name", "code", "team", "active", "notes"],
  positions: ["id", "name", "area", "description"],
  scheduleRules: ["id", "dayOfWeek", "shift", "active", "label"],
  templateSchedule: ["id", "dayOfWeek", "shift", "positionId", "staffId", "note"],
  weeklySchedule: [
    "id",
    "weekStart",
    "date",
    "shift",
    "positionId",
    "staffId",
    "source",
    "status",
    "note",
  ],
  leaveRequests: ["id", "staffId", "date", "shift", "reason", "note"],
  accessControl: ["id", "email", "role", "displayName"],
} as const;

export const DEMO_ACCESS_CONTROL: AccessControlEntry[] = [
  {
    id: "access-admin-demo",
    email: "admin@nurseflow.local",
    role: "admin",
    displayName: "Äiá»u phá»‘i demo",
  },
  {
    id: "access-viewer-demo",
    email: "viewer@nurseflow.local",
    role: "viewer",
    displayName: "Theo dÃµi demo",
  },
];
