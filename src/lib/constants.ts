import type {
  AccessControlEntry,
  AssignmentStatus,
  LeaveReason,
  LeaveShift,
  Role,
  ScheduleRule,
  ShiftType,
} from "@/lib/types";

export const APP_NAME = "NurseFlow";

export const APP_TAGLINE =
  "Điều phối lịch làm việc của điều dưỡng theo tuần, cập nhật nghỉ phép và đồng bộ dữ liệu với Google Sheets.";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Quản trị",
  coordinator: "Điều phối",
  viewer: "Theo dõi",
};

export const SHIFT_LABELS: Record<ShiftType, string> = {
  morning: "Sáng",
  afternoon: "Chiều",
};

export const LEAVE_SHIFT_LABELS: Record<LeaveShift, string> = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  "full-day": "Cả ngày",
};

export const LEAVE_REASON_LABELS: Record<LeaveReason, string> = {
  phep: "Phép",
  om: "Ốm",
  khac: "Khác",
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  draft: "Dự thảo",
  adjusted: "Điều chỉnh",
  published: "Chính thức",
  "needs-review": "Cần rà soát",
};

export const WEEKDAY_LABELS = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
] as const;

export const DEFAULT_SCHEDULE_RULES: ScheduleRule[] = [
  { id: "slot-1-morning", dayOfWeek: 1, shift: "morning", active: true, label: "Sáng thứ 2" },
  { id: "slot-1-afternoon", dayOfWeek: 1, shift: "afternoon", active: true, label: "Chiều thứ 2" },
  { id: "slot-2-morning", dayOfWeek: 2, shift: "morning", active: true, label: "Sáng thứ 3" },
  { id: "slot-2-afternoon", dayOfWeek: 2, shift: "afternoon", active: true, label: "Chiều thứ 3" },
  { id: "slot-3-morning", dayOfWeek: 3, shift: "morning", active: true, label: "Sáng thứ 4" },
  { id: "slot-3-afternoon", dayOfWeek: 3, shift: "afternoon", active: true, label: "Chiều thứ 4" },
  { id: "slot-4-morning", dayOfWeek: 4, shift: "morning", active: true, label: "Sáng thứ 5" },
  { id: "slot-4-afternoon", dayOfWeek: 4, shift: "afternoon", active: true, label: "Chiều thứ 5" },
  { id: "slot-5-morning", dayOfWeek: 5, shift: "morning", active: true, label: "Sáng thứ 6" },
  { id: "slot-5-afternoon", dayOfWeek: 5, shift: "afternoon", active: true, label: "Chiều thứ 6" },
  { id: "slot-6-morning", dayOfWeek: 6, shift: "morning", active: true, label: "Sáng thứ 7" },
  { id: "slot-6-afternoon", dayOfWeek: 6, shift: "afternoon", active: false, label: "Chiều thứ 7" },
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
    displayName: "Điều phối demo",
  },
  {
    id: "access-viewer-demo",
    email: "viewer@nurseflow.local",
    role: "viewer",
    displayName: "Tài khoản xem demo",
  },
];
