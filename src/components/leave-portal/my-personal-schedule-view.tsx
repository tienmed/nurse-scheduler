"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  MapPin,
  Sparkles,
  Sun,
  Sunset,
  AlertCircle,
  CalendarCheck,
} from "lucide-react";
import { format, parseISO, addDays, subDays } from "date-fns";
import { getWeekDates, isOffDay, formatDate } from "@/lib/date";
import { createLeaveConflictChecker, isOvertimeSlot } from "@/lib/schedule";
import { LEAVE_REASON_LABELS, WEEKDAY_LABELS } from "@/lib/constants";
import type { Holiday, LeaveRecord, Position, StaffMember, WeeklyAssignment } from "@/lib/types";

interface MyPersonalScheduleViewProps {
  currentStaff: StaffMember;
  weeklySchedule: WeeklyAssignment[];
  positions: Position[];
  leaveRequests: LeaveRecord[];
  weekStart: string;
  holidays: Holiday[];
}

export function MyPersonalScheduleView({
  currentStaff,
  weeklySchedule,
  positions,
  leaveRequests,
  weekStart,
  holidays,
}: MyPersonalScheduleViewProps) {
  // Lấy ngày hiện tại theo múi giờ Việt Nam
  const todayStr = useMemo(() => {
    const vnDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    return format(vnDate, "yyyy-MM-dd");
  }, []);

  // Map vị trí để tra cứu nhanh theo ID
  const positionMap = useMemo(() => {
    return new Map(positions.map((p) => [p.id, p]));
  }, [positions]);

  // Bộ kiểm tra xung đột / lịch nghỉ phép của nhân sự
  const leaveChecker = useMemo(() => {
    return createLeaveConflictChecker(leaveRequests);
  }, [leaveRequests]);

  // Lọc tất cả phân công của cá nhân trong tuần đang chọn
  const myWeekAssignments = useMemo(() => {
    return weeklySchedule.filter(
      (a) => a.staffId === currentStaff.id && a.weekStart === weekStart && a.status === "published",
    );
  }, [weeklySchedule, currentStaff.id, weekStart]);

  // Danh sách 6 ngày làm việc trong tuần (Thứ 2 đến Thứ 7)
  const weekDates = useMemo(() => {
    return getWeekDates(weekStart);
  }, [weekStart]);

  // Tính ngày tuần trước và tuần sau
  const prevWeek = useMemo(() => {
    return format(subDays(parseISO(weekStart), 7), "yyyy-MM-dd");
  }, [weekStart]);

  const nextWeek = useMemo(() => {
    return format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd");
  }, [weekStart]);

  // Phân tích ca trực hôm nay của nhân sự
  const todayInfo = useMemo(() => {
    const morningAssign = weeklySchedule.find(
      (a) => a.staffId === currentStaff.id && a.date === todayStr && a.shift === "morning" && a.status === "published",
    );
    const afternoonAssign = weeklySchedule.find(
      (a) => a.staffId === currentStaff.id && a.date === todayStr && a.shift === "afternoon" && a.status === "published",
    );

    const morningLeave = leaveChecker.check(currentStaff.id, todayStr, "morning");
    const afternoonLeave = leaveChecker.check(currentStaff.id, todayStr, "afternoon");

    const morningOff = isOffDay(todayStr, "morning", holidays);
    const afternoonOff = isOffDay(todayStr, "afternoon", holidays);

    return {
      morning: {
        assign: morningAssign,
        position: morningAssign ? positionMap.get(morningAssign.positionId) : null,
        leave: morningLeave,
        isOff: morningOff,
        isOvertime: isOvertimeSlot(todayStr, "morning"),
      },
      afternoon: {
        assign: afternoonAssign,
        position: afternoonAssign ? positionMap.get(afternoonAssign.positionId) : null,
        leave: afternoonLeave,
        isOff: afternoonOff,
        isOvertime: false,
      },
    };
  }, [weeklySchedule, currentStaff.id, todayStr, leaveChecker, holidays, positionMap]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 1. THANH CHUYỂN TUẦN & TIÊU ĐỀ LỊCH (MOBILE OPTIMIZED) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">
              Lịch Làm Việc Cá Nhân
            </h2>
            <p className="text-xs text-slate-500">
              Tuần từ {formatDate(weekStart)} đến {formatDate(format(addDays(parseISO(weekStart), 5), "yyyy-MM-dd"))}
            </p>
          </div>
        </div>

        {/* Nút điều hướng tuần */}
        <div className="flex items-center justify-between gap-1.5 sm:justify-end">
          <Link
            href={`/dang-ky-phep?tab=my-schedule&week=${prevWeek}`}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden xs:inline">Tuần trước</span>
          </Link>

          <Link
            href="/dang-ky-phep?tab=my-schedule"
            className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-200 active:scale-95"
          >
            Hiện tại
          </Link>

          <Link
            href={`/dang-ky-phep?tab=my-schedule&week=${nextWeek}`}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
          >
            <span className="hidden xs:inline">Tuần sau</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* 2. THẺ NỔI BẬT: CA TRỰC HÔM NAY (TODAY SHIFT HIGHLIGHT) */}
      <div className="relative overflow-hidden rounded-[24px] border border-teal-200/90 bg-gradient-to-br from-teal-500 to-teal-700 p-4 sm:p-6 text-white shadow-lg shadow-teal-700/15">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-emerald-400/20 blur-2xl" />

        <div className="relative space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-teal-50 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Ca trực hôm nay · {formatDate(todayStr, "EEEE, dd/MM/yyyy")}
            </span>
            <span className="text-xs font-medium text-teal-100">
              {currentStaff.name} ({currentStaff.code})
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Ca sáng hôm nay */}
            <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-md border border-white/15">
              <div className="flex items-center justify-between text-xs font-semibold text-teal-100">
                <span className="flex items-center gap-1.5">
                  <Sun className="h-4 w-4 text-amber-300" />
                  Ca Sáng (07:00 - 11:30)
                </span>
                {todayInfo.morning.isOvertime && (
                  <span className="rounded bg-amber-400/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                    Tăng ca
                  </span>
                )}
              </div>
              <div className="mt-2 text-sm font-bold sm:text-base">
                {todayInfo.morning.leave ? (
                  <span className="inline-flex items-center gap-1 text-rose-200">
                    <AlertCircle className="h-4 w-4" />
                    Nghỉ {LEAVE_REASON_LABELS[todayInfo.morning.leave.reason].toLowerCase()}
                  </span>
                ) : todayInfo.morning.position ? (
                  <div className="space-y-0.5">
                    <p className="text-white">{todayInfo.morning.position.name}</p>
                    <p className="flex items-center gap-1 text-xs font-normal text-teal-100">
                      <MapPin className="h-3 w-3" />
                      {todayInfo.morning.position.area}
                    </p>
                  </div>
                ) : todayInfo.morning.isOff ? (
                  <span className="text-teal-200 font-normal">Nghỉ lễ / Nghỉ quy định</span>
                ) : (
                  <span className="text-teal-200/80 font-normal">Chưa phân công</span>
                )}
              </div>
            </div>

            {/* Ca chiều hôm nay */}
            <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-md border border-white/15">
              <div className="flex items-center justify-between text-xs font-semibold text-teal-100">
                <span className="flex items-center gap-1.5">
                  <Sunset className="h-4 w-4 text-orange-300" />
                  Ca Chiều (13:00 - 16:30)
                </span>
              </div>
              <div className="mt-2 text-sm font-bold sm:text-base">
                {todayInfo.afternoon.leave ? (
                  <span className="inline-flex items-center gap-1 text-rose-200">
                    <AlertCircle className="h-4 w-4" />
                    Nghỉ {LEAVE_REASON_LABELS[todayInfo.afternoon.leave.reason].toLowerCase()}
                  </span>
                ) : todayInfo.afternoon.position ? (
                  <div className="space-y-0.5">
                    <p className="text-white">{todayInfo.afternoon.position.name}</p>
                    <p className="flex items-center gap-1 text-xs font-normal text-teal-100">
                      <MapPin className="h-3 w-3" />
                      {todayInfo.afternoon.position.area}
                    </p>
                  </div>
                ) : todayInfo.afternoon.isOff ? (
                  <span className="text-teal-200 font-normal">Nghỉ quy định</span>
                ) : (
                  <span className="text-teal-200/80 font-normal">Chưa phân công</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. DÒNG THỜI GIAN CẢ TUẦN THEO TỪNG BUỔI (WEEKLY TIMELINE) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Lịch phân công theo ngày (Thứ 2 - Thứ 7)
          </h3>
          <span className="text-xs text-slate-400">
            Tổng cộng: {myWeekAssignments.length} ca làm việc
          </span>
        </div>

        <div className="space-y-3">
          {weekDates.map((day) => {
            const isToday = day.date === todayStr;

            // Tìm phân công ca sáng & ca chiều
            const morningAssign = myWeekAssignments.find(
              (a) => a.date === day.date && a.shift === "morning",
            );
            const afternoonAssign = myWeekAssignments.find(
              (a) => a.date === day.date && a.shift === "afternoon",
            );

            // Kiểm tra nghỉ phép
            const morningLeave = leaveChecker.check(currentStaff.id, day.date, "morning");
            const afternoonLeave = leaveChecker.check(currentStaff.id, day.date, "afternoon");

            // Kiểm tra ngày nghỉ mặc định / lễ
            const morningOff = isOffDay(day.date, "morning", holidays);
            const afternoonOff = isOffDay(day.date, "afternoon", holidays);

            const isSaturdayMorningOT = isOvertimeSlot(day.date, "morning");

            return (
              <div
                key={day.date}
                className={`overflow-hidden rounded-2xl border transition-all ${
                  isToday
                    ? "border-teal-500 bg-white ring-2 ring-teal-500/20 shadow-md"
                    : "border-slate-200/80 bg-white hover:border-slate-300 shadow-sm"
                }`}
              >
                {/* Header ngày */}
                <div
                  className={`flex items-center justify-between border-b px-4 py-2.5 ${
                    isToday
                      ? "border-teal-100 bg-teal-50/70"
                      : "border-slate-100 bg-slate-50/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {WEEKDAY_LABELS[day.weekday]} · {day.label}
                    </span>
                    {isToday && (
                      <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        Hôm nay
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">
                    {formatDate(day.date, "yyyy")}
                  </span>
                </div>

                {/* Danh sách 2 buổi trong ngày */}
                <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  {/* BUỔI SÁNG */}
                  <div className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                        Sáng (07:00 - 11:30)
                      </span>
                      {isSaturdayMorningOT && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          Tăng ca T7
                        </span>
                      )}
                    </div>

                    {morningLeave ? (
                      <div className="rounded-xl bg-rose-50 p-2.5 border border-rose-200/80 text-xs text-rose-800 flex items-center justify-between">
                        <span className="font-semibold">
                          Nghỉ phép ({LEAVE_REASON_LABELS[morningLeave.reason]})
                        </span>
                        <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-900">
                          {morningLeave.status === "approved" ? "Đã duyệt" : "Chờ duyệt"}
                        </span>
                      </div>
                    ) : morningAssign ? (
                      <div className="rounded-xl bg-teal-50/60 p-2.5 border border-teal-200/70 space-y-1">
                        <p className="text-xs font-bold text-teal-950">
                          {positionMap.get(morningAssign.positionId)?.name || "Vị trí trực"}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] text-teal-700">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {positionMap.get(morningAssign.positionId)?.area || "Khu vực"}
                        </p>
                        {morningAssign.note && (
                          <p className="text-[10px] text-slate-500 italic mt-0.5">
                            Ghi chú: {morningAssign.note}
                          </p>
                        )}
                      </div>
                    ) : morningOff ? (
                      <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-400 italic">
                        Nghỉ quy định / Lễ
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl bg-slate-50/70 p-2.5 text-xs text-slate-400">
                        <span>Chưa xếp vị trí</span>
                        <Link
                          href={`/dang-ky-phep?tab=register&date=${day.date}&shift=morning`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-800 hover:underline"
                        >
                          <CalendarCheck className="h-3 w-3" />
                          Xin nghỉ
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* BUỔI CHIỀU */}
                  <div className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <Sunset className="h-3.5 w-3.5 text-orange-500" />
                        Chiều (13:00 - 16:30)
                      </span>
                    </div>

                    {afternoonLeave ? (
                      <div className="rounded-xl bg-rose-50 p-2.5 border border-rose-200/80 text-xs text-rose-800 flex items-center justify-between">
                        <span className="font-semibold">
                          Nghỉ phép ({LEAVE_REASON_LABELS[afternoonLeave.reason]})
                        </span>
                        <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-900">
                          {afternoonLeave.status === "approved" ? "Đã duyệt" : "Chờ duyệt"}
                        </span>
                      </div>
                    ) : afternoonAssign ? (
                      <div className="rounded-xl bg-teal-50/60 p-2.5 border border-teal-200/70 space-y-1">
                        <p className="text-xs font-bold text-teal-950">
                          {positionMap.get(afternoonAssign.positionId)?.name || "Vị trí trực"}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] text-teal-700">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {positionMap.get(afternoonAssign.positionId)?.area || "Khu vực"}
                        </p>
                        {afternoonAssign.note && (
                          <p className="text-[10px] text-slate-500 italic mt-0.5">
                            Ghi chú: {afternoonAssign.note}
                          </p>
                        )}
                      </div>
                    ) : afternoonOff ? (
                      <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-400 italic">
                        {day.weekday === 6 ? "Chiều Thứ 7 nghỉ theo quy định" : "Nghỉ quy định / Lễ"}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl bg-slate-50/70 p-2.5 text-xs text-slate-400">
                        <span>Chưa xếp vị trí</span>
                        <Link
                          href={`/dang-ky-phep?tab=register&date=${day.date}&shift=afternoon`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-800 hover:underline"
                        >
                          <CalendarCheck className="h-3 w-3" />
                          Xin nghỉ
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
