import { describe, expect, it } from "vitest";
import {
  MONTHLY_TIMESHEET_RECIPIENTS,
  buildMonthlyTimesheetEmailHtml,
  calculateMonthlyTimesheetStats,
  getMonthlyTimesheetRecipients,
  getPreviousMonthKey,
  parseMonthArg,
} from "@/lib/monthly-email-html";
import {
  buildMonthlyTimesheetWorkbook,
  generateMonthlyTimesheetExcelBuffer,
} from "@/lib/monthly-timesheet-excel";
import type { MonthlyTimesheetStaffRow } from "@/lib/schedule";

describe("Monthly Timesheet & Email Notification", () => {
  describe("getPreviousMonthKey", () => {
    it("trả về đúng tháng trước đó đối với ngày giữa tháng", () => {
      const ref = new Date(2026, 10, 15); // Tháng 11/2026 (0-indexed month 10)
      expect(getPreviousMonthKey(ref)).toBe("2026-10");
    });

    it("trả về đúng tháng trước đó vào ngày đầu tháng", () => {
      const ref = new Date(2026, 11, 1); // 01/12/2026
      expect(getPreviousMonthKey(ref)).toBe("2026-11");
    });

    it("chuyển năm chính xác khi chạy vào tháng 1", () => {
      const ref = new Date(2027, 0, 5); // 05/01/2027
      expect(getPreviousMonthKey(ref)).toBe("2026-12");
    });

    it("xử lý an toàn các ngày cuối tháng không bị lệch tháng kế tiếp", () => {
      const ref = new Date(2027, 2, 31); // 31/03/2027
      expect(getPreviousMonthKey(ref)).toBe("2027-02");
    });

    it("xử lý chuẩn múi giờ Việt Nam khi timestamp là UTC cuối ngày tháng trước", () => {
      // 2026-10-31T18:00:00Z -> Tại Việt Nam (UTC+7) đã là 2026-11-01 01:00:00
      // Tháng trước đó tại VN phải là 2026-10
      const utcEarlyMorningVn = new Date("2026-10-31T18:00:00.000Z");
      expect(getPreviousMonthKey(utcEarlyMorningVn)).toBe("2026-10");
    });
  });

  describe("parseMonthArg", () => {
    const fixedDate = new Date(2026, 11, 1); // 01/12/2026 -> previous is 2026-11

    it("mặc định lấy tháng vừa qua khi không có cờ --month", () => {
      expect(parseMonthArg([], fixedDate)).toBe("2026-11");
      expect(parseMonthArg(["--preview"], fixedDate)).toBe("2026-11");
    });

    it("nhận đúng tham số dạng --month=YYYY-MM", () => {
      expect(parseMonthArg(["--month=2026-10"], fixedDate)).toBe("2026-10");
      expect(parseMonthArg(["--preview", "--month=2026-05"], fixedDate)).toBe("2026-05");
    });

    it("nhận đúng tham số dạng cách khoảng --month YYYY-MM", () => {
      expect(parseMonthArg(["--month", "2026-08"], fixedDate)).toBe("2026-08");
      expect(parseMonthArg(["--preview", "--month", "2026-02"], fixedDate)).toBe("2026-02");
    });

    it("báo lỗi nếu định dạng tháng không hợp lệ", () => {
      expect(() => parseMonthArg(["--month=2026-13"], fixedDate)).toThrowError(
        /Định dạng --month không hợp lệ/
      );
      expect(() => parseMonthArg(["--month=invalid"], fixedDate)).toThrowError(
        /Định dạng --month không hợp lệ/
      );
      expect(() => parseMonthArg(["--month=2026/10"], fixedDate)).toThrowError(
        /Định dạng --month không hợp lệ/
      );
    });
  });

  describe("Recipients", () => {
    it("danh sách người nhận mặc định phải chứa đủ 3 người: Tú Trang, Nhân Nghĩa và BS Tiến", () => {
      expect(MONTHLY_TIMESHEET_RECIPIENTS).toHaveLength(3);
      expect(MONTHLY_TIMESHEET_RECIPIENTS).toContain("trangdlt@pnt.edu.vn");
      expect(MONTHLY_TIMESHEET_RECIPIENTS).toContain("nghiadn.pk@pnt.edu.vn");
      expect(MONTHLY_TIMESHEET_RECIPIENTS).toContain("tienmed@gmail.com");
    });

    it("hỗ trợ ghi đè người nhận qua cờ CLI --to hoặc --to=", () => {
      expect(getMonthlyTimesheetRecipients(["--to=test@pnt.edu.vn"])).toEqual([
        "test@pnt.edu.vn",
      ]);
      expect(
        getMonthlyTimesheetRecipients(["--to", "a@test.com, b@test.com"])
      ).toEqual(["a@test.com", "b@test.com"]);
    });
  });

  describe("calculateMonthlyTimesheetStats", () => {
    const mockRows: MonthlyTimesheetStaffRow[] = [
      {
        staffId: "st-1",
        name: "Đặng Lê Tú Trang",
        days: {
          "2026-10-01": { morning: "✔", afternoon: "✔" },
          "2026-10-02": { morning: "P", afternoon: "✔" },
        },
        totalWork: 3, // 1.5 ngày công
        totalLeaveP: 1, // 0.5 ngày phép
        totalLeaveH: 0,
        totalLeaveO: 0,
        totalOvertime: 0,
      },
      {
        staffId: "st-2",
        name: "Đặng Nhân Nghĩa",
        days: {
          "2026-10-01": { morning: "✔", afternoon: "✔" },
          "2026-10-03": { morning: "T", afternoon: null },
        },
        totalWork: 2, // 1.0 ngày công
        totalLeaveP: 0,
        totalLeaveH: 0,
        totalLeaveO: 0,
        totalOvertime: 1, // 0.5 ngày (1 ca)
      },
      {
        staffId: "st-3",
        name: "Nguyễn Thị A",
        days: {
          "2026-10-01": { morning: "H", afternoon: "O" },
        },
        totalWork: 0,
        totalLeaveP: 0,
        totalLeaveH: 1, // 0.5 ngày học
        totalLeaveO: 1, // 0.5 ngày ốm
        totalOvertime: 0,
      },
    ];

    it("tính chính xác tổng công, tổng phép và tổng tăng ca", () => {
      const stats = calculateMonthlyTimesheetStats(mockRows);
      expect(stats.staffCount).toBe(3);
      expect(stats.totalWorkDays).toBe(2.5); // (3 + 2 + 0) / 2
      expect(stats.totalLeaveP).toBe(0.5);
      expect(stats.totalLeaveH).toBe(0.5);
      expect(stats.totalLeaveO).toBe(0.5);
      expect(stats.totalLeaveDays).toBe(1.5);
      expect(stats.totalOvertimeShifts).toBe(1);
      expect(stats.totalOvertimeDays).toBe(0.5);
    });

    it("xử lý mảng rỗng an toàn mà không bị lỗi", () => {
      const stats = calculateMonthlyTimesheetStats([]);
      expect(stats.staffCount).toBe(0);
      expect(stats.totalWorkDays).toBe(0);
      expect(stats.totalLeaveDays).toBe(0);
      expect(stats.totalOvertimeDays).toBe(0);
    });
  });

  describe("buildMonthlyTimesheetEmailHtml", () => {
    const mockRows: MonthlyTimesheetStaffRow[] = [
      {
        staffId: "st-1",
        name: "Đặng Lê Tú Trang",
        days: {},
        totalWork: 40,
        totalLeaveP: 2,
        totalLeaveH: 0,
        totalLeaveO: 0,
        totalOvertime: 2,
      },
      {
        staffId: "st-2",
        name: "Đặng Nhân Nghĩa <test&admin>",
        days: {},
        totalWork: 42,
        totalLeaveP: 0,
        totalLeaveH: 0,
        totalLeaveO: 0,
        totalOvertime: 4,
      },
    ];

    it("sinh tiêu đề và nội dung HTML đầy đủ thông tin kèm escape ký tự đặc biệt", () => {
      const result = buildMonthlyTimesheetEmailHtml({
        monthKey: "2026-10",
        timesheet: mockRows,
      });

      expect(result.subject).toBe("[NurseFlow] Bảng tổng hợp chấm công tháng 10/2026");
      expect(result.html).toContain("Báo Cáo Chấm Công Tháng 10/2026");
      expect(result.html).toContain("Đặng Lê Tú Trang");
      expect(result.html).toContain("&lt;test&amp;admin&gt;");
      expect(result.html).toContain("BS. Trịnh Trung Tiến");
      expect(result.html).toContain("bao-cao-thang-2026-10.xlsx");
      expect(result.html).toContain("01/10/2026 – 31/10/2026");
      expect(result.stats.staffCount).toBe(2);
      expect(result.stats.totalWorkDays).toBe(41);
    });
  });

  describe("Excel Workbook Generation", () => {
    const mockRows: MonthlyTimesheetStaffRow[] = [
      {
        staffId: "st-1",
        name: "Đặng Lê Tú Trang",
        days: {
          "2026-10-01": { morning: "✔", afternoon: "✔" },
          "2026-10-03": { morning: "T", afternoon: null },
        },
        totalWork: 2,
        totalLeaveP: 0,
        totalLeaveH: 0,
        totalLeaveO: 0,
        totalOvertime: 1,
      },
      {
        staffId: "st-2",
        name: "Đặng Nhân Nghĩa",
        days: {
          "2026-10-01": { morning: "P", afternoon: "✔" },
        },
        totalWork: 1,
        totalLeaveP: 1,
        totalLeaveH: 0,
        totalLeaveO: 0,
        totalOvertime: 0,
      },
    ];

    it("tạo workbook với sheet 'Cham Cong YYYY-MM' và cấu trúc header 3 dòng", () => {
      const workbook = buildMonthlyTimesheetWorkbook({
        monthKey: "2026-10",
        timesheet: mockRows,
      });

      const sheet = workbook.getWorksheet("Cham Cong 2026-10");
      expect(sheet).toBeDefined();

      // Kiểm tra Header cell A1: Nhân viên
      const cellA1 = sheet!.getCell("A1");
      expect(cellA1.value).toBe("Nhân viên");

      // Cột 1 có độ rộng 25
      expect(sheet!.getColumn(1).width).toBe(25);

      // Có ít nhất 3 dòng header + 2 dòng dữ liệu nhân sự = 5 dòng
      expect(sheet!.rowCount).toBeGreaterThanOrEqual(5);

      // Dữ liệu dòng nhân viên 1
      const row4 = sheet!.getRow(4);
      expect(row4.getCell(1).value).toBe("Đặng Lê Tú Trang");

      // Dữ liệu dòng nhân viên 2
      const row5 = sheet!.getRow(5);
      expect(row5.getCell(1).value).toBe("Đặng Nhân Nghĩa");
    });

    it("tạo đúng số cột cho tháng 2 (28 ngày) và tháng 4 (30 ngày)", () => {
      const wbFeb = buildMonthlyTimesheetWorkbook({
        monthKey: "2026-02",
        timesheet: mockRows,
      });
      const sheetFeb = wbFeb.getWorksheet("Cham Cong 2026-02");
      // Cột 1 (tên) + 28*2 cột (S/C) + 3 cột tổng = 60 cột
      // Cột cuối cùng (Σ Tăng ca) là cột 60
      expect(sheetFeb!.getColumn(60).width).toBe(12);

      const wbApr = buildMonthlyTimesheetWorkbook({
        monthKey: "2026-04",
        timesheet: mockRows,
      });
      const sheetApr = wbApr.getWorksheet("Cham Cong 2026-04");
      // Cột 1 (tên) + 30*2 cột (S/C) + 3 cột tổng = 64 cột
      expect(sheetApr!.getColumn(64).width).toBe(12);
    });

    it("sinh buffer Excel hợp lệ (chuẩn PK zip header của .xlsx)", async () => {
      const buffer = await generateMonthlyTimesheetExcelBuffer({
        monthKey: "2026-10",
        timesheet: mockRows,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
      // Byte đầu của file zip (.xlsx) luôn là 'PK' (0x50, 0x4B)
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
    });
  });
});
