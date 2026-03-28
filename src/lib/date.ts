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
    return getWeekStart();
  }

  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return getWeekStart();
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

