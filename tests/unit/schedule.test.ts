import { describe, expect, it } from "vitest";
import {
  buildMonthlyTimesheet,
  calculateMonthlyLeaves,
  calculateMonthlyWorkload,
  createClosedPositionChecker,
  createLeaveConflictChecker,
  getActiveScheduleRules,
  isOvertimeSlot,
  OVERTIME_DAY_OF_WEEK,
} from "@/lib/schedule";
import { isOffDay } from "@/lib/date";
import type {
  Holiday,
  LeaveRecord,
  Position,
  PositionRule,
  ScheduleRule,
  StaffMember,
  WeeklyAssignment,
} from "@/lib/types";

describe("[QWEN3] Schedule Logic & Assignment Rules", () => {
  describe("isOvertimeSlot", () => {
    it("nhận diện Thứ 7 ca sáng là ca tăng ca", () => {
      // 2026-04-11 là Thứ 7 (dayOfWeek = 6)
      expect(isOvertimeSlot("2026-04-11", "morning")).toBe(true);
    });

    it("Thứ 7 ca chiều không phải ca tăng ca", () => {
      expect(isOvertimeSlot("2026-04-11", "afternoon")).toBe(false);
    });

    it("Ngày thường ca sáng không phải ca tăng ca", () => {
      // 2026-04-06 là Thứ 2
      expect(isOvertimeSlot("2026-04-06", "morning")).toBe(false);
    });

    it("OVERTIME_DAY_OF_WEEK bằng 6", () => {
      expect(OVERTIME_DAY_OF_WEEK).toBe(6);
    });
  });

  describe("createLeaveConflictChecker", () => {
    const mockLeaves: LeaveRecord[] = [
      {
        id: "l1",
        staffId: "nurse-01",
        date: "2026-04-06",
        shift: "morning",
        reason: "phep",
        status: "approved",
      },
      {
        id: "l2",
        staffId: "nurse-02",
        date: "2026-04-06",
        shift: "full-day",
        reason: "om",
        status: "approved",
      },
    ];

    const checker = createLeaveConflictChecker(mockLeaves);

    it("phát hiện xung đột khi nhân viên nghỉ đúng ca sáng", () => {
      const conflict = checker.check("nurse-01", "2026-04-06", "morning");
      expect(conflict).toBeDefined();
      expect(conflict?.reason).toBe("phep");
    });

    it("không xung đột nếu nhân viên chỉ nghỉ ca sáng nhưng kiểm tra ca chiều", () => {
      const conflict = checker.check("nurse-01", "2026-04-06", "afternoon");
      expect(conflict).toBeUndefined();
    });

    it("phát hiện xung đột ca sáng và ca chiều khi nhân viên nghỉ cả ngày (full-day)", () => {
      const morningConflict = checker.check("nurse-02", "2026-04-06", "morning");
      const afternoonConflict = checker.check("nurse-02", "2026-04-06", "afternoon");

      expect(morningConflict).toBeDefined();
      expect(morningConflict?.reason).toBe("om");

      expect(afternoonConflict).toBeDefined();
      expect(afternoonConflict?.reason).toBe("om");
    });

    it("không phát hiện xung đột đối với nhân viên không có lịch nghỉ", () => {
      const conflict = checker.check("nurse-03", "2026-04-06", "morning");
      expect(conflict).toBeUndefined();
    });
  });

  describe("createClosedPositionChecker", () => {
    const rules: PositionRule[] = [
      {
        id: "pr-1",
        dayOfWeek: 2, // Thứ Ba
        shift: "afternoon",
        positionId: "pos-vaccine",
        active: false, // Bị đóng
      },
    ];

    const checker = createClosedPositionChecker(rules);

    it("trả về true khi vị trí bị đóng", () => {
      expect(checker.isClosed(2, "afternoon", "pos-vaccine")).toBe(true);
    });

    it("trả về false khi vị trí không bị đóng trên ca khác", () => {
      expect(checker.isClosed(2, "morning", "pos-vaccine")).toBe(false);
      expect(checker.isClosed(3, "afternoon", "pos-vaccine")).toBe(false);
    });
  });

  describe("getActiveScheduleRules", () => {
    it("lọc các rule active và sắp xếp theo ngày trong tuần", () => {
      const rules: ScheduleRule[] = [
        { id: "r3", dayOfWeek: 3, shift: "morning", active: true },
        { id: "r1", dayOfWeek: 1, shift: "morning", active: true },
        { id: "r2", dayOfWeek: 2, shift: "afternoon", active: false },
      ];

      const active = getActiveScheduleRules(rules);
      expect(active).toHaveLength(2);
      expect(active[0].dayOfWeek).toBe(1);
      expect(active[1].dayOfWeek).toBe(3);
    });
  });

  describe("calculateMonthlyWorkload", () => {
    const assignments: WeeklyAssignment[] = [
      {
        id: "a1",
        weekStart: "2026-04-06",
        date: "2026-04-06",
        shift: "morning",
        positionId: "pos-1",
        staffId: "nurse-01",
        source: "manual",
        status: "published",
      },
      {
        id: "a2",
        weekStart: "2026-04-06",
        date: "2026-04-06",
        shift: "afternoon",
        positionId: "pos-1",
        staffId: "nurse-01",
        source: "manual",
        status: "published",
      },
      {
        id: "a3",
        weekStart: "2026-04-06",
        date: "2026-04-07",
        shift: "morning",
        positionId: "pos-2",
        staffId: "nurse-02",
        source: "manual",
        status: "published",
      },
    ];

    it("tính chính xác số ca và số ngày làm việc trong tháng", () => {
      const workload = calculateMonthlyWorkload(assignments, "2026-04", []);
      const nurse1 = workload.find((w) => w.staffId === "nurse-01");
      const nurse2 = workload.find((w) => w.staffId === "nurse-02");

      expect(nurse1).toBeDefined();
      expect(nurse1?.shifts).toBe(2);
      expect(nurse1?.workDays).toBe(1);
      expect(nurse1?.morningShifts).toBe(1);
      expect(nurse1?.afternoonShifts).toBe(1);

      expect(nurse2).toBeDefined();
      expect(nurse2?.shifts).toBe(1);
      expect(nurse2?.workDays).toBe(1);
      expect(nurse2?.morningShifts).toBe(1);
      expect(nurse2?.afternoonShifts).toBe(0);
    });
  });

  describe("buildMonthlyTimesheet", () => {
    const mockStaff: StaffMember[] = [
      {
        id: "nurse-01",
        name: "Trần Thị A",
        code: "DD01",
        email: "a@hospital.local",
        role: "viewer",
        positionIds: ["pos-1"],
        active: true,
        prefersOvertime: true,
      },
      {
        id: "nurse-02",
        name: "Lê Văn B",
        code: "DD02",
        email: "b@hospital.local",
        role: "viewer",
        positionIds: ["pos-2"],
        active: true,
        prefersOvertime: false,
      },
    ];

    const mockPositions: Position[] = [
      { id: "pos-1", name: "Phòng Tiêm", area: "Khu A" },
      { id: "pos-2", name: "Phòng Khám", area: "Khu B" },
    ];

    const mockHolidays: Holiday[] = [
      { id: "h-30-4", date: "2026-04-30", name: "Giải phóng miền Nam" },
    ];

    const mockWeeklySchedule: WeeklyAssignment[] = [
      {
        id: "ot-1",
        weekStart: "2026-04-06",
        date: "2026-04-11", // Thứ Bảy
        shift: "morning",
        positionId: "pos-1",
        staffId: "nurse-01",
        source: "manual",
        status: "published",
      },
    ];

    const mockLeaveRequests: LeaveRecord[] = [
      {
        id: "lr-1",
        staffId: "nurse-01",
        date: "2026-04-06", // Thứ Hai
        shift: "morning",
        reason: "phep",
        status: "approved",
      },
      {
        id: "lr-2",
        staffId: "nurse-02",
        date: "2026-04-07", // Thứ Ba
        shift: "full-day",
        reason: "dihoc",
        status: "approved",
      },
    ];

    it("tổng hợp chính xác các ký hiệu chấm công: ✔, P, H, T và ngày nghỉ", () => {
      const timesheet = buildMonthlyTimesheet(
        mockWeeklySchedule,
        mockLeaveRequests,
        mockStaff,
        mockPositions,
        [],
        [],
        "2026-04",
        mockHolidays,
      );

      expect(timesheet).toHaveLength(2);

      const nurse1 = timesheet.find((r) => r.staffId === "nurse-01");
      const nurse2 = timesheet.find((r) => r.staffId === "nurse-02");

      expect(nurse1).toBeDefined();
      expect(nurse2).toBeDefined();

      // Ngày 2026-04-06 (Thứ Hai): nurse-01 nghỉ ca sáng -> 'P', ca chiều đi làm -> '✔'
      expect(nurse1?.days["2026-04-06"].morning).toBe("P");
      expect(nurse1?.days["2026-04-06"].afternoon).toBe("✔");

      // Ngày 2026-04-07 (Thứ Ba): nurse-02 nghỉ học cả ngày -> 'H' cả sáng và chiều
      expect(nurse2?.days["2026-04-07"].morning).toBe("H");
      expect(nurse2?.days["2026-04-07"].afternoon).toBe("H");

      // Ngày 2026-04-11 (Thứ Bảy): nurse-01 có lịch tăng ca sáng -> 'T', chiều là ngày nghỉ -> null
      expect(nurse1?.days["2026-04-11"].morning).toBe("T");
      expect(nurse1?.days["2026-04-11"].afternoon).toBeNull();

      // Ngày 2026-04-12 (Chủ Nhật): cả 2 đều là ngày nghỉ tự nhiên -> null
      expect(nurse1?.days["2026-04-12"].morning).toBeNull();
      expect(nurse1?.days["2026-04-12"].afternoon).toBeNull();

      // Ngày 2026-04-30 (Lễ 30/4): là ngày nghỉ lễ -> null
      expect(nurse1?.days["2026-04-30"].morning).toBeNull();
      expect(nurse1?.days["2026-04-30"].afternoon).toBeNull();

      // Kiểm tra thống kê tổng hợp của nurse-01
      expect(nurse1?.totalLeaveP).toBe(1);
      expect(nurse1?.totalOvertime).toBe(1);

      // Kiểm tra thống kê tổng hợp của nurse-02
      expect(nurse2?.totalLeaveH).toBe(2);
    });
  });

  describe("calculateMonthlyLeaves", () => {
    const mockLeaves: LeaveRecord[] = [
      {
        id: "l1",
        staffId: "nurse-01",
        date: "2026-04-06", // Thứ 2
        shift: "full-day",
        reason: "phep",
        status: "approved",
      },
      {
        id: "l2",
        staffId: "nurse-01",
        date: "2026-04-07", // Thứ 3
        shift: "morning",
        reason: "om",
        status: "approved",
      },
      {
        id: "l3",
        staffId: "nurse-02",
        date: "2026-04-08", // Thứ 4
        shift: "full-day",
        reason: "dihoc",
        status: "approved",
      },
    ];

    it("thống kê chính xác số ngày nghỉ theo từng loại lý do", () => {
      const summary = calculateMonthlyLeaves(mockLeaves, "2026-04", []);
      const nurse1 = summary.find((s) => s.staffId === "nurse-01");
      const nurse2 = summary.find((s) => s.staffId === "nurse-02");

      expect(nurse1).toBeDefined();
      expect(nurse1?.days).toBe(1.5); // 1 ngày cả ngày + 0.5 ngày ca sáng
      expect(nurse1?.phep).toBe(1);
      expect(nurse1?.om).toBe(1);

      expect(nurse2).toBeDefined();
      expect(nurse2?.days).toBe(1);
      expect(nurse2?.dihoc).toBe(1);
    });
  });

  describe("Personal Schedule Extraction for Mobile Portal", () => {
    const mockWeeklySchedule: WeeklyAssignment[] = [
      {
        id: "a1",
        weekStart: "2026-04-06",
        date: "2026-04-06", // Thứ 2
        shift: "morning",
        positionId: "pos-tiem",
        staffId: "nurse-01",
        source: "manual",
        status: "published",
      },
      {
        id: "a2",
        weekStart: "2026-04-06",
        date: "2026-04-06", // Thứ 2
        shift: "afternoon",
        positionId: "pos-kham",
        staffId: "nurse-01",
        source: "manual",
        status: "published",
      },
      {
        id: "a3",
        weekStart: "2026-04-06",
        date: "2026-04-11", // Thứ 7
        shift: "morning",
        positionId: "pos-tiem",
        staffId: "nurse-01",
        source: "manual",
        status: "published",
      },
      {
        id: "a4",
        weekStart: "2026-04-06",
        date: "2026-04-07",
        shift: "morning",
        positionId: "pos-tiem",
        staffId: "nurse-02",
        source: "manual",
        status: "published",
      },
    ];

    it("lọc chính xác toàn bộ ca trực trong tuần của cá nhân", () => {
      const myShifts = mockWeeklySchedule.filter(
        (a) => a.staffId === "nurse-01" && a.weekStart === "2026-04-06" && a.status === "published",
      );

      expect(myShifts).toHaveLength(3);
      expect(myShifts.map((s) => s.shift)).toEqual(["morning", "afternoon", "morning"]);
    });

    it("nhận diện đúng ca tăng ca Thứ 7 của cá nhân", () => {
      const satShift = mockWeeklySchedule.find(
        (a) => a.staffId === "nurse-01" && a.date === "2026-04-11",
      );
      expect(satShift).toBeDefined();
      expect(isOvertimeSlot(satShift!.date, satShift!.shift)).toBe(true);
    });

    it("nhận diện đúng ngày nghỉ quy định cho buổi chiều Thứ 7", () => {
      expect(isOffDay("2026-04-11", "afternoon", [])).toBe(true);
      expect(isOffDay("2026-04-11", "morning", [])).toBe(false);
    });
  });
});
