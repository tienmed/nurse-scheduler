import {
  addDays,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export function getWeekStart(date = new Date()) {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function getNextWeekStart(date = new Date()) {
  return format(
    addDays(startOfWeek(date, { weekStartsOn: 1 }), 7),
    "yyyy-MM-dd",
  );
}

export function getWeekStartFromInput(value?: string | null) {
  if (!value) {
    const today = new Date();
    // Chủ nhật (getDay()===0) → hiển thị tuần kế tiếp
    return today.getDay() === 0 ? getNextWeekStart(today) : getWeekStart(today);
  }

  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    const today = new Date();
    return today.getDay() === 0 ? getNextWeekStart(today) : getWeekStart(today);
  }

  return format(startOfWeek(parsed, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function getMonthKey(value?: string | null) {
  if (!value) {
    return format(new Date(), "yyyy-MM");
  }

  const parsed = parseISO(`${value}-01`);
  if (!isValid(parsed)) {
    return format(new Date(), "yyyy-MM");
  }

  return format(parsed, "yyyy-MM");
}

export function getMonthBounds(monthKey: string) {
  const parsed = parseISO(`${monthKey}-01`);
  return {
    start: format(startOfMonth(parsed), "yyyy-MM-dd"),
    end: format(endOfMonth(parsed), "yyyy-MM-dd"),
  };
}

export function getWeekDates(weekStart: string) {
  const parsed = parseISO(weekStart);
  return Array.from({ length: 6 }, (_, index) => {
    const date = addDays(parsed, index);
    return {
      date: format(date, "yyyy-MM-dd"),
      weekday: date.getDay(),
      label: format(date, "dd/MM"),
    };
  });
}

export function formatDate(isoDate: string, pattern = "dd/MM/yyyy") {
  return format(parseISO(isoDate), pattern);
}

/** Kiểm tra weekStart có phải tuần hiện tại hoặc tuần kế tiếp */
export function isCurrentOrNextWeek(weekStart: string): boolean {
  const current = getWeekStart();
  const next = getNextWeekStart();
  return weekStart === current || weekStart === next;
}

/** Tương tự như kiểm tra khóa ca làm, nhận biết ca đã qua so với hiện tại (theo giờ) */
export function isPastShift(dateStr: string, shift: string): boolean {
  if (!dateStr) return false;
  const { parseISO, compareAsc, startOfToday } = require("date-fns");
  const parsedDate = parseISO(dateStr);
  const today = startOfToday();
  const dateDiff = compareAsc(parsedDate, today);

  if (dateDiff < 0) {
    return true; // Ngày ở trong quá khứ
  }
  if (dateDiff > 0) {
    return false; // Ngày ở tương lai
  }

  // Ngày hiện tại (hôm nay) - Dùng múi giờ Việt Nam (UTC+7) để đảm bảo đồng nhất
  const vnTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const currentHour = vnTime.getHours();
  
  if (shift === "morning") {
    return currentHour >= 12; // Quá 12h trưa -> khóa ca sáng
  }
  if (shift === "afternoon") {
    return currentHour >= 18; // Quá 18h -> khóa ca chiều
  }
  return false;
}

/** Kiểm tra xem một ngày có phải là ngày lễ đã định nghĩa không */
export function isHoliday(dateStr: string, holidays: { date: string }[]): boolean {
  return holidays.some((h) => h.date === dateStr);
}

/**
 * Kiểm tra xem một ca cụ thể có phải là ca nghỉ mặc định không.
 * Bao gồm:
 * - Chủ Nhật (cả ngày)
 * - Thứ 7 (chiều)
 * - Các ngày lễ được định nghĩa
 */
export function isOffDay(
  dateStr: string,
  shift: "morning" | "afternoon",
  holidays: { date: string }[]
): boolean {
  if (isHoliday(dateStr, holidays)) return true;

  const date = parseISO(dateStr);
  const dayOfWeek = date.getDay();

  if (dayOfWeek === 0) return true; // Chủ Nhật
  if (dayOfWeek === 6 && shift === "afternoon") return true; // Chiều Thứ 7

  return false;
}

