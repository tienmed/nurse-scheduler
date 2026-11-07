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

  // 1. ToÃ n bá»™ cÃ¡c ca nghá»‰ cá»§a cÃ¡ nhÃ¢n trong nÄƒm
  const myYearLeaves = allLeaves.filter(
    (l) => l.staffId === currentStaff.id && l.date.startsWith(yearPrefix),
  );

  // 2. Ca nghá»‰ phÃ©p (phep):
  // - ÄÃ£ duyá»‡t (tÃ­nh vÃ o quá»¹ phÃ©p)
  const approvedPaidLeaves = myYearLeaves
    .filter((l) => {
      const isApproved = l.status === "approved" || !l.status;
      if (!isApproved || l.reason !== "phep") return false;
      try {
        const d = parseISO(l.date).getDay();
        return d !== 0 && d !== 6; // Bá» qua Thá»© 7, CN
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // - Chá» duyá»‡t (pending)
  const pendingPaidLeaves = myYearLeaves
    .filter((l) => l.status === "pending" && l.reason === "phep")
    .sort((a, b) => a.date.localeCompare(b.date));

  // 3. CÃ¡c ca khÃ´ng tÃ­nh trá»« phÃ©p (Äi há»c / Nghá»‰ á»‘m)
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

  // Bá»™ lá»c xem: "all" (Táº¥t cáº£) | "approved" (ÄÃ£ duyá»‡t) | "pending" (Chá» duyá»‡t)
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
      {/* KHá»I 1: Tá»”NG QUAN QUá»¸ PHÃ‰P & CÃC CHá»ˆ Sá» NGHá»ˆ TRONG NÄ‚M */}
      <div className="rounded-2xl sm:rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50/80 via-white to-slate-50 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-teal-100/80 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100/90 px-3 py-1 text-xs font-bold text-teal-800">
              <Sparkles className="h-3.5 w-3.5 text-teal-600" />
              Thá»‘ng kÃª quá»¹ phÃ©p cÃ¡ nhÃ¢n
            </span>
            <h2 className="mt-1 text-xl sm:text-2xl font-black text-slate-900">
              {currentStaff.name} <span className="text-slate-400 font-medium">({currentStaff.code})</span>
            </h2>
            <p className="text-xs text-slate-500 sm:text-sm">
              TÃ i khoáº£n: <span className="font-semibold text-slate-700">{currentStaff.email}</span>
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl bg-white border border-teal-200 px-4 py-2 text-xs font-bold text-teal-900 shadow-sm self-start sm:self-auto">
            <Calendar className="h-4 w-4 text-teal-600" />
            NÄƒm tÃ i khÃ³a: {currentYear}
          </div>
        </div>

        {/* 3 Tháº» chá»‰ sá»‘ tá»•ng há»£p */}
        <div className="grid gap-3.5 sm:gap-4 sm:grid-cols-3 pt-4">
          {/* Tháº» 1: Nghá»‰ phÃ©p nÄƒm (TÃ­nh trá»« phÃ©p) */}
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <Palmtree className="h-4 w-4 text-emerald-600" />
                Nghá»‰ phÃ©p (ÄÃ£ duyá»‡t)
              </span>
              <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                TÃ­nh trá»« phÃ©p
              </span>
            </div>
            <p className="mt-2 text-3xl font-black text-emerald-700">
              {yearlyStats.totalDays} <span className="text-sm font-semibold text-emerald-900">ngÃ y</span>
            </p>
            <p className="text-xs text-emerald-800 mt-0.5">
              TÆ°Æ¡ng Ä‘Æ°Æ¡ng <strong>{yearlyStats.totalSessions} buá»•i</strong> (2 buá»•i = 1 ngÃ y)
            </p>
            {pendingPaidLeaves.length > 0 && (
              <p className="mt-2 text-[11px] font-bold text-amber-700 flex items-center gap-1 pt-2 border-t border-emerald-200">
                <Clock className="h-3 w-3" />
                Äang chá» duyá»‡t: {pendingPaidLeaves.length} ca
              </p>
            )}
          </div>

          {/* Tháº» 2: Äi há»c (KhÃ´ng trá»« phÃ©p) */}
          <div className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-indigo-600" />
                Äi há»c Ä‘Ã o táº¡o
              </span>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                KhÃ´ng trá»« phÃ©p
              </span>
            </div>
            <p className="mt-2 text-3xl font-black text-indigo-700">
              {dihocSessions} <span className="text-sm font-semibold text-slate-600">buá»•i</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Tá»•ng cá»™ng <strong>{dihocLeaves.length} Ä‘á»£t/ca</strong> Ä‘i há»c
            </p>
          </div>

          {/* Tháº» 3: Nghá»‰ á»‘m (KhÃ´ng trá»« phÃ©p) */}
          <div className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                <HeartCrack className="h-4 w-4 text-rose-600" />
                Nghá»‰ á»‘m / BHXH
              </span>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                KhÃ´ng trá»« phÃ©p
              </span>
            </div>
            <p className="mt-2 text-3xl font-black text-rose-700">
              {omSessions} <span className="text-sm font-semibold text-slate-600">buá»•i</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              HÆ°á»Ÿng cháº¿ Ä‘á»™ báº£o hiá»ƒm y táº¿ / á»‘m Ä‘au
            </p>
          </div>
        </div>
      </div>

      {/* KHá»I 2: Báº¢NG KÃŠ CHI TIáº¾T CÃC NGÃ€Y NGHá»ˆ TÃNH PHÃ‰P TRONG NÄ‚M */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-7 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 mb-5">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-teal-600" />
              Chi tiáº¿t cÃ¡c ngÃ y nghá»‰ tÃ­nh phÃ©p nÄƒm {currentYear}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Danh sÃ¡ch kÃª khai minh báº¡ch tá»«ng ca nghá»‰, sá»‘ ngÃ y trá»« phÃ©p vÃ  tráº¡ng thÃ¡i duyá»‡t.
            </p>
          </div>

          {/* Bá»™ lá»c tráº¡ng thÃ¡i */}
          <div className="w-full sm:w-auto grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-xs font-bold sm:inline-flex">
            <button
              type="button"
              onClick={() => setFilterStatus("all")}
              className={`rounded-lg px-3 py-1.5 transition text-center ${
                filterStatus === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Táº¥t cáº£ ({approvedPaidLeaves.length + pendingPaidLeaves.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("approved")}
              className={`rounded-lg px-3 py-1.5 transition text-center ${
                filterStatus === "approved" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ÄÃ£ duyá»‡t ({approvedPaidLeaves.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("pending")}
              className={`rounded-lg px-3 py-1.5 transition text-center ${
                filterStatus === "pending" ? "bg-white text-amber-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Chá» duyá»‡t ({pendingPaidLeaves.length})
            </button>
          </div>
        </div>

        {displayPaidLeaves.length > 0 ? (
          <div className="space-y-4">
            {/* Báº£ng trÃªn Desktop & Tablet */}
            <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-3 px-3.5 text-center w-12">STT</th>
                    <th className="py-3 px-4">NgÃ y nghá»‰ (dd/mm/yyyy)</th>
                    <th className="py-3 px-4 text-center">Ca lÃ m viá»‡c</th>
                    <th className="py-3 px-4 text-center">Sá»‘ ngÃ y tÃ­nh phÃ©p</th>
                    <th className="py-3 px-4 text-center">Tráº¡ng thÃ¡i</th>
                    <th className="py-3 px-4">Ghi chÃº</th>
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
                              S Â· SÃ¡ng
                            </span>
                          )}
                          {leave.shift === "afternoon" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-black text-white shadow-sm">
                              C Â· Chiá»u
                            </span>
                          )}
                          {leave.shift === "full-day" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-700 px-2 py-0.5 text-[11px] font-black text-white shadow-sm">
                              CN Â· Cáº£ NgÃ y
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-extrabold text-teal-700 text-sm">
                            {daysDeducted.toFixed(1)} <span className="text-xs font-semibold text-slate-500">ngÃ y</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />
                              ÄÃ£ duyá»‡t
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                              <Clock className="h-3 w-3" />
                              Chá» duyá»‡t
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 italic max-w-xs truncate">
                          {leave.note || "â€”"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-teal-50/60 font-bold text-slate-800 border-t-2 border-teal-200">
                    <td colSpan={3} className="py-3 px-4 text-right">
                      Tá»•ng sá»‘ ngÃ y tÃ­nh phÃ©p (ÄÃ£ duyá»‡t chÃ­nh thá»©c):
                    </td>
                    <td className="py-3 px-4 text-center text-teal-800 text-base font-black">
                      {yearlyStats.totalDays} ngÃ y ({yearlyStats.totalSessions} buá»•i)
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Danh sÃ¡ch tháº» trÃªn Mobile */}
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
                          ÄÃ£ duyá»‡t
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          <Clock className="h-3 w-3" />
                          Chá» duyá»‡t
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div>
                        {leave.shift === "morning" && (
                          <span className="inline-flex items-center rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-black text-white">
                            Ca SÃ¡ng (S)
                          </span>
                        )}
                        {leave.shift === "afternoon" && (
                          <span className="inline-flex items-center rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-black text-white">
                            Ca Chiá»u (C)
                          </span>
                        )}
                        {leave.shift === "full-day" && (
                          <span className="inline-flex items-center rounded-md bg-purple-700 px-2 py-0.5 text-[11px] font-black text-white">
                            Cáº£ NgÃ y (CN)
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-slate-400 text-[11px]">Trá»« phÃ©p: </span>
                        <span className="font-extrabold text-teal-700 text-sm">
                          {daysDeducted.toFixed(1)} ngÃ y
                        </span>
                      </div>
                    </div>

                    {leave.note && (
                      <p className="mt-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500 italic truncate">
                        Ghi chÃº: {leave.note}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* TÃ³m táº¯t chÃ¢n trang mobile */}
              <div className="rounded-xl bg-teal-50 p-3 text-center text-xs font-bold text-teal-900 border border-teal-200">
                Tá»•ng cá»™ng Ä‘Ã£ duyá»‡t tÃ­nh phÃ©p: {yearlyStats.totalDays} ngÃ y ({yearlyStats.totalSessions} buá»•i)
              </div>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-xs sm:text-sm text-slate-400">
            ChÆ°a cÃ³ ngÃ y nghá»‰ phÃ©p nÃ o phÃ¹ há»£p vá»›i bá»™ lá»c trong nÄƒm {currentYear}.
          </div>
        )}
      </div>

      {/* KHá»I 3: LÆ¯U Ã QUY Äá»ŠNH TÃNH PHÃ‰P Cá»¦A ÄÆ N Vá»Š */}
      <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 sm:p-5 text-xs text-sky-950 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-sky-900 text-xs sm:text-sm">
          <Info className="h-4 w-4 text-sky-600 shrink-0" />
          Quy táº¯c thá»‘ng kÃª & trá»« quá»¹ phÃ©p nÄƒm theo quy cháº¿:
        </div>
        <ul className="list-disc pl-5 space-y-1 text-slate-600 leading-relaxed text-[11px] sm:text-xs">
          <li>
            <strong>1 ngÃ y phÃ©p = 2 buá»•i lÃ m viá»‡c</strong>: Nghá»‰ buá»•i SÃ¡ng hoáº·c Chiá»u tÃ­nh <strong>0.5 ngÃ y</strong>; Nghá»‰ trá»n ca Cáº£ ngÃ y tÃ­nh <strong>1.0 ngÃ y</strong>.
          </li>
          <li>
            <strong>KhÃ´ng tÃ­nh phÃ©p vÃ o Thá»© 7 vÃ  Chá»§ nháº­t</strong>: Lá»‹ch trá»±c cuá»‘i tuáº§n theo cháº¿ Ä‘á»™ lÃ m thÃªm/trá»±c tua riÃªng, khÃ´ng trá»« vÃ o quá»¹ phÃ©p nÄƒm.
          </li>
          <li>
            <strong>Äi há»c vÃ  Nghá»‰ á»‘m</strong>: ÄÆ°á»£c theo dÃµi riÃªng theo diá»‡n Ä‘Ã o táº¡o vÃ  cháº¿ Ä‘á»™ báº£o hiá»ƒm xÃ£ há»™i, <strong>hoÃ n toÃ n khÃ´ng trá»« vÃ o quá»¹ phÃ©p nÄƒm</strong> cá»§a nhÃ¢n sá»±.
          </li>
        </ul>
      </div>
    </div>
  );
}