"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  
  Palmtree,
  GraduationCap,
  HeartCrack,
  Info,
  Calendar,
  Sparkles,
} from "lucide-react";
import type { LeaveRecord, StaffMember } from "@/lib/types";

interface MyLeaveStatsViewProps {
  currentStaff: StaffMember;
  allLeaves: LeaveRecord[];
  yearlyStats: {
    year: number;
    totalDays: number;
    totalSessions: number;
    leavesCount: number;
  };
}

export function MyLeaveStatsView({
  currentStaff,
  allLeaves,
  yearlyStats,
}: MyLeaveStatsViewProps) {
  const currentYear = yearlyStats.year;
  const yearPrefix = `${currentYear}-`;

  // 1. Toàn bộ các ca nghỉ của cá nhân trong năm
  const myYearLeaves = allLeaves.filter(
    (l) => l.staffId === currentStaff.id && l.date.startsWith(yearPrefix),
  );

  // 2. Ca nghỉ phép (phep):
  // - Đã duyệt (tính vào quỹ phép)
  const approvedPaidLeaves = myYearLeaves
    .filter((l) => {
      const isApproved = l.status === "approved" || !l.status;
      if (!isApproved || l.reason !== "phep") return false;
      try {
        const d = parseISO(l.date).getDay();
        return d !== 0 && d !== 6; // Bỏ qua Thứ 7, CN
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // - Chờ duyệt (pending)
  const pendingPaidLeaves = myYearLeaves
    .filter((l) => l.status === "pending" && l.reason === "phep")
    .sort((a, b) => a.date.localeCompare(b.date));

  // 3. Các ca không tính trừ phép (Đi học / Nghỉ ốm)
  const dihocLeaves = myYearLeaves.filter((l) => l.reason === "dihoc");
  const dihocSessions = dihocLeaves.reduce(
    (acc, l) => acc + (l.shift === "full-day" ? 2 : 1),
    0,
  );

  const omLeaves = myYearLeaves.filter((l) => l.reason === "om");
  const omSessions = omLeaves.reduce(
    (acc, l) => acc + (l.shift === "full-day" ? 2 : 1),
    0,
  );

  // Bộ lọc xem: "all" (Tất cả) | "approved" (Đã duyệt) | "pending" (Chờ duyệt)
  const [filterStatus, setFilterStatus] = useState<"all" | "approved" | "pending">("all");

  const displayPaidLeaves =
    filterStatus === "approved"
      ? approvedPaidLeaves
      : filterStatus === "pending"
      ? pendingPaidLeaves
      : [...approvedPaidLeaves, ...pendingPaidLeaves].sort((a, b) =>
          a.date.localeCompare(b.date),
        );

  return (
    <div className="space-y-6">
      {/* KHỐI 1: TỔNG QUAN QUỸ PHÉP & CÁC CHỈ SỐ NGHỈ TRONG NĂM */}
      <div className="rounded-2xl sm:rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50/80 via-white to-slate-50 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-teal-100/80 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100/90 px-3 py-1 text-xs font-bold text-teal-800">
              <Sparkles className="h-3.5 w-3.5 text-teal-600" />
              Thống kê quỹ phép cá nhân
            </span>
            <h2 className="mt-1 text-xl sm:text-2xl font-black text-slate-900">
              {currentStaff.name} <span className="text-slate-400 font-medium">({currentStaff.code})</span>
            </h2>
            <p className="text-xs text-slate-500 sm:text-sm">
              Tài khoản: <span className="font-semibold text-slate-700">{currentStaff.email}</span>
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl bg-white border border-teal-200 px-4 py-2 text-xs font-bold text-teal-900 shadow-sm self-start sm:self-auto">
            <Calendar className="h-4 w-4 text-teal-600" />
            Năm tài khóa: {currentYear}
          </div>
        </div>

        {/* 3 Thẻ chỉ số tổng hợp */}
        <div className="grid gap-3.5 sm:gap-4 sm:grid-cols-3 pt-4">
          {/* Thẻ 1: Nghỉ phép năm (Tính trừ phép) */}
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <Palmtree className="h-4 w-4 text-emerald-600" />
                Nghỉ phép (Đã duyệt)
              </span>
              <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                Tính trừ phép
              </span>
            </div>
            <p className="mt-2 text-3xl font-black text-emerald-700">
              {yearlyStats.totalDays} <span className="text-sm font-semibold text-emerald-900">ngày</span>
            </p>
            <p className="text-xs text-emerald-800 mt-0.5">
              Tương đương <strong>{yearlyStats.totalSessions} buổi</strong> (2 buổi = 1 ngày)
            </p>
            {pendingPaidLeaves.length > 0 && (
              <p className="mt-2 text-[11px] font-bold text-amber-700 flex items-center gap-1 pt-2 border-t border-emerald-200">
                <Clock className="h-3 w-3" />
                Đang chờ duyệt: {pendingPaidLeaves.length} ca
              </p>
            )}
          </div>

          {/* Thẻ 2: Đi học (Không trừ phép) */}
          <div className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-indigo-600" />
                Đi học đào tạo
              </span>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                Không trừ phép
              </span>
            </div>
            <p className="mt-2 text-3xl font-black text-indigo-700">
              {dihocSessions} <span className="text-sm font-semibold text-slate-600">buổi</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Tổng cộng <strong>{dihocLeaves.length} đợt/ca</strong> đi học
            </p>
          </div>

          {/* Thẻ 3: Nghỉ ốm (Không trừ phép) */}
          <div className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                <HeartCrack className="h-4 w-4 text-rose-600" />
                Nghỉ ốm / BHXH
              </span>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                Không trừ phép
              </span>
            </div>
            <p className="mt-2 text-3xl font-black text-rose-700">
              {omSessions} <span className="text-sm font-semibold text-slate-600">buổi</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Hưởng chế độ bảo hiểm y tế / ốm đau
            </p>
          </div>
        </div>
      </div>

      {/* KHỐI 2: BẢNG KÊ CHI TIẾT CÁC NGÀY NGHỈ TÍNH PHÉP TRONG NĂM */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-7 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 mb-5">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-teal-600" />
              Chi tiết các ngày nghỉ tính phép năm {currentYear}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Danh sách kê khai minh bạch từng ca nghỉ, số ngày trừ phép và trạng thái duyệt.
            </p>
          </div>

          {/* Bộ lọc trạng thái */}
          <div className="w-full sm:w-auto grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-xs font-bold sm:inline-flex">
            <button
              type="button"
              onClick={() => setFilterStatus("all")}
              className={`rounded-lg px-3 py-1.5 transition text-center ${
                filterStatus === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tất cả ({approvedPaidLeaves.length + pendingPaidLeaves.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("approved")}
              className={`rounded-lg px-3 py-1.5 transition text-center ${
                filterStatus === "approved" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Đã duyệt ({approvedPaidLeaves.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("pending")}
              className={`rounded-lg px-3 py-1.5 transition text-center ${
                filterStatus === "pending" ? "bg-white text-amber-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Chờ duyệt ({pendingPaidLeaves.length})
            </button>
          </div>
        </div>

        {displayPaidLeaves.length > 0 ? (
          <div className="space-y-4">
            {/* Bảng trên Desktop & Tablet */}
            <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-3 px-3.5 text-center w-12">STT</th>
                    <th className="py-3 px-4">Ngày nghỉ (dd/mm/yyyy)</th>
                    <th className="py-3 px-4 text-center">Ca làm việc</th>
                    <th className="py-3 px-4 text-center">Số ngày tính phép</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayPaidLeaves.map((leave, idx) => {
                    const isApproved = leave.status === "approved" || !leave.status;
                    let dateLabel = leave.date;
                    try {
                      dateLabel = format(parseISO(leave.date), "dd/MM/yyyy (EEEE)", { locale: vi });
                    } catch {}

                    const daysDeducted = leave.shift === "full-day" ? 1.0 : 0.5;

                    return (
                      <tr key={leave.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3.5 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 capitalize">
                          {dateLabel}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {leave.shift === "morning" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-black text-white shadow-sm">
                              S · Sáng
                            </span>
                          )}
                          {leave.shift === "afternoon" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-black text-white shadow-sm">
                              C · Chiều
                            </span>
                          )}
                          {leave.shift === "full-day" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-700 px-2 py-0.5 text-[11px] font-black text-white shadow-sm">
                              CN · Cả Ngày
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-extrabold text-teal-700 text-sm">
                            {daysDeducted.toFixed(1)} <span className="text-xs font-semibold text-slate-500">ngày</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />
                              Đã duyệt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                              <Clock className="h-3 w-3" />
                              Chờ duyệt
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 italic max-w-xs truncate">
                          {leave.note || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-teal-50/60 font-bold text-slate-800 border-t-2 border-teal-200">
                    <td colSpan={3} className="py-3 px-4 text-right">
                      Tổng số ngày tính phép (Đã duyệt chính thức):
                    </td>
                    <td className="py-3 px-4 text-center text-teal-800 text-base font-black">
                      {yearlyStats.totalDays} ngày ({yearlyStats.totalSessions} buổi)
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Danh sách thẻ trên Mobile */}
            <div className="sm:hidden space-y-3">
              {displayPaidLeaves.map((leave, idx) => {
                const isApproved = leave.status === "approved" || !leave.status;
                let dateLabel = leave.date;
                try {
                  dateLabel = format(parseISO(leave.date), "dd/MM/yyyy (EEEE)", { locale: vi });
                } catch {}

                const daysDeducted = leave.shift === "full-day" ? 1.0 : 0.5;

                return (
                  <div
                    key={leave.id}
                    className={`rounded-2xl border p-3.5 shadow-sm transition ${
                      isApproved ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-900 capitalize">
                          {dateLabel}
                        </span>
                      </div>
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Đã duyệt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          <Clock className="h-3 w-3" />
                          Chờ duyệt
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div>
                        {leave.shift === "morning" && (
                          <span className="inline-flex items-center rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-black text-white">
                            Ca Sáng (S)
                          </span>
                        )}
                        {leave.shift === "afternoon" && (
                          <span className="inline-flex items-center rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-black text-white">
                            Ca Chiều (C)
                          </span>
                        )}
                        {leave.shift === "full-day" && (
                          <span className="inline-flex items-center rounded-md bg-purple-700 px-2 py-0.5 text-[11px] font-black text-white">
                            Cả Ngày (CN)
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-slate-400 text-[11px]">Trừ phép: </span>
                        <span className="font-extrabold text-teal-700 text-sm">
                          {daysDeducted.toFixed(1)} ngày
                        </span>
                      </div>
                    </div>

                    {leave.note && (
                      <p className="mt-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500 italic truncate">
                        Ghi chú: {leave.note}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Tóm tắt chân trang mobile */}
              <div className="rounded-xl bg-teal-50 p-3 text-center text-xs font-bold text-teal-900 border border-teal-200">
                Tổng cộng đã duyệt tính phép: {yearlyStats.totalDays} ngày ({yearlyStats.totalSessions} buổi)
              </div>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-xs sm:text-sm text-slate-400">
            Chưa có ngày nghỉ phép nào phù hợp với bộ lọc trong năm {currentYear}.
          </div>
        )}
      </div>

      {/* KHỐI 3: LƯU Ý QUY ĐỊNH TÍNH PHÉP CỦA ĐƠN VỊ */}
      <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 sm:p-5 text-xs text-sky-950 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-sky-900 text-xs sm:text-sm">
          <Info className="h-4 w-4 text-sky-600 shrink-0" />
          Quy tắc thống kê & trừ quỹ phép năm theo quy chế:
        </div>
        <ul className="list-disc pl-5 space-y-1 text-slate-600 leading-relaxed text-[11px] sm:text-xs">
          <li>
            <strong>1 ngày phép = 2 buổi làm việc</strong>: Nghỉ buổi Sáng hoặc Chiều tính <strong>0.5 ngày</strong>; Nghỉ trọn ca Cả ngày tính <strong>1.0 ngày</strong>.
          </li>
          <li>
            <strong>Không tính phép vào Thứ 7 và Chủ nhật</strong>: Lịch trực cuối tuần theo chế độ làm thêm/trực tua riêng, không trừ vào quỹ phép năm.
          </li>
          <li>
            <strong>Đi học và Nghỉ ốm</strong>: Được theo dõi riêng theo diện đào tạo và chế độ bảo hiểm xã hội, <strong>hoàn toàn không trừ vào quỹ phép năm</strong> của nhân sự.
          </li>
        </ul>
      </div>
    </div>
  );
}