"use client";

import { useState, useMemo } from "react";
import {
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    addWeeks,
    addMonths,
    format,
    isSameMonth,
    isToday,
    getDay,
} from "date-fns";
import { vi } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface LeaveEntry {
    id: string;
    staffId: string;
    date: string;
    shift: "morning" | "afternoon" | "full-day";
    reason: string;
    note?: string;
}

interface StaffInfo {
    id: string;
    name: string;
    code: string;
}

interface LeaveCalendarProps {
    leaveRequests: LeaveEntry[];
    staff: StaffInfo[];
}

type ViewMode = "week" | "month";

const REASON_CONFIG = {
    phep: { fullLabel: "Phép", color: "bg-teal-100 text-teal-800 border-teal-200" },
    om: { fullLabel: "Ốm", color: "bg-rose-100 text-rose-800 border-rose-200" },
    dihoc: { fullLabel: "Đi học", color: "bg-amber-100 text-amber-800 border-amber-200" },
    khac: { fullLabel: "Khác", color: "bg-slate-100 text-slate-800 border-slate-200" },
} as const;

const SHIFT_LABELS_SHORT = {
    morning: "S",
    afternoon: "C",
    "full-day": "CN",
} as const;

const WEEKDAY_HEADERS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function LeaveCalendar({ leaveRequests, staff }: LeaveCalendarProps) {
    const [viewMode, setViewMode] = useState<ViewMode>("month");
    const [currentDate, setCurrentDate] = useState(() => new Date());

    const staffMap = useMemo(() => {
        const map = new Map<string, StaffInfo>();
        for (const s of staff) {
            map.set(s.id, s);
        }
        return map;
    }, [staff]);

    const leaveByDate = useMemo(() => {
        const map = new Map<string, LeaveEntry[]>();
        for (const leave of leaveRequests) {
            const existing = map.get(leave.date) || [];
            existing.push(leave);
            map.set(leave.date, existing);
        }
        return map;
    }, [leaveRequests]);

    const days = useMemo(() => {
        if (viewMode === "week") {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end });
        }

        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
        return eachDayOfInterval({ start: calStart, end: calEnd });
    }, [viewMode, currentDate]);

    const navigate = (direction: -1 | 1) => {
        if (viewMode === "week") {
            setCurrentDate((prev) => addWeeks(prev, direction));
        } else {
            setCurrentDate((prev) => addMonths(prev, direction));
        }
    };

    const goToToday = () => setCurrentDate(new Date());

    const title = useMemo(() => {
        if (viewMode === "week") {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return `${format(start, "dd/MM")} — ${format(end, "dd/MM/yyyy")}`;
        }
        const monthName = format(currentDate, "MMMM yyyy", { locale: vi });
        return monthName.charAt(0).toUpperCase() + monthName.slice(1);
    }, [viewMode, currentDate]);

    return (
        <div className="space-y-4">
            {/* Header: navigation + view toggle */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        aria-label="Kỳ trước"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <h3 className="min-w-[180px] text-center text-lg font-semibold text-slate-900">
                        {title}
                    </h3>
                    <button
                        type="button"
                        onClick={() => navigate(1)}
                        aria-label="Kỳ sau"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={goToToday}
                        className="ml-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                    >
                        Hôm nay
                    </button>
                </div>

                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                    {(["week", "month"] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setViewMode(mode)}
                            className={cn(
                                "rounded-lg px-4 py-1.5 text-sm font-medium transition",
                                viewMode === mode
                                    ? "bg-slate-950 text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-700",
                            )}
                        >
                            {mode === "week" ? "Tuần" : "Tháng"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs">
                {Object.entries(REASON_CONFIG).map(([key, config]) => (
                    <span key={key} className="flex items-center gap-1.5">
                        <span className={cn("inline-block h-3 w-3 rounded-full border", config.color)} />
                        <span className="text-slate-500">{config.fullLabel}</span>
                    </span>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-white">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                    {WEEKDAY_HEADERS.map((day) => (
                        <div
                            key={day}
                            className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-500"
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7">
                    {days.map((day, index) => {
                        const dateKey = format(day, "yyyy-MM-dd");
                        const dayLeaves = leaveByDate.get(dateKey) || [];
                        const inCurrentMonth = viewMode === "month" ? isSameMonth(day, currentDate) : true;
                        const today = isToday(day);
                        const isWeekend = getDay(day) === 0 || getDay(day) === 6;

                        return (
                            <div
                                key={dateKey}
                                className={cn(
                                    "relative border-b border-r border-slate-100 transition",
                                    viewMode === "week" ? "min-h-[160px]" : "min-h-[90px]",
                                    !inCurrentMonth && "bg-slate-50/60",
                                    isWeekend && inCurrentMonth && "bg-orange-50/30",
                                    index % 7 === 6 && "border-r-0",
                                )}
                            >
                                {/* Date number */}
                                <div className="flex items-center justify-between px-2 py-1.5">
                                    <span
                                        className={cn(
                                            "inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-medium",
                                            today
                                                ? "bg-teal-600 text-white"
                                                : !inCurrentMonth
                                                    ? "text-slate-300"
                                                    : "text-slate-600",
                                        )}
                                    >
                                        {format(day, "d")}
                                    </span>
                                    {dayLeaves.length > 0 && (
                                        <span className="text-[10px] font-medium text-slate-400">
                                            {dayLeaves.length}
                                        </span>
                                    )}
                                </div>

                                {/* Leave entries */}
                                <div className="space-y-0.5 px-1 pb-1">
                                    {dayLeaves.slice(0, viewMode === "week" ? 8 : 3).map((leave) => {
                                        const person = staffMap.get(leave.staffId);
                                        const reasonConfig = REASON_CONFIG[leave.reason as keyof typeof REASON_CONFIG] || REASON_CONFIG.khac;
                                        const shiftLabel = SHIFT_LABELS_SHORT[leave.shift as keyof typeof SHIFT_LABELS_SHORT];

                                        return (
                                            <div
                                                key={leave.id}
                                                title={`${person?.name ?? leave.staffId} — Lý do: ${reasonConfig.fullLabel}, Ca: ${leave.shift}${leave.note ? ` (${leave.note})` : ""}`}
                                                className={cn(
                                                    "flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-medium leading-tight",
                                                    reasonConfig.color,
                                                )}
                                            >
                                                <span className="truncate">
                                                    {person?.name ?? leave.staffId}
                                                </span>
                                                <span className="shrink-0 opacity-70">{shiftLabel}</span>
                                            </div>
                                        );
                                    })}
                                    {dayLeaves.length > (viewMode === "week" ? 8 : 3) && (
                                        <p className="px-1 text-[10px] text-slate-400">
                                            +{dayLeaves.length - (viewMode === "week" ? 8 : 3)} khác
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
