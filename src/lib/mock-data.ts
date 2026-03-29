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
  {
    id: "staff-01",
    name: "Nguyễn Thị An",
    code: "DD01",
    email: "nguyenthia@benhvien.vn",
    role: "coordinator",
    positionIds: ["position-vitals", "position-consult"],
    active: true,
    prefersOvertime: true,
  },
  {
    id: "staff-02",
    name: "Trần Thị Bình",
    code: "DD02",
    email: "tranthib@benhvien.vn",
    role: "viewer",
    positionIds: ["position-ecg"],
    active: true,
    prefersOvertime: false,
  },
  {
    id: "staff-03",
    name: "Lê Thu Cúc",
    code: "DD03",
    email: "lethucuc@benhvien.vn",
    role: "viewer",
    positionIds: ["position-consult", "position-vitals"],
    active: true,
    prefersOvertime: true,
  },
  {
    id: "staff-04",
    name: "Phạm Diệu Hằng",
    code: "DD04",
    email: "phamdieuh@benhvien.vn",
    role: "viewer",
    positionIds: ["position-procedure"],
    active: true,
    prefersOvertime: false,
  },
  {
    id: "staff-05",
    name: "Hoàng Kim Liên",
    code: "DD05",
    email: "hoangkiml@benhvien.vn",
    role: "viewer",
    positionIds: ["position-admin"],
    active: true,
    prefersOvertime: true,
  },
  {
    id: "staff-06",
    name: "Đỗ Mai Phương",
    code: "DD06",
    email: "domaip@benhvien.vn",
    role: "viewer",
    positionIds: ["position-injection", "position-procedure"],
    active: true,
    prefersOvertime: true,
  },
  {
    id: "staff-07",
    name: "Vũ Nhã Uyên",
    code: "DD07",
    email: "vunhau@benhvien.vn",
    role: "viewer",
    positionIds: ["position-consult"],
    active: true,
    prefersOvertime: false,
  },
  {
    id: "staff-08",
    name: "Bùi Thanh Vân",
    code: "DD08",
    email: "buithanhv@benhvien.vn",
    role: "viewer",
    positionIds: ["position-vitals", "position-ecg"],
    active: true,
    prefersOvertime: true,
  },
];

const positions: Position[] = [
  { id: "position-vitals", name: "Đo sinh hiệu", area: "Tiếp nhận", description: "Đo mạch, nhiệt độ và huyết áp" },
  { id: "position-ecg", name: "Phòng ECG", area: "Cận lâm sàng", description: "Hỗ trợ điện tim" },
  { id: "position-injection", name: "Tiêm truyền", area: "Thủ thuật", description: "Theo dõi truyền dịch và tiêm thuốc" },
  { id: "position-consult", name: "Hỗ trợ khám", area: "Khám bệnh", description: "Điều phối người bệnh giữa các phòng khám" },
  { id: "position-procedure", name: "Thủ thuật", area: "Ngoại trú", description: "Chuẩn bị và hỗ trợ thủ thuật" },
  { id: "position-admin", name: "Hồ sơ - BHYT", area: "Hành chính", description: "Đối soát hồ sơ và giấy tờ" },
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
            ? "Ưu tiên điều dưỡng đã hoàn tất giao ban"
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
    note: "Nghỉ phép gia đình",
  },
];

export const MOCK_DATA: AppData = {
  staff,
  positions,
  scheduleRules,
  templateSchedule,
  weeklySchedule: [],
  leaveRequests,
  positionRules: [],
  accessControl: [
    {
      id: "access-01",
      email: "admin@benhvien.vn",
      role: "admin",
      displayName: "Quản trị viên",
    },
    {
      id: "access-02",
      email: "truong-ca@benhvien.vn",
      role: "coordinator",
      displayName: "Trưởng ca",
    },
    {
      id: "access-03",
      email: "xem-lich@benhvien.vn",
      role: "viewer",
      displayName: "Tài khoản xem lịch",
    },
  ],
};
