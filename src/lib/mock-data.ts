import { addDays, format, parseISO } from "date-fns";
import { DEFAULT_SCHEDULE_RULES } from "@/lib/constants";
import { getNextWeekStart, getWeekStart } from "@/lib/date";
import { buildAssignmentsFromTemplate } from "@/lib/schedule";
import type {
  AppData,
  LeaveRecord,
  Position,
  ScheduleRule,
  StaffMember,
  TemplateAssignment,
} from "@/lib/types";

const staff: StaffMember[] = [
  { id: "staff-01", name: "Nguyá»…n Thá»‹ An", code: "DD01", team: "Ná»™i tá»•ng quÃ¡t", active: true },
  { id: "staff-02", name: "Tráº§n Thá»‹ BÃ¬nh", code: "DD02", team: "Tim máº¡ch", active: true },
  { id: "staff-03", name: "LÃª Thu CÃºc", code: "DD03", team: "KhÃ¡m tá»•ng quÃ¡t", active: true },
  { id: "staff-04", name: "Pháº¡m Diá»‡u Háº±ng", code: "DD04", team: "Ná»™i soi", active: true },
  { id: "staff-05", name: "HoÃ ng Kim LiÃªn", code: "DD05", team: "Ngoáº¡i trÃº", active: true },
  { id: "staff-06", name: "Äá»— Mai PhÆ°Æ¡ng", code: "DD06", team: "Cáº¥p cá»©u", active: true },
  { id: "staff-07", name: "VÅ© NhÃ£ UyÃªn", code: "DD07", team: "KhÃ¡m dá»‹ch vá»¥", active: true },
  { id: "staff-08", name: "BÃ¹i Thanh VÃ¢n", code: "DD08", team: "KhÃ¡m tá»•ng quÃ¡t", active: true },
];

const positions: Position[] = [
  { id: "position-vitals", name: "Äo sinh hiá»‡u", area: "Tiáº¿p nháº­n", description: "Äo máº¡ch, nhiá»‡t Ä‘á»™, huyáº¿t Ã¡p" },
  { id: "position-ecg", name: "PhÃ²ng ECG", area: "Cáº­n lÃ¢m sÃ ng", description: "Há»— trá»£ Ä‘iá»‡n tim" },
  { id: "position-injection", name: "TiÃªm truyá»n", area: "Thá»§ thuáº­t", description: "Theo dÃµi truyá»n dá»‹ch vÃ  tiÃªm thuá»‘c" },
  { id: "position-consult", name: "Há»— trá»£ khÃ¡m", area: "KhÃ¡m bá»‡nh", description: "Äiá»u phá»‘i ngÆ°á»i bá»‡nh giá»¯a cÃ¡c phÃ²ng khÃ¡m" },
  { id: "position-procedure", name: "Thá»§ thuáº­t", area: "Ngoáº¡i trÃº", description: "Chuáº©n bá»‹ vÃ  há»— trá»£ thá»§ thuáº­t" },
  { id: "position-admin", name: "Há»“ sÆ¡ - BHYT", area: "HÃ nh chÃ­nh", description: "Äá»‘i soÃ¡t há»“ sÆ¡ vÃ  giáº¥y tá»" },
];

const scheduleRules: ScheduleRule[] = DEFAULT_SCHEDULE_RULES;

const activeRules = scheduleRules.filter((rule) => rule.active);

const templateSchedule: TemplateAssignment[] = activeRules.flatMap(
  ({ dayOfWeek, shift }, slotIndex) =>
    positions.map((position, positionIndex) => {
      const staffIndex = (slotIndex + positionIndex) % staff.length;
      return {
        id: `template-${dayOfWeek}-${shift}-${position.id}`,
        dayOfWeek,
        shift,
        positionId: position.id,
        staffId: staff[staffIndex].id,
        note:
          shift === "afternoon" && positionIndex === 0
            ? "Æ¯u tiÃªn nhÃ¢n sá»± Ä‘Ã£ hoÃ n táº¥t giao ban"
            : "",
      };
    }),
);

const leaveRequests: LeaveRecord[] = [
  {
    id: "leave-staff-03-next-mon",
    staffId: "staff-03",
    date: getNextWeekStart(),
    shift: "full-day",
    reason: "phep",
    note: "Nghá»‰ phÃ©p gia Ä‘Ã¬nh",
  },
  {
    id: "leave-staff-06-current-wed",
    staffId: "staff-06",
    date: format(addDays(parseISO(getWeekStart()), 2), "yyyy-MM-dd"),
    shift: "morning",
    reason: "om",
    note: "KhÃ¡m sá»©c khá»e",
  },
];

export const mockAppData: AppData = {
  staff,
  positions,
  scheduleRules,
  templateSchedule,
  weeklySchedule: [
    ...buildAssignmentsFromTemplate(
      templateSchedule,
      getWeekStart(),
      leaveRequests,
      scheduleRules,
    ),
    ...buildAssignmentsFromTemplate(
      templateSchedule,
      getNextWeekStart(),
      leaveRequests,
      scheduleRules,
    ),
  ].map((assignment, index) => ({
    ...assignment,
    status: index % 4 === 0 ? "published" : assignment.status,
  })),
  leaveRequests,
  accessControl: [
    {
      id: "access-01",
      email: "dieu-phoi@benhvien.vn",
      role: "admin",
      displayName: "Äiá»u phá»‘i trÆ°á»Ÿng",
    },
    {
      id: "access-02",
      email: "truong-ca@benhvien.vn",
      role: "coordinator",
      displayName: "TrÆ°á»Ÿng ca",
    },
    {
      id: "access-03",
      email: "xem-lich@benhvien.vn",
      role: "viewer",
      displayName: "TÃ i khoáº£n xem lá»‹ch",
    },
  ],
};
