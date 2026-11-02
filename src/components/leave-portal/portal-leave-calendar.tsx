"use client";

import { useState } from "react";
import { format, parseISO, startOfToday, isSameDay, addDays, isWithinInterval } from "date-fns";
import { vi } from "date-fns/locale";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  UserCheck,
  ShieldCheck,
  Sun,
  Sunset,
  CalendarRange,
  GraduationCap,
  HeartCrack,
  Palmtree,
  FileQuestion,
} from "lucide-react";
import type { LeaveReason, LeaveRecord, LeaveShift, StaffMember } from "@/lib/types";

interface PortalLeaveCalendarProps {
  currentStaff: StaffMember;
  allStaff: StaffMember[];
  allLeaves: LeaveRecord[];
}

// Cấu hình nhãn và màu sắc ca làm việc (S / C / CN)
const SHIFT_CONFIG: Record<
  LeaveShift,
  {
    code: string;
    label: string;
    badgeBg: string;
    icon: typeof Sun;
    desc: string;
  }
> = {
  morning: {
    code: "S",
    label: "Ca Sáng (S)",
    badgeBg: "bg-amber-500 text-white shadow-sm ring-1 ring-amber-600/20",
    icon: Sun,
    desc: "Buổi sáng",
  },
  afternoon: {
    code: "C",
    label: "Ca Chiều (C)",
    badgeBg: "bg-blue-600 text-white shadow-sm ring-1 ring-blue-700/20",
    icon: Sunset,
    desc: "Buổi chiều",
  },
  "full-day": {
    code: "CN",
    label: "Cả Ngày (CN)",
    badgeBg: "bg-purple-700 text-white shadow-sm ring-1 ring-purple-800/20",
    icon: CalendarRange,
    desc: "Trọn cả ngày",
  },
};

// Cấu hình nhãn và phân biệt màu sắc loại nghỉ phép
const REASON_CONFIG: Record<
  LeaveReason,
  {
    label: string;
    badge: string;
    border: string;
    dot: string;
    icon: typeof Palmtree;
  }
> = {
  phep: {
    label: "Nghỉ phép",
    badge: "bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold",
    border: "border-l-emerald-500",
    dot: "bg-emerald-500",
    icon: Palmtree,
  },
  om: {
    label: "Nghỉ ốm",
    badge: "bg-rose-100 text-rose-900 border border-rose-300 font-bold",
    border: "border-l-rose-500",
    dot: "bg-rose-500",
    icon: HeartCrack,
  },
  dihoc: {
    label: "Đi học",
    badge: "bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold",
    border: "border-l-indigo-500",
    dot: "bg-indigo-500",
    icon: GraduationCap,
  },
  khac: {
    label: "Việc riêng",
    badge: "bg-slate-100 text-slate-900 border border-slate-300 font-medium",
    border: "border-l-slate-400",
    dot: "bg-slate-400",
    icon: FileQuestion,
  },
};

export function PortalLeaveCalendar({
  currentStaff,
  allStaff,
  allLeaves,
}: PortalLeaveCalendarProps) {
  const today = startOfToday();
  const [horizonDays, setHorizonDays] = useState<number>(14);

  // 1. Phiếu của nhân sự đang đăng nhập (sắp xếp theo ngày)
  const myLeaves = allLeaves
    .filter((l) => l.staffId === currentStaff.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  // 2. Lịch các thành viên: chỉ lấy các ca ĐÃ DUYỆT (approved hoặc cũ) trong khoảng thời gian horizonDays
  const horizonEnd = addDays(today, horizonDays);
  const approvedMemberLeaves = allLeaves
    .filter((l) => {
      try {
        const d = parseISO(l.date);
        const isApproved = l.status === "approved" || !l.status;
        const inWindow = isWithinInterval(d, { start: today, end: horizonEnd });
        return isApproved && inWindow;
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Nhóm theo ngày
  const groupedByDate = new Map<string, LeaveRecord[]>();
  approvedMemberLeaves.forEach((leave) => {
    const list = groupedByDate.get(leave.date) ?? [];
    list.push(leave);
    groupedByDate.set(leave.date, list);
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* KHỐI CHÚ THÍCH MÀU SẮC & KÝ HIỆU CA (RESPONSIVE LEGEND) */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Bảng chú thích phân biệt màu sắc & Ký hiệu ca
        </p>
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          {/* Phân loại nghỉ */}
          <div className="space-y-1.5 sm:space-y-2">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-700 block">
              Loại nghỉ phép:
            </span>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold text-emerald-900 border border-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                Nghỉ phép
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold text-rose-900 border border-rose-300">
                <span className="h-2 w-2 rounded-full bg-rose-600"></span>
                Nghỉ ốm
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-100 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold text-indigo-900 border border-indigo-300">
                <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
                Đi học
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-slate-800 border border-slate-300">
                <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                Việc riêng / Khác
              </span>
            </div>
          </div>

          {/* Phân loại ca */}
          <div className="space-y-1.5 sm:space-y-2">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-700 block">
              Ký hiệu ca làm việc:
            </span>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2 sm:px-2.5 py-1 text-xs font-black text-white shadow-sm">
                S <span className="font-medium text-[10px] sm:text-[11px] opacity-90">(Ca Sáng)</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 sm:px-2.5 py-1 text-xs font-black text-white shadow-sm">
                C <span className="font-medium text-[10px] sm:text-[11px] opacity-90">(Ca Chiều)</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-purple-700 px-2 sm:px-2.5 py-1 text-xs font-black text-white shadow-sm">
                CN <span className="font-medium text-[10px] sm:text-[11px] opacity-90">(Cả Ngày)</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KHỐI 1: PHIẾU NGHỈ PHÉP CỦA BẠN (RESPONSIVE) */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-7 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 sm:mb-5">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
              <UserCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">Phiếu nghỉ của bạn</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">Các ca nghỉ bạn đã đăng ký trên hệ thống</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-0.5 sm:py-1 text-xs font-bold text-slate-700">
            {myLeaves.length} ca
          </span>
        </div>

        {myLeaves.length > 0 ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {myLeaves.map((leave) => {
              const isPending = leave.status === "pending";
              let dateFormatted = leave.date;
              try {
                dateFormatted = format(parseISO(leave.date), "dd/MM/yyyy (EEEE)", { locale: vi });
              } catch {}

              const shift = SHIFT_CONFIG[leave.shift] || SHIFT_CONFIG["full-day"];
              const reason = REASON_CONFIG[leave.reason] || REASON_CONFIG.phep;

              return (
                <div
                  key={leave.id}
                  className={`rounded-2xl border-2 p-3.5 sm:p-4 transition shadow-sm ${
                    isPending
                      ? "border-amber-300 bg-amber-50/40"
                      : "border-slate-200 bg-white hover:border-teal-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-xs font-bold text-slate-900 capitalize truncate">{dateFormatted}</span>
                    {isPending ? (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-white shadow-sm">
                        <Clock className="h-3 w-3" />
                        Chờ duyệt
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-white shadow-sm">
                        <CheckCircle2 className="h-3 w-3" />
                        Đã duyệt
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    {/* Badge loại nghỉ */}
                    <span className={`rounded-lg px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs ${reason.badge}`}>
                      {reason.label}
                    </span>

                    {/* Badge ca S / C / CN */}
                    <span className={`rounded-lg px-2.5 sm:px-3 py-0.5 sm:py-1 text-xs font-black tracking-wide ${shift.badgeBg}`}>
                      {shift.code} · <span className="font-medium text-[10px] sm:text-[11px]">{shift.desc}</span>
                    </span>
                  </div>

                  {leave.note && (
                    <p className="mt-2 text-[11px] sm:text-xs text-slate-500 italic truncate pt-1">
                      Ghi chú: {leave.note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 sm:py-8 text-center text-xs sm:text-sm text-slate-400">
            Bạn chưa có ca nghỉ phép nào trong hệ thống.
          </div>
        )}
      </div>

      {/* KHỐI 2: LỊCH ĐÃ ĐĂNG KÝ PHÉP CỦA CÁC THÀNH VIÊN (RESPONSIVE) */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-7 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 mb-5 sm:mb-6">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-teal-600 shrink-0" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Lịch nghỉ của các thành viên (Hiện tại & Tương lai)
              </h3>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0" />
              Hiển thị rõ <strong>loại nghỉ</strong> và <strong>ca trực</strong> (S/C/CN). Ẩn lý do chi tiết cá nhân.
            </p>
          </div>

          {/* Chọn biên độ thời gian (Mobile Full Width Grid / Desktop Inline Flex) */}
          <div className="w-full sm:w-auto grid grid-cols-3 rounded-xl sm:rounded-2xl bg-slate-100 p-1 text-xs font-bold sm:inline-flex">
            <button
              type="button"
              onClick={() => setHorizonDays(7)}
              className={`rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 transition text-center ${
                horizonDays === 7 ? "bg-white text-teal-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              7 ngày tới
            </button>
            <button
              type="button"
              onClick={() => setHorizonDays(14)}
              className={`rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 transition text-center ${
                horizonDays === 14 ? "bg-white text-teal-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              14 ngày tới
            </button>
            <button
              type="button"
              onClick={() => setHorizonDays(30)}
              className={`rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 transition text-center ${
                horizonDays === 30 ? "bg-white text-teal-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              30 ngày tới
            </button>
          </div>
        </div>

        {groupedByDate.size > 0 ? (
          <div className="grid gap-3.5 sm:gap-4 lg:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...groupedByDate.entries()].map(([dateStr, leaves]) => {
              const dateObj = parseISO(dateStr);
              const isDayToday = isSameDay(dateObj, today);
              const dayLabel = format(dateObj, "EEEE", { locale: vi });
              const dateLabel = format(dateObj, "dd/MM/yyyy");

              return (
                <div
                  key={dateStr}
                  className={`rounded-2xl sm:rounded-3xl border-2 p-3.5 sm:p-4 lg:p-5 shadow-sm transition-all hover:shadow-md ${
                    isDayToday
                      ? "border-teal-400 bg-gradient-to-b from-teal-50/70 to-white ring-2 ring-teal-500/20"
                      : "border-slate-200/80 bg-white"
                  }`}
                >
                  {/* Header ngày tháng */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div
                        className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl text-sm sm:text-base font-black shadow-sm ${
                          isDayToday ? "bg-teal-600 text-white" : "bg-slate-900 text-white"
                        }`}
                      >
                        {dateStr.slice(8, 10)}
                      </div>
                      <div>
                        <p className="text-xs font-bold capitalize text-slate-900 leading-tight">{dayLabel}</p>
                        <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500">{dateLabel}</p>
                      </div>
                    </div>
                    {isDayToday ? (
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                        Hôm nay
                      </span>
                    ) : (
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">
                        {leaves.length} người
                      </span>
                    )}
                  </div>

                  {/* Danh sách các nhân sự nghỉ trong ngày */}
                  <div className="space-y-2 sm:space-y-2.5">
                    {leaves.map((l) => {
                      const person = allStaff.find((s) => s.id === l.staffId);
                      const isMe = person?.id === currentStaff.id;
                      const shift = SHIFT_CONFIG[l.shift] || SHIFT_CONFIG["full-day"];
                      const reason = REASON_CONFIG[l.reason] || REASON_CONFIG.phep;

                      return (
                        <div
                          key={l.id}
                          className={`rounded-xl sm:rounded-2xl border border-l-4 p-2 sm:p-2.5 transition ${reason.border} ${
                            isMe
                              ? "bg-teal-50/90 border-teal-300 ring-1 ring-teal-400/40"
                              : "bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/80"
                          }`}
                        >
                          {/* Hàng 1: Tên nhân sự */}
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <span className="truncate text-xs font-bold text-slate-900">
                              {person?.name || l.staffId}
                              {isMe && <span className="ml-1 text-teal-700 font-extrabold">(Bạn)</span>}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 shrink-0">
                              {person?.code || ""}
                            </span>
                          </div>

                          {/* Hàng 2: Huy hiệu Loại nghỉ & Ca S/C/CN rõ nét */}
                          <div className="flex items-center justify-between gap-1.5 pt-1">
                            {/* Loại nghỉ (Phép, Ốm, Đi học, Khác) */}
                            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 sm:px-2 py-0.5 text-[10px] ${reason.badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${reason.dot}`}></span>
                              {reason.label}
                            </span>

                            {/* Ca nghỉ (S, C, CN) */}
                            <span
                              title={shift.label}
                              className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-black ${shift.badgeBg}`}
                            >
                              {shift.code}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 sm:py-16 text-center text-xs sm:text-sm text-slate-400">
            Không có thành viên nào đăng ký nghỉ trong khoảng thời gian {horizonDays} ngày tới.
          </div>
        )}
      </div>
    </div>
  );
}