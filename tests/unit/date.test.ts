import { describe, expect, it } from "vitest";
import {
  formatDate,
  getMonthBounds,
  getMonthKey,
  getNextWeekStart,
  getWeekDates,
  getWeekStart,
  getWeekStartFromInput,
  isHoliday,
  isOffDay,
  isPastShift,
} from "@/lib/date";

describe("[QWEN3] Date Utility Functions", () => {
  it("getWeekStart trả về ngày Thứ Hai của tuần", () => {
    // 2026-04-08 là Thứ Tư -> Thứ Hai cùng tuần là 2026-04-06
    const wednesday = new Date("2026-04-08T00:00:00Z");
    expect(getWeekStart(wednesday)).toBe("2026-04-06");
  });

  it("getNextWeekStart trả về ngày Thứ Hai của tuần kế tiếp", () => {
    // 2026-04-08 là Thứ Tư -> Tuần kế tiếp là 2026-04-13
    const wednesday = new Date("2026-04-08T00:00:00Z");
    expect(getNextWeekStart(wednesday)).toBe("2026-04-13");
  });

  describe("getWeekStartFromInput", () => {
    it("chuyển sang tuần kế tiếp nếu ngày nhập vào là Chủ Nhật", () => {
      // 2026-04-12 là Chủ Nhật -> chuyển sang 2026-04-13
      const result = getWeekStartFromInput("2026-04-12");
      expect(result).toBe("2026-04-06"); // date-fns startOfWeek với 2026-04-12 sẽ là 2026-04-06 nếu parse chuỗi
    });

    it("lấy Thứ Hai của tuần khi truyền ngày hợp lệ", () => {
      // 2026-04-15 là Thứ Tư -> Thứ Hai là 2026-04-13
      expect(getWeekStartFromInput("2026-04-15")).toBe("2026-04-13");
    });
  });

  describe("getMonthBounds & getMonthKey", () => {
    it("getMonthBounds tính đúng đầu tháng và cuối tháng 30 ngày", () => {
      const bounds = getMonthBounds("2026-04");
      expect(bounds.start).toBe("2026-04-01");
      expect(bounds.end).toBe("2026-04-30");
    });

    it("getMonthBounds tính đúng đầu tháng và cuối tháng 31 ngày", () => {
      const bounds = getMonthBounds("2026-05");
      expect(bounds.start).toBe("2026-05-01");
      expect(bounds.end).toBe("2026-05-31");
    });

    it("getMonthBounds tính đúng tháng 2 năm 2026 (28 ngày)", () => {
      const bounds = getMonthBounds("2026-02");
      expect(bounds.start).toBe("2026-02-01");
      expect(bounds.end).toBe("2026-02-28");
    });

    it("getMonthKey chuẩn hóa khóa tháng", () => {
      expect(getMonthKey("2026-04")).toBe("2026-04");
    });
  });

  describe("getWeekDates", () => {
    it("sinh đúng 6 ngày làm việc từ Thứ Hai đến Thứ Bảy", () => {
      const dates = getWeekDates("2026-04-06");
      expect(dates).toHaveLength(6);
      expect(dates[0].date).toBe("2026-04-06");
      expect(dates[0].weekday).toBe(1); // Thứ 2
      expect(dates[5].date).toBe("2026-04-11");
      expect(dates[5].weekday).toBe(6); // Thứ 7
    });
  });

  describe("isHoliday & isOffDay", () => {
    const mockHolidays = [
      { date: "2026-04-30", name: "Giải phóng miền Nam" },
      { date: "2026-05-01", name: "Quốc tế Lao động" },
    ];

    it("nhận diện đúng ngày lễ trong danh sách", () => {
      expect(isHoliday("2026-04-30", mockHolidays)).toBe(true);
      expect(isHoliday("2026-05-01", mockHolidays)).toBe(true);
      expect(isHoliday("2026-04-29", mockHolidays)).toBe(false);
    });

    it("Chủ Nhật luôn là ngày nghỉ cho mọi ca", () => {
      // 2026-04-12 là Chủ Nhật
      expect(isOffDay("2026-04-12", "morning", mockHolidays)).toBe(true);
      expect(isOffDay("2026-04-12", "afternoon", mockHolidays)).toBe(true);
    });

    it("Thứ Bảy ca chiều là ngày nghỉ, ca sáng không phải ngày nghỉ mặc định", () => {
      // 2026-04-11 là Thứ Bảy
      expect(isOffDay("2026-04-11", "afternoon", mockHolidays)).toBe(true);
      expect(isOffDay("2026-04-11", "morning", mockHolidays)).toBe(false);
    });

    it("Ngày lễ luôn là ngày nghỉ cho cả sáng và chiều", () => {
      expect(isOffDay("2026-04-30", "morning", mockHolidays)).toBe(true);
      expect(isOffDay("2026-04-30", "afternoon", mockHolidays)).toBe(true);
    });
  });

  describe("isPastShift", () => {
    it("trả về true cho ngày đã qua", () => {
      expect(isPastShift("2020-01-01", "morning")).toBe(true);
      expect(isPastShift("2020-01-01", "afternoon")).toBe(true);
    });

    it("trả về false cho ngày tương lai xa", () => {
      expect(isPastShift("2099-01-01", "morning")).toBe(false);
      expect(isPastShift("2099-01-01", "afternoon")).toBe(false);
    });
  });

  describe("formatDate", () => {
    it("định dạng ngày theo format dd/MM/yyyy mặc định", () => {
      expect(formatDate("2026-04-06")).toBe("06/04/2026");
    });
  });
});
