import { addDays, compareAsc, differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import {
  DEFAULT_SCHEDULE_RULES,
  LEAVE_REASON_LABELS,
  SHIFT_LABELS,
  WEEKDAY_LABELS,
} from "@/lib/constants";
import { getMonthBounds, isOffDay } from "@/lib/date";
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
  Holiday,
  StaffExperienceSummary,
  StaffPositionExperience,
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

export function createLeaveConflictChecker(leaveRequests: LeaveRecord[]) {
  const map = new Map<string, LeaveRecord[]>();
  for (const l of leaveRequests) {
    const key = `${l.staffId}-${l.date}`;
    let list = map.get(key);
    if (!list) {
      list = [];
      map.set(key, list);
    }
    list.push(l);
  }
  return {
    check: (staffId: string, date: string, shift: ShiftType) => {
      const list = map.get(`${staffId}-${date}`);
      if (!list) return undefined;
      return list.find((l) => l.shift === "full-day" || l.shift === shift);
    },
  };
}

export function createClosedPositionChecker(positionRules: PositionRule[]) {
  const closedSet = new Set<string>();
  for (const r of positionRules) {
    if (!r.active) {
      closedSet.add(`${r.dayOfWeek}-${r.shift}-${r.positionId}`);
    }
  }
  return {
    isClosed: (dayOfWeek: number | string, shift: string, positionId: string) => {
      return closedSet.has(`${dayOfWeek}-${shift}-${positionId}`);
    },
  };
}

export function buildAssignmentsFromTemplate(
  templateSchedule: TemplateAssignment[],
  positions: Position[],
  weekStart: string,
  leaveRequests: LeaveRecord[],
  scheduleRules: ScheduleRule[],
  positionRules: PositionRule[] = [],
  holidays: Holiday[] = [],
) {
  const weekStartDate = parseISO(weekStart);

  const closedPositionChecker = createClosedPositionChecker(positionRules);
  const leaveChecker = createLeaveConflictChecker(leaveRequests);

  const allowedSlots = new Set(
    getActiveScheduleRules(scheduleRules).map(
      (rule) => `${rule.dayOfWeek}-${rule.shift}`,
    ),
  );

  return sortAssignments(
    templateSchedule
      .filter((assignment) => assignment.dayOfWeek !== 6)
      .filter((assignment) =>
        allowedSlots.has(`${assignment.dayOfWeek}-${assignment.shift}`),
      )
      .filter((assignment) => !closedPositionChecker.isClosed(assignment.dayOfWeek, assignment.shift, assignment.positionId))
      .map((assignment) => {
        const date = format(
          addDays(weekStartDate, assignment.dayOfWeek - 1),
          "yyyy-MM-dd",
        );

        const isDayOff = isOffDay(date, assignment.shift, holidays);
        if (isDayOff) return null; // Không sinh assignment cho ngày nghỉ mặc định

        const leave = leaveChecker.check(
          assignment.staffId,
          date,
          assignment.shift,
        );

        // Ngoại lệ: Đi học + vị trí KHNV → không coi là xung đột
        const positionName = positions.find((p) => p.id === assignment.positionId)?.name ?? "";
        const isExempt = leave?.reason === "dihoc" && positionName.toUpperCase().includes("KHNV");
        const effectiveLeave = isExempt ? undefined : leave;

        return {
          id: `preview-${weekStart}-${assignment.shift}-${assignment.positionId}-${assignment.staffId}-${assignment.dayOfWeek}-${assignment.slotIndex || 0}`,
          weekStart,
          date,
          shift: assignment.shift,
          positionId: assignment.positionId,
          staffId: effectiveLeave ? "" : assignment.staffId, // Nếu nghỉ thì để trống ID nhân sự
          slotIndex: assignment.slotIndex,
          source: "template" as const,
          status: effectiveLeave ? ("needs-review" as const) : ("published" as const),
          note: effectiveLeave
            ? `Trống: Trùng lịch nghỉ ${LEAVE_REASON_LABELS[effectiveLeave.reason].toLowerCase()}`
            : assignment.note ?? "",
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null),
  );
}

interface RecentHabitStats {
  slotWeightMap: Map<string, number>;
  positionWeightMap: Map<string, number>;
}

/**
 * Tính thói quen phân công trong 1–2 tuần gần nhất (14 ngày trước anchorDate).
 * Tuần t-1 (7 ngày gần nhất) nhận trọng số 2, tuần t-2 nhận trọng số 1.
 */
export function buildRecentHabitStats(
  weeklySchedule: WeeklyAssignment[],
  anchorDate: string,
): RecentHabitStats {
  const anchor = parseISO(anchorDate);
  const twoWeeksAgoStr = format(subDays(anchor, 14), "yyyy-MM-dd");
  const oneWeekAgoStr = format(subDays(anchor, 7), "yyyy-MM-dd");

  const slotWeightMap = new Map<string, number>();
  const positionWeightMap = new Map<string, number>();

  for (const item of weeklySchedule) {
    if (!item.staffId || !item.date) continue;
    if (item.date >= anchorDate || item.date < twoWeeksAgoStr) continue;

    let dayOfWeek = 0;
    try {
      const parsed = parseISO(item.date);
      dayOfWeek = parsed.getDay();
    } catch {
      continue;
    }

    const weight = item.date >= oneWeekAgoStr ? 2 : 1;
    const slotKey = `${dayOfWeek}_${item.shift}_${item.positionId}_${item.staffId}`;
    slotWeightMap.set(slotKey, (slotWeightMap.get(slotKey) ?? 0) + weight);

    const posKey = `${item.positionId}_${item.staffId}`;
    positionWeightMap.set(posKey, (positionWeightMap.get(posKey) ?? 0) + weight);
  }

  return { slotWeightMap, positionWeightMap };
}

/**
 * Xây bảng tra số giờ kinh nghiệm tích lũy (4/n giờ) trước mốc beforeDate.
 */
export function buildExperienceHoursLookup(
  weeklySchedule: WeeklyAssignment[],
  staff: StaffMember[],
  positions: Position[],
  beforeDate?: string,
): Map<string, Map<string, number>> {
  const historical = beforeDate
    ? weeklySchedule.filter((a) => a.staffId && a.date && a.date < beforeDate)
    : weeklySchedule.filter((a) => a.staffId);

  const stats = calculatePositionExperienceStats(historical, staff, positions);
  const lookup = new Map<string, Map<string, number>>();

  for (const row of stats) {
    const posHours = new Map<string, number>();
    for (const [posId, exp] of Object.entries(row.positions)) {
      posHours.set(posId, exp.hours);
    }
    lookup.set(row.staffId, posHours);
  }

  return lookup;
}

function isTiepNhanPosition(pos: Position): boolean {
  return pos.name.toLowerCase().includes("tiếp nhận");
}

function isKhnvPosition(pos: Position): boolean {
  const name = pos.name.toLowerCase();
  const area = (pos.area || "").toLowerCase();
  return name.includes("khnv") || area.includes("khnv");
}

function isKskRecordPosition(pos: Position): boolean {
  const name = pos.name.toLowerCase();
  return name.includes("nhập liệu") || (name.includes("hồ sơ") && name.includes("ksk"));
}

function isVitalsPosition(pos: Position): boolean {
  return pos.name.toLowerCase().includes("sinh hiệu") || pos.id.toLowerCase().includes("vitals");
}

function isTuTrangStaff(member: StaffMember): boolean {
  return member.name.toLowerCase().includes("tú trang");
}

function isThinhStaff(member: StaffMember): boolean {
  const lower = member.name.toLowerCase();
  return lower.includes("phú thịnh") || lower.endsWith(" thịnh");
}

function isNghiaStaff(member: StaffMember): boolean {
  return (
    member.email?.toLowerCase().trim() === "nghiadn.pk@pnt.edu.vn" ||
    member.name.toLowerCase().includes("nhân nghĩa")
  );
}

function isThienTrangStaff(member: StaffMember): boolean {
  return member.name.toLowerCase().includes("thiên trang");
}

function isPhucAnhStaff(member: StaffMember): boolean {
  return member.name.toLowerCase().includes("phúc anh");
}

function isLynaStaff(member: StaffMember): boolean {
  return member.name.toLowerCase().includes("lyna");
}

function isThuyStaff(member: StaffMember): boolean {
  return member.name.toLowerCase().includes("thanh thủy") || member.name.toLowerCase().endsWith(" thủy");
}

function isChamSocDaPosition(pos: Position): boolean {
  return pos.id === "position-phong-cham-soc-da" || pos.name.toLowerCase().includes("chăm sóc da");
}

function isDaLieuPosition(pos: Position): boolean {
  return pos.id === "position-phong-kham-da-lieu" || pos.name.toLowerCase().includes("da liễu");
}

function isDermatologyPairPosition(pos: Position): boolean {
  return isChamSocDaPosition(pos) || isDaLieuPosition(pos);
}

function isMyNhienStaff(member: StaffMember): boolean {
  return member.name.toLowerCase().includes("mỹ nhiên");
}

function isSieuAmPosition(pos: Position): boolean {
  return pos.id === "position-phong-sieu-am" || pos.name.toLowerCase().includes("siêu âm");
}

function isChuyenGiaPosition(pos: Position): boolean {
  return pos.id === "position-phong-kham-chuyen-gia" || pos.name.toLowerCase().includes("chuyên gia");
}

function isBichThaoStaff(member: StaffMember): boolean {
  return member.name.toLowerCase().includes("bích thảo");
}

function isKimHoaStaff(member: StaffMember): boolean {
  return member.name.toLowerCase().includes("kim hoa");
}

function isThanhTrungPosition(pos: Position): boolean {
  return pos.id === "position-thanh-trung" || pos.name.toLowerCase().includes("thanh trùng");
}

function isYhctPosition(pos: Position): boolean {
  return pos.id === "position-yhct" || pos.name.toLowerCase().includes("yhct");
}

function isNhanPrimaryPosition(pos: Position): boolean {
  return isThanhTrungPosition(pos) || isYhctPosition(pos);
}

function isNhanStaff(member: StaffMember): boolean {
  const code = (member.code || "").trim().toUpperCase();
  const lastWord = member.name.trim().split(/\s+/).pop()?.toLowerCase() || "";
  const lower = member.name.toLowerCase();
  return code === "DD16" || lastWord === "nhân" || lower.includes("lê thị nhân");
}

function isDiepStaff(member: StaffMember): boolean {
  const code = (member.code || "").trim().toUpperCase();
  const lower = member.name.toLowerCase();
  return code === "DD07" || lower.includes("ngọc điệp") || lower.endsWith(" điệp");
}

export function isExcludedSchedulePosition(pos: Position): boolean {
  return pos.id === "position-phong-kham-rhm" || pos.name.toLowerCase().includes("rhm");
}

export function isLowVolumePosition(pos: Position): boolean {
  const name = pos.name.toLowerCase();
  return (
    pos.id === "position-phong-kham-ngoai" ||
    name.includes("khám ngoại") ||
    isChuyenGiaPosition(pos) ||
    pos.id === "pos-1775185718350-um0fc" ||
    name.includes("miễn dịch") ||
    name.includes("dị ứng") ||
    pos.id === "position-noi-than-kinh" ||
    name.includes("nội thần kinh") ||
    pos.id === "position-phong-kham-phu-san" ||
    name.includes("phụ - sản") ||
    name.includes("phụ sản") ||
    name.includes("phụ khoa")
  );
}

function isNgocHanhStaff(member: StaffMember): boolean {
  const code = (member.code || "").trim().toUpperCase();
  const lower = member.name.toLowerCase();
  return code === "DD02" || lower.includes("ngọc hạnh");
}

function isNgaStaff(member: StaffMember): boolean {
  const code = (member.code || "").trim().toUpperCase();
  const lastWord = member.name.trim().split(/\s+/).pop()?.toLowerCase() || "";
  const lower = member.name.toLowerCase();
  return code === "DD04" || lower.includes("phương nga") || lastWord === "nga";
}

function isVinhStaff(member: StaffMember): boolean {
  const code = (member.code || "").trim().toUpperCase();
  const lastWord = member.name.trim().split(/\s+/).pop()?.toLowerCase() || "";
  const lower = member.name.toLowerCase();
  return code === "DD05" || lower.includes("thị vĩnh") || lastWord === "vĩnh";
}

function isNgocHanhPrimaryPosition(pos: Position): boolean {
  const name = pos.name.toLowerCase();
  return (
    pos.id === "position-phong-cap-cuu" ||
    name.includes("cấp cứu") ||
    pos.id === "position-phong-o-ecg" ||
    name.includes("ecg")
  );
}

function isNgaPrimaryPosition(pos: Position): boolean {
  const name = pos.name.toLowerCase();
  return (
    pos.id === "position-phong-kham-ctch" ||
    name.includes("ctch") ||
    pos.id === "position-phong-kham-noi-1" ||
    name.includes("nội 1")
  );
}

function isVinhPrimaryPosition(pos: Position): boolean {
  const name = pos.name.toLowerCase();
  return (
    pos.id === "position-phong-kham-phu-san" ||
    name.includes("phụ - sản") ||
    name.includes("phụ sản") ||
    pos.id === "position-phong-kham-ngoai" ||
    name.includes("khám ngoại") ||
    pos.id === "position-phong-kham-noi-2" ||
    name.includes("nội 2")
  );
}

function isChuyenStaff(member: StaffMember): boolean {
  const code = (member.code || "").trim().toUpperCase();
  const lastWord = member.name.trim().split(/\s+/).pop()?.toLowerCase() || "";
  const lower = member.name.toLowerCase();
  return code === "DD08" || lower.includes("kim chuyền") || lastWord === "chuyền";
}

function isAiLienStaff(member: StaffMember): boolean {
  const code = (member.code || "").trim().toUpperCase();
  const lower = member.name.toLowerCase();
  return code === "DD12" || lower.includes("ái liên") || lower.includes("ai lien");
}

function isTtkPosition(pos: Position): boolean {
  const name = pos.name.toLowerCase();
  return pos.id === "position-phong-kham-ttk" || name.includes("tâm thần") || name.includes("tâm lý");
}

function isMatPosition(pos: Position): boolean {
  const name = pos.name.toLowerCase();
  return pos.id === "position-phong-kham-mat" || name.includes("khám mắt");
}

function isTmhPosition(pos: Position): boolean {
  const name = pos.name.toLowerCase();
  return pos.id === "position-phong-kham-tmh" || name.includes("tmh");
}

interface FixedRoomStaffRule {
  label: string;
  matchPosition: (pos: Position) => boolean;
  matchPrimaryStaff: (member: StaffMember) => boolean;
  matchBackupStaff?: (member: StaffMember) => boolean;
  backupBoost?: number;
  backupOnlyWhenPrimaryAbsent?: boolean;
  primaryAbsentPenalty?: number;
}

const FIXED_ROOM_STAFF_RULES: FixedRoomStaffRule[] = [
  {
    label: "cặp Da liễu & CSD",
    matchPosition: isDermatologyPairPosition,
    matchPrimaryStaff: isMyNhienStaff,
    primaryAbsentPenalty: -2000,
  },
  {
    label: "Siêu âm",
    matchPosition: isSieuAmPosition,
    matchPrimaryStaff: isBichThaoStaff,
    matchBackupStaff: isLynaStaff,
    backupBoost: 1800,
    backupOnlyWhenPrimaryAbsent: false,
  },
  {
    label: "Chuyên gia",
    matchPosition: isChuyenGiaPosition,
    matchPrimaryStaff: isKimHoaStaff,
    primaryAbsentPenalty: -1500,
  },
  {
    label: "Thanh Trùng / YHCT",
    matchPosition: isNhanPrimaryPosition,
    matchPrimaryStaff: isNhanStaff,
    matchBackupStaff: isDiepStaff,
    backupBoost: 3500,
    backupOnlyWhenPrimaryAbsent: true,
    primaryAbsentPenalty: -2000,
  },
  {
    label: "Cấp cứu / ECG",
    matchPosition: isNgocHanhPrimaryPosition,
    matchPrimaryStaff: isNgocHanhStaff,
    primaryAbsentPenalty: -2000,
  },
  {
    label: "CTCH / Nội 1",
    matchPosition: isNgaPrimaryPosition,
    matchPrimaryStaff: isNgaStaff,
    primaryAbsentPenalty: -2000,
  },
  {
    label: "Phụ - Sản / Ngoại / Nội 2",
    matchPosition: isVinhPrimaryPosition,
    matchPrimaryStaff: isVinhStaff,
    primaryAbsentPenalty: -2000,
  },
];

interface SpecialtyPoolRule {
  label: string;
  matchPosition: (pos: Position) => boolean;
  priorityMatchers: ((member: StaffMember) => boolean)[];
}

const SPECIALTY_POOL_RULES: SpecialtyPoolRule[] = [
  {
    label: "Phòng khám Tâm thần kinh - Tâm lý",
    matchPosition: isTtkPosition,
    priorityMatchers: [isDiepStaff, isThuyStaff, isAiLienStaff, isChuyenStaff],
  },
  {
    label: "Phòng khám Mắt",
    matchPosition: isMatPosition,
    priorityMatchers: [isChuyenStaff, isThuyStaff, isAiLienStaff],
  },
  {
    label: "Da liễu / CSD (dự phòng)",
    matchPosition: isDermatologyPairPosition,
    priorityMatchers: [isMyNhienStaff, isAiLienStaff, isThuyStaff],
  },
  {
    label: "Phòng khám TMH",
    matchPosition: isTmhPosition,
    priorityMatchers: [isDiepStaff, isAiLienStaff, isThuyStaff, isChuyenStaff],
  },
];

function findSpecialtyPoolRank(rule: SpecialtyPoolRule, member: StaffMember): number {
  return rule.priorityMatchers.findIndex((m) => m(member));
}

function isTiepNhanRotationStaff(member: StaffMember): boolean {
  return isPhucAnhStaff(member) || isLynaStaff(member) || isThuyStaff(member);
}

function isAlwaysOpenOperationalPosition(pos: Position): boolean {
  const name = pos.name.toLowerCase();
  return (
    isTiepNhanPosition(pos) ||
    isVitalsPosition(pos) ||
    isSieuAmPosition(pos) ||
    pos.id === "position-phong-cap-cuu" ||
    name.includes("cấp cứu") ||
    pos.id === "position-phong-o-ecg" ||
    name.includes("ecg")
  );
}

/**
 * Chỉ các nhân sự điều dưỡng đang hoạt động và có vị trí chuyên môn mới được phân công ca trực.
 * Loại trừ Bác sĩ / Admin quản trị không trực điều dưỡng (vd: code "BS", "ADMIN" hoặc positionIds rỗng).
 */
export function isAssignableNursingStaff(member: StaffMember): boolean {
  if (!member.active) return false;
  const code = (member.code || "").trim().toUpperCase();
  if (code === "BS" || code === "ADMIN") return false;
  if (!member.positionIds || member.positionIds.length === 0) return false;
  return true;
}

export interface SmartWeeklyBuildParams {
  templateSchedule: TemplateAssignment[];
  positions: Position[];
  staff: StaffMember[];
  weeklySchedule: WeeklyAssignment[];
  weekStart: string;
  leaveRequests: LeaveRecord[];
  scheduleRules: ScheduleRule[];
  positionRules?: PositionRule[];
  holidays?: Holiday[];
  initialStatus?: WeeklyAssignment["status"];
  forceOpenPositionSlots?: Set<string>;
}

/**
 * Sinh lịch tuần mới dựa trên kinh nghiệm tích lũy (4/n giờ), thói quen 1–2 tuần gần đây
 * và các ràng buộc điều phối phòng khám (Tiếp nhận 2 người, KSK/KHNV cố định, giải phóng quá tải).
 */
export function buildSmartWeeklyAssignments({
  templateSchedule,
  positions,
  staff,
  weeklySchedule,
  weekStart,
  leaveRequests,
  scheduleRules,
  positionRules = [],
  holidays = [],
  initialStatus = "draft",
  forceOpenPositionSlots,
}: SmartWeeklyBuildParams): WeeklyAssignment[] {
  const weekStartDate = parseISO(weekStart);
  const closedPositionChecker = createClosedPositionChecker(positionRules);
  const leaveChecker = createLeaveConflictChecker(leaveRequests);
  const habitStats = buildRecentHabitStats(weeklySchedule, weekStart);
  const expLookup = buildExperienceHoursLookup(weeklySchedule, staff, positions, weekStart);

  const activeStaff = staff.filter(isAssignableNursingStaff);
  const staffMap = new Map(activeStaff.map((s) => [s.id, s]));
  const posMap = new Map(positions.map((p) => [p.id, p]));

  const allowedSlots = getActiveScheduleRules(scheduleRules).filter(
    (rule) => rule.dayOfWeek >= 1 && rule.dayOfWeek <= 5,
  );

  // Đếm tổng số ca đã gán trong tuần đang sinh để cân bằng tải nhẹ và xoay Tiếp nhận
  const weeklyAssignedCount = new Map<string, number>();
  const tiepNhanAssignedCount = new Map<string, number>();
  const generated: WeeklyAssignment[] = [];

  for (const rule of allowedSlots) {
    const date = format(addDays(weekStartDate, rule.dayOfWeek - 1), "yyyy-MM-dd");
    if (isOffDay(date, rule.shift, holidays)) continue;

    // Xác định các vị trí mở trong ca này
    const templateInSlot = templateSchedule.filter(
      (t) =>
        t.dayOfWeek === rule.dayOfWeek &&
        t.shift === rule.shift &&
        !closedPositionChecker.isClosed(rule.dayOfWeek, rule.shift, t.positionId),
    );

    const openPositions = positions.filter(
      (pos) =>
        !isExcludedSchedulePosition(pos) &&
        !closedPositionChecker.isClosed(rule.dayOfWeek, rule.shift, pos.id),
    );

    // Xác định số slot cần xếp cho từng vị trí trong ca
    const positionTargets: { position: Position; slotCount: number; templateStaffIds: string[] }[] = [];
    for (const pos of openPositions) {
      const tEntries = templateInSlot
        .filter((t) => t.positionId === pos.id)
        .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

      const isForceOpen = Boolean(forceOpenPositionSlots?.has(`${rule.dayOfWeek}-${rule.shift}-${pos.id}`));
      if (templateSchedule.length > 0 && tEntries.length === 0 && !isAlwaysOpenOperationalPosition(pos) && !isForceOpen) {
        continue;
      }

      let slotCount = tEntries.length > 0 ? tEntries.length : (pos.quota || 1);
      if (isTiepNhanPosition(pos)) {
        slotCount = 2; // Quy tắc vàng: Tiếp nhận đúng 2 người/ca
      } else if (isVitalsPosition(pos)) {
        slotCount = Math.max(2, pos.quota || 2, tEntries.length);
      }

      positionTargets.push({
        position: pos,
        slotCount,
        templateStaffIds: tEntries.map((t) => t.staffId).filter(Boolean),
      });
    }

    // Sắp xếp thứ tự ưu tiên phân bổ trong ca: KHNV -> KSK -> Tiếp nhận -> Các phòng cố định -> Chuyên khoa chung -> Đo sinh hiệu
    positionTargets.sort((a, b) => {
      const rank = (pos: Position) => {
        if (isKhnvPosition(pos)) return 0;
        if (isKskRecordPosition(pos)) return 1;
        if (isTiepNhanPosition(pos)) return 2;
        if (FIXED_ROOM_STAFF_RULES.some((r) => r.matchPosition(pos))) return 3;
        if (isVitalsPosition(pos)) return 5;
        return 4;
      };
      const ra = rank(a.position);
      const rb = rank(b.position);
      if (ra !== rb) return ra - rb;

      // Trong nhóm chuyên khoa: vị trí ít người biết làm xếp trước
      const eligibleA = activeStaff.filter((s) => s.positionIds.includes(a.position.id)).length;
      const eligibleB = activeStaff.filter((s) => s.positionIds.includes(b.position.id)).length;
      return eligibleA - eligibleB;
    });

    // Theo dõi phân công trong ca hiện tại
    const shiftAssignedByStaff = new Map<string, string[]>();
    const shiftRecords: WeeklyAssignment[] = [];

    const isLeaveBlocked = (member: StaffMember, pos: Position) => {
      const conflict = leaveChecker.check(member.id, date, rule.shift);
      if (!conflict) return false;
      // Ngoại lệ: Đi học + vị trí KHNV không coi là xung đột
      if (conflict.reason === "dihoc" && isKhnvPosition(pos)) return false;
      return true;
    };

    for (const target of positionTargets) {
      const { position, slotCount, templateStaffIds } = target;
      const pickedInThisPosition = new Set<string>();

      for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
        const candidates = activeStaff.filter((member) => {
          if (pickedInThisPosition.has(member.id)) return false;
          if (isLeaveBlocked(member, position)) return false;

          // Tú Trang chỉ làm hành chính tại KHNV
          if (isTuTrangStaff(member) && !isKhnvPosition(position)) return false;

          // Nghĩa và Thiên Trang làm toàn thời gian tại KHNV (chỉ ra Đo sinh hiệu ở bước giải phóng quá tải)
          if ((isNghiaStaff(member) || isThienTrangStaff(member)) && !isKhnvPosition(position)) {
            return false;
          }

          // Thịnh cố định làm hồ sơ KSK thời vụ; chỉ cho phép sang phòng khác nếu vị trí đó là KSK
          if (isThinhStaff(member) && !isKskRecordPosition(position)) {
            return false;
          }

          return true;
        });

        const templateCandidateId = templateStaffIds[slotIndex] || "";
        const partnerDermAssignment = isDermatologyPairPosition(position)
          ? shiftRecords.find((r) => {
              if (!r.staffId || r.positionId === position.id) return false;
              const p = posMap.get(r.positionId);
              return Boolean(p && isDermatologyPairPosition(p));
            })
          : undefined;
        const partnerDermPos = isDermatologyPairPosition(position)
          ? positionTargets.find((t) => t.position.id !== position.id && isDermatologyPairPosition(t.position))?.position
          : undefined;

        const scored = candidates.map((member) => {
          let score = 0;
          const currentPosList = shiftAssignedByStaff.get(member.id) ?? [];
          const effectiveLoad = currentPosList.reduce((sum, pid) => {
            const p = posMap.get(pid);
            return sum + (p && isLowVolumePosition(p) ? 0.5 : 1);
          }, 0);
          const isTargetLowVolume = isLowVolumePosition(position);

          // 1. Ưu tiên người đang rảnh; phòng ít bệnh (Ngoại, Chuyên gia, Miễn dịch, Nội TK, Phụ khoa) chỉ tính 0.5 tải để dễ kiêm nhiệm
          if (currentPosList.length === 0) {
            score += 1000;
          } else {
            const penaltyPerLoad = isTargetLowVolume ? 200 : 350;
            score -= effectiveLoad * penaltyPerLoad;
            if (currentPosList.length >= 3) {
              score -= isTargetLowVolume ? 250 : 600;
            }
          }

          // 2. Thói quen 1-2 tuần gần đây
          const slotHabit =
            habitStats.slotWeightMap.get(`${rule.dayOfWeek}_${rule.shift}_${position.id}_${member.id}`) ?? 0;
          const posHabit = habitStats.positionWeightMap.get(`${position.id}_${member.id}`) ?? 0;
          score += Math.min(slotHabit, 3) * 140; // tối đa +420 nếu đúng thứ/ca/vị trí 2 tuần liền
          score += Math.min(posHabit, 12) * 24; // tối đa +288 theo tần suất 2 tuần gần đây

          // 3. Kinh nghiệm tích lũy (4/n giờ)
          const expHours = expLookup.get(member.id)?.get(position.id) ?? 0;
          score += Math.min(expHours, 120) * 2.5; // tối đa +300

          // 4. Khớp lịch nền & cấu hình vị trí
          if (templateCandidateId === member.id) {
            score += 80;
          } else if (templateStaffIds.includes(member.id)) {
            score += 45;
          }
          const orderIdx = (position.staffOrder || []).indexOf(member.id);
          if (orderIdx !== -1) {
            score += Math.max(10, 70 - orderIdx * 7);
          }
          if (member.positionIds.includes(position.id)) {
            score += 55;
          }

          // 5. Quy tắc đặc biệt Tiếp nhận: xoay đều 3 người (Lyna, Phúc Anh, Thủy), giữ đúng 2 người/ca
          if (isTiepNhanPosition(position)) {
            if (isTiepNhanRotationStaff(member)) {
              const tnCount = tiepNhanAssignedCount.get(member.id) ?? 0;
              score += 8000 - tnCount * 400;
            } else if (candidates.some((c) => isTiepNhanRotationStaff(c))) {
              score -= 2000;
            }
          }

          // 5b. Quy tắc cặp Chăm sóc da (P2.4) & Da liễu (P2.6):
          // Mặc nhiên là Mỹ Nhiên; khi Nhiên nghỉ phải phân người hỗ trợ đi đồng bộ CÙNG 1 điều dưỡng (ưu tiên Ái Liên, Thủy).
          if (isDermatologyPairPosition(position)) {
            if (partnerDermAssignment) {
              if (member.id === partnerDermAssignment.staffId) {
                score += 6000;
              } else if (candidates.some((c) => c.id === partnerDermAssignment.staffId)) {
                score -= 3000;
              }
            } else {
              if (isMyNhienStaff(member)) {
                score += 5000;
              } else if (candidates.some((c) => isMyNhienStaff(c))) {
                score -= 2000;
              } else {
                const dermPoolRule = SPECIALTY_POOL_RULES.find((r) => r.matchPosition(position));
                const poolIdx = dermPoolRule ? findSpecialtyPoolRank(dermPoolRule, member) : -1;
                if (poolIdx !== -1) {
                  score += Math.max(1200, 4200 - poolIdx * 1000);
                }
                if (partnerDermPos) {
                  // Cộng điểm phù hợp cho phòng cặp còn lại để người thay thế Nhiên phù hợp cả 2 phòng
                  const pExp = expLookup.get(member.id)?.get(partnerDermPos.id) ?? 0;
                  const pHabit = habitStats.positionWeightMap.get(`${partnerDermPos.id}_${member.id}`) ?? 0;
                  const pMatch = member.positionIds.includes(partnerDermPos.id) ? 55 : 0;
                  score += Math.min(pExp, 120) * 1.5 + Math.min(pHabit, 12) * 15 + pMatch;
                }
              }
            }
          } else {
            // 5c. Bảng quy tắc điều dưỡng thường trực cố định theo phòng
            for (const fixedRule of FIXED_ROOM_STAFF_RULES) {
              if (!fixedRule.matchPosition(position)) continue;
              const primaryAvailable = candidates.some((c) => fixedRule.matchPrimaryStaff(c));
              if (fixedRule.matchPrimaryStaff(member)) {
                score += 5000;
              } else if (primaryAvailable && fixedRule.primaryAbsentPenalty) {
                score += fixedRule.primaryAbsentPenalty;
              } else if (
                fixedRule.matchBackupStaff?.(member) &&
                (!fixedRule.backupOnlyWhenPrimaryAbsent || !primaryAvailable)
              ) {
                score += fixedRule.backupBoost ?? 1800;
              }
            }

            // 5d. Bảng thứ tự ưu tiên theo phòng (người #1 mặc nhiên; #2, #3, #4 là thứ tự ưu tiên khi cần người thay thế)
            for (const poolRule of SPECIALTY_POOL_RULES) {
              if (!poolRule.matchPosition(position)) continue;
              const poolHasAvailable = candidates.some((c) => findSpecialtyPoolRank(poolRule, c) !== -1);
              if (!poolHasAvailable) continue;
              const rankIdx = findSpecialtyPoolRank(poolRule, member);
              const priorityTiers = [4800, 3600, 2600, 1800];
              if (rankIdx !== -1) {
                score += priorityTiers[rankIdx] ?? Math.max(800, 1800 - (rankIdx - 3) * 400);
              } else {
                score -= 1500;
              }
            }
          }

          // 6. Cân bằng nhẹ số ca trong tuần
          score -= (weeklyAssignedCount.get(member.id) ?? 0) * 4;

          return { member, score, expHours, posHabit };
        });

        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];

        if (best) {
          pickedInThisPosition.add(best.member.id);
          const list = shiftAssignedByStaff.get(best.member.id) ?? [];
          list.push(position.id);
          shiftAssignedByStaff.set(best.member.id, list);
          weeklyAssignedCount.set(best.member.id, (weeklyAssignedCount.get(best.member.id) ?? 0) + 1);
          if (isTiepNhanPosition(position)) {
            tiepNhanAssignedCount.set(best.member.id, (tiepNhanAssignedCount.get(best.member.id) ?? 0) + 1);
          }

          let note = "";
          if (templateCandidateId && templateCandidateId !== best.member.id) {
            if (best.expHours > 0 || best.posHabit > 0) {
              note = `Tự động xếp theo kinh nghiệm (${best.expHours}h) & thói quen gần đây`;
            }
          }

          shiftRecords.push({
            id: `smart-${weekStart}-${rule.shift}-${position.id}-${rule.dayOfWeek}-${slotIndex}`,
            weekStart,
            date,
            shift: rule.shift,
            positionId: position.id,
            staffId: best.member.id,
            slotIndex,
            source: "template",
            status: initialStatus,
            note,
          });
        } else {
          shiftRecords.push({
            id: `smart-${weekStart}-${rule.shift}-${position.id}-${rule.dayOfWeek}-${slotIndex}`,
            weekStart,
            date,
            shift: rule.shift,
            positionId: position.id,
            staffId: "",
            slotIndex,
            source: "template",
            status: "needs-review",
            note: "Trống: Không đủ nhân sự khả dụng trong ca",
          });
        }
      }
    }

    // Hậu kiểm quá tải (>= 4 vị trí/ca): kích hoạt chuỗi KHNV -> Đo sinh hiệu -> chi viện phòng quá tải
    const vitalsPos = openPositions.find((p) => isVitalsPosition(p));
    if (vitalsPos) {
      const staffSlotMap = new Map<string, WeeklyAssignment[]>();
      for (const rec of shiftRecords) {
        if (!rec.staffId) continue;
        const list = staffSlotMap.get(rec.staffId) ?? [];
        list.push(rec);
        staffSlotMap.set(rec.staffId, list);
      }

      for (const [overloadedId, recs] of staffSlotMap.entries()) {
        if (recs.length < 4) continue;

        const reliefRec = [...recs].reverse().find((r) => {
          const pos = posMap.get(r.positionId);
          const staffObj = staffMap.get(overloadedId);
          if (!pos) return false;
          if (staffObj && FIXED_ROOM_STAFF_RULES.some((ruleDef) => ruleDef.matchPosition(pos) && ruleDef.matchPrimaryStaff(staffObj))) {
            return false;
          }
          if (
            isDermatologyPairPosition(pos) &&
            recs.filter((other) => {
              const otherPos = posMap.get(other.positionId);
              return Boolean(otherPos && isDermatologyPairPosition(otherPos));
            }).length >= 2
          ) {
            return false;
          }
          return !isTiepNhanPosition(pos) && !isKhnvPosition(pos) && !isKskRecordPosition(pos) && !isVitalsPosition(pos);
        });
        if (!reliefRec) continue;

        const vitalsRecs = shiftRecords.filter((r) => r.positionId === vitalsPos.id && r.staffId && r.staffId !== overloadedId);
        if (vitalsRecs.length === 0) continue;

        // Chọn người Đo sinh hiệu quen thuộc nhất với vị trí quá tải theo giờ kinh nghiệm tích lũy + thói quen 2 tuần
        let bestVitalsRec = vitalsRecs[0];
        let bestFamiliarity = -1;
        for (const vRec of vitalsRecs) {
          const vStaff = staffMap.get(vRec.staffId);
          if (!vStaff) continue;
          const vExp = expLookup.get(vStaff.id)?.get(reliefRec.positionId) ?? 0;
          const vHabit = habitStats.positionWeightMap.get(`${reliefRec.positionId}_${vStaff.id}`) ?? 0;
          const vPosMatch = vStaff.positionIds.includes(reliefRec.positionId) ? 5 : 0;
          const familiarity = vExp * 2 + vHabit * 10 + vPosMatch;
          if (familiarity > bestFamiliarity) {
            bestFamiliarity = familiarity;
            bestVitalsRec = vRec;
          }
        }

        // Tìm nhân sự KHNV rảnh để trám vào Đo sinh hiệu: ưu tiên Nghĩa (nếu không nghỉ phép/đi học), sau đó Thiên Trang
        const nghia = activeStaff.find((s) => isNghiaStaff(s));
        const thienTrang = activeStaff.find((s) => isThienTrangStaff(s));
        const isAvailableForVitalsRelief = (member?: StaffMember) => {
          if (!member) return false;
          // Kiểm tra đơn nghỉ thực tế (bao gồm nghỉ phép lẫn đi học)
          return !leaveChecker.check(member.id, date, rule.shift);
        };

        const khnvBackup = isAvailableForVitalsRelief(nghia)
          ? nghia
          : isAvailableForVitalsRelief(thienTrang)
            ? thienTrang
            : undefined;

        if (khnvBackup) {
          const transferredId = bestVitalsRec.staffId;
          reliefRec.staffId = transferredId;
          reliefRec.status = initialStatus === "draft" ? "draft" : "adjusted";
          reliefRec.note = "Điều phối giảm tải từ Đo sinh hiệu theo kinh nghiệm tích lũy";

          bestVitalsRec.staffId = khnvBackup.id;
          bestVitalsRec.status = initialStatus === "draft" ? "draft" : "adjusted";
          bestVitalsRec.note = `Điều động ${khnvBackup.name} (KHNV) hỗ trợ Đo sinh hiệu`;
        }
      }
    }

    generated.push(...shiftRecords);
  }

  return sortAssignments(generated);
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
  holidays: Holiday[] = [],
  isTemplateMode: boolean = false,
) {
  const assignments = getWeeklyAssignments(weeklySchedule, weekStart);
  const staffMap = new Map(staff.map((member) => [member.id, member]));

  const closedPositionChecker = createClosedPositionChecker(positionRules);
  const leaveChecker = createLeaveConflictChecker(leaveRequests);

  return getActiveScheduleRules(scheduleRules).map((slot) => {
    const date = format(
      addDays(parseISO(weekStart), slot.dayOfWeek - 1),
      "yyyy-MM-dd",
    );

    const isDayOff = isOffDay(date, slot.shift, holidays);

    return {
      date,
      dayOfWeek: slot.dayOfWeek,
      shift: slot.shift,
      isDayOff,
      title: `${WEEKDAY_LABELS[slot.dayOfWeek]} · ${SHIFT_LABELS[slot.shift]}`,
      entries: isDayOff
        ? []
        : positions
          .filter((position) => !closedPositionChecker.isClosed(slot.dayOfWeek, slot.shift, position.id))
        .map((position) => {
          const posAssignments = assignments.filter(
            (item) =>
              item.date === date &&
              item.shift === slot.shift &&
              item.positionId === position.id,
          );

          const quota = position.quota || 1;
          const slots = [];

          // Chỉ đẻ đúng số slot đã phân công. Nếu chưa có ai thì hiển thị 1 slot "Chưa xếp người" để đỡ trống.
          const iterations = posAssignments.length > 0 ? posAssignments.length : (isTemplateMode ? quota : 1);

          for (let i = 0; i < iterations; i++) {
            const assignment = posAssignments.find((a) => (a.slotIndex || 0) === i) ?? null;
            let person = assignment ? staffMap.get(assignment.staffId) ?? null : null;

            if (!assignment && isTemplateMode) {
              const defaultStaffId = position.staffOrder?.[i];
              if (defaultStaffId) {
                person = staffMap.get(defaultStaffId) ?? null;
              }
            }

            const rawLeave = assignment
              ? leaveChecker.check(assignment.staffId, date, slot.shift)
              : person
                ? leaveChecker.check(person.id, date, slot.shift)
                : null;

            // Ngoại lệ: Đi học + vị trí KHNV → không coi là xung đột
            const isExempt = rawLeave?.reason === "dihoc" && position.name.toUpperCase().includes("KHNV");
            // Nếu có lịch nghỉ phép, thực hiện "Tự động ẩn" nhân sự khỏi bảng lịch
            const leave = isExempt ? null : rawLeave;
            const finalPerson = leave ? null : person;

            slots.push({
              assignment,
              person: finalPerson,
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
  holidays: Holiday[] = [],
): WorkloadSummary[] {
  const { start, end } = getMonthBounds(monthKey);
  const summaries = new Map<string, Set<string>>();
  const positionSets = new Map<string, Set<string>>();
  const shifts = new Map<string, WorkloadSummary>();

  weeklySchedule
    .filter((assignment) => assignment.date >= start && assignment.date <= end)
    .filter((assignment) => !isOffDay(assignment.date, assignment.shift, holidays))
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
  holidays: Holiday[] = [],
): LeaveSummary[] {
  const { start, end } = getMonthBounds(monthKey);
  const summaries = new Map<string, LeaveSummary>();

  leaveRequests
    .filter((leave) => leave.date >= start && leave.date <= end)
    .filter((leave) => {
      // Ngày nghỉ lễ/CN/chiều T7 không tính vào ngày nghỉ phép (theo yêu cầu)
      if (leave.shift === "full-day") {
        return !isOffDay(leave.date, "morning", holidays) || !isOffDay(leave.date, "afternoon", holidays);
      }
      return !isOffDay(leave.date, leave.shift as "morning" | "afternoon", holidays);
    })
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

/**
 * [QWEN3] Tính toán tích lũy kinh nghiệm và chuyên môn theo vị trí làm việc.
 * Quy chuẩn: 1 ca trực hoàn thành = 4 giờ làm việc chuyên môn.
 */
export function calculatePositionExperienceStats(
  weeklySchedule: WeeklyAssignment[],
  staffList: StaffMember[],
  positions: Position[],
  filterMonth?: string,
): StaffExperienceSummary[] {
  // Lọc theo tháng nếu có (ví dụ "2026-11"), nếu không thì tính toàn bộ lịch sử
  const filteredAssignments = filterMonth
    ? weeklySchedule.filter((a) => a.date.startsWith(filterMonth) && a.staffId)
    : weeklySchedule.filter((a) => a.staffId);

  // Map vị trí để tra cứu tên
  const posMap = new Map<string, Position>(positions.map((p) => [p.id, p]));

  // Thống kê theo từng nhân sự
  return staffList
    .filter((s) => s.active)
    .map((member) => {
      const myAssignments = filteredAssignments.filter((a) => a.staffId === member.id);
      const posCounts: Record<string, StaffPositionExperience> = {};

      // [QWEN3] Gom nhóm theo ca trực (date + shift) để tính n vị trí kiêm nhiệm trong ca
      // Quy chuẩn: 1 ca = 4 giờ; nếu làm n vị trí thì mỗi vị trí nhận 4/n giờ tích lũy
      const slotGroups = new Map<string, WeeklyAssignment[]>();
      for (const a of myAssignments) {
        const slotKey = `${a.date}_${a.shift}`;
        const list = slotGroups.get(slotKey) || [];
        list.push(a);
        slotGroups.set(slotKey, list);
      }

      for (const [, assignmentsInSlot] of slotGroups.entries()) {
        const n = assignmentsInSlot.length;
        const hoursPerPosition = n > 0 ? 4 / n : 0;

        for (const a of assignmentsInSlot) {
          if (!posCounts[a.positionId]) {
            posCounts[a.positionId] = { shifts: 0, hours: 0 };
          }
          posCounts[a.positionId].shifts += 1;
          posCounts[a.positionId].hours += hoursPerPosition;
        }
      }

      // Làm tròn 1 chữ số thập phân cho từng vị trí để số liệu hiển thị chuẩn xác
      for (const pid of Object.keys(posCounts)) {
        posCounts[pid].hours = Math.round(posCounts[pid].hours * 10) / 10;
      }

      const totalShifts = myAssignments.length;
      // Tổng số giờ làm việc thực tế bảo toàn: số ca duy nhất * 4h
      const totalHours = Math.round(slotGroups.size * 4 * 10) / 10;

      // Xác định vị trí tích lũy nhiều nhất (top position)
      let topPos: { id: string; name: string; hours: number } | undefined;
      let maxHours = 0;
      for (const [pid, data] of Object.entries(posCounts)) {
        if (data.hours > maxHours) {
          maxHours = data.hours;
          topPos = {
            id: pid,
            name: posMap.get(pid)?.name || pid,
            hours: data.hours,
          };
        }
      }

      return {
        staffId: member.id,
        staffName: member.name,
        staffCode: member.code || "",
        totalShifts,
        totalHours,
        positions: posCounts,
        topPosition: topPos,
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);
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
  const leaveChecker = createLeaveConflictChecker(leaveRequests);
  const expLookup = buildExperienceHoursLookup(weeklySchedule, staff, positions, date);
  const habitStats = buildRecentHabitStats(weeklySchedule, date);
  const targetDow = parseISO(date).getDay();

  // Lấy các assignment trong cùng buổi
  const currentShiftAssignments = weeklySchedule.filter(
    (a) => a.date === date && a.shift === shift
  );

  const posMap = new Map(positions.map(p => [p.id, p]));

  // Trích xuất những người đã có ca trong cùng buổi
  const busyStaffMap = new Map<string, string[]>();
  for (const a of currentShiftAssignments) {
    const list = busyStaffMap.get(a.staffId) || [];
    const posName = posMap.get(a.positionId)?.name || a.positionId;
    list.push(posName);
    busyStaffMap.set(a.staffId, list);
  }

  const partnerDermStaffIds = new Set<string>();
  if (targetPos && isDermatologyPairPosition(targetPos)) {
    for (const a of currentShiftAssignments) {
      if (!a.staffId || a.positionId === positionId) continue;
      const otherPos = posMap.get(a.positionId);
      if (otherPos && isDermatologyPairPosition(otherPos)) {
        partnerDermStaffIds.add(a.staffId);
      }
    }
  }

  const available = staff.filter((member) => {
    if (!isAssignableNursingStaff(member)) return false;
    const conflict = leaveChecker.check(member.id, date, shift);
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

    // Quy tắc cố định & xoay vị trí
    if (targetPos && isTiepNhanPosition(targetPos) && isTiepNhanRotationStaff(member)) {
      reasons.unshift("Nhóm xoay Tiếp nhận");
      score += 1200;
    }
    if (targetPos && isDermatologyPairPosition(targetPos) && partnerDermStaffIds.has(member.id)) {
      reasons.unshift("Đồng bộ cặp Da liễu & CSD");
      score += 2500;
    }
    if (targetPos) {
      for (const fixedRule of FIXED_ROOM_STAFF_RULES) {
        if (!fixedRule.matchPosition(targetPos)) continue;
        if (fixedRule.matchPrimaryStaff(member)) {
          reasons.unshift(`Thường trực ${fixedRule.label}`);
          score += 2000;
        } else if (fixedRule.matchBackupStaff?.(member)) {
          reasons.unshift(`Hỗ trợ ${fixedRule.label}`);
          score += 900;
        }
      }
      for (const poolRule of SPECIALTY_POOL_RULES) {
        if (!poolRule.matchPosition(targetPos)) continue;
        const poolRank = findSpecialtyPoolRank(poolRule, member);
        if (poolRank !== -1) {
          reasons.unshift(`Nhóm ${poolRule.label} (#${poolRank + 1})`);
          score += 1100 - poolRank * 80;
        }
      }
    }

    // Kinh nghiệm tích lũy & thói quen 1-2 tuần gần đây
    const expHours = expLookup.get(member.id)?.get(positionId) ?? 0;
    if (expHours > 0) {
      reasons.push(`Kinh nghiệm ${expHours}h`);
      score += Math.min(expHours, 120) * 2.5;
    }
    const slotHabit = habitStats.slotWeightMap.get(`${targetDow}_${shift}_${positionId}_${member.id}`) ?? 0;
    const posHabit = habitStats.positionWeightMap.get(`${positionId}_${member.id}`) ?? 0;
    if (slotHabit > 0 || posHabit > 0) {
      reasons.push("Quen vị trí gần đây");
      score += Math.min(slotHabit, 3) * 60 + Math.min(posHabit, 10) * 15;
    }

    const busyPositions = busyStaffMap.get(member.id);
    if (busyPositions) {
      // Đã bị xoá khỏi mảng available nếu có LeaveConflict,
      // nên ở đây chắc chắn là "kiêm nhiệm" các vị trí khác
      if (busyPositions.includes(targetPos?.name || "")) {
        reasons.push(`Đang ở ca này`);
      } else {
        reasons.push(`Đã xếp: ${busyPositions.join(", ")}`);
      }
      if (targetPos && isLowVolumePosition(targetPos)) {
        reasons.push("Phòng ít bệnh — dễ kiêm nhiệm");
        score -= 40;
      } else {
        score -= 120;
      }
    } else {
      reasons.push("Rảnh chưa có ca");
      score += 220;
    }

    // Ưu tiên nhân sự có phạm vi vị trí hẹp hơn (ít vị trí) để giữ người đa năng cho các khe khó
    const positionCoverage = member.positionIds.length || 99;
    if (positionCoverage <= 2) {
      reasons.push("Ít vị trí");
      score += 50 - positionCoverage * 5;
    } else {
      score += Math.max(0, 20 - positionCoverage);
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

export interface MonthlyTimesheetStaffRow {
  staffId: string;
  name: string;
  days: Record<
    string,
    {
      morning: "✔" | "P" | "H" | "O" | "T" | null;
      afternoon: "✔" | "P" | "H" | "O" | "T" | null;
    }
  >;
  totalWork: number;
  totalLeaveP: number;
  totalLeaveH: number;
  totalLeaveO: number;
  totalOvertime: number;
}

/**
 * Báo cáo chấm công chi tiết theo ngày trong tháng
 */
export function buildMonthlyTimesheet(
  weeklySchedule: WeeklyAssignment[],
  leaveRequests: LeaveRecord[],
  staff: StaffMember[],
  positions: Position[],
  scheduleRules: ScheduleRule[],
  positionRules: PositionRule[],
  monthKey: string,
  holidays: Holiday[] = []
): MonthlyTimesheetStaffRow[] {
  const { start, end } = getMonthBounds(monthKey);
  const startDate = parseISO(start);
  const endDate = parseISO(end);
  const daysCount = differenceInCalendarDays(endDate, startDate) + 1;

  // Khởi tạo map cho mỗi nhân sự
  const timesheetMap = new Map<string, MonthlyTimesheetStaffRow>();
  for (const member of staff) {
    if (!member.active) continue;
    timesheetMap.set(member.id, {
      staffId: member.id,
      name: member.name,
      days: {},
      totalWork: 0,
      totalLeaveP: 0,
      totalLeaveH: 0,
      totalLeaveO: 0,
      totalOvertime: 0,
    });
  }

  // 1. Ghi nhận dữ liệu làm thêm T7 (Overtime)
  // Quét qua weeklySchedule để tìm những staff có lịch vào Sáng Thứ 7
  const overtimeStaffSet = new Set<string>();
  weeklySchedule.forEach(a => {
    if (a.date >= start && a.date <= end && isOvertimeSlot(a.date, a.shift) && a.status === "published") {
      overtimeStaffSet.add(`${a.staffId}|${a.date}`);
    }
  });

  const leaveChecker = createLeaveConflictChecker(leaveRequests);

  for (const member of staff) {
    if (!member.active) continue;
    const row = timesheetMap.get(member.id);
    if (!row) continue;

    for (let i = 0; i < daysCount; i++) {
      const currentDate = format(addDays(startDate, i), "yyyy-MM-dd");
      const dayOfWeek = addDays(startDate, i).getDay(); // 0=CN, 6=T7

      if (!row.days[currentDate]) {
        row.days[currentDate] = { morning: null, afternoon: null };
      }

      for (const shift of ["morning", "afternoon"] as const) {
        // Kiểm tra nghỉ lễ
        if (isOffDay(currentDate, shift, holidays)) {
          continue; // Bỏ tick
        }

        // Kiểm tra chiều T7 hoặc CN
        if (dayOfWeek === 0 || (dayOfWeek === 6 && shift === "afternoon")) {
          continue; // Bỏ tick
        }

        // Kiểm tra phép
        const leave = leaveChecker.check(member.id, currentDate, shift);
        if (leave) {
          const mark = leave.reason === "dihoc" ? "H" : leave.reason === "om" ? "O" : "P";
          row.days[currentDate][shift] = mark;
          if (mark === "H") row.totalLeaveH++;
          else if (mark === "O") row.totalLeaveO++;
          else row.totalLeaveP++;
          continue;
        }

        // Ghi nhận đi làm
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          // Từ T2 tới T6: mặc định tick ✔
          row.days[currentDate][shift] = "✔";
          row.totalWork++;
        } else if (dayOfWeek === 6 && shift === "morning") {
          // T7 sáng: ghi T nếu có dữ liệu đi làm thêm
          if (overtimeStaffSet.has(`${member.id}|${currentDate}`)) {
            row.days[currentDate].morning = "T";
            row.totalOvertime++;
          }
        }
      }
    }
  }

  return Array.from(timesheetMap.values())
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}
