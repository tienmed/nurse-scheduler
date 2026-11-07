"use client";

import { useState, useTransition } from "react";
import { format, parseISO, isBefore, eachDayOfInterval } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar, Plus, Trash2, AlertTriangle, CheckCircle2, Clock, Send, Sparkles, UserCog } from "lucide-react";
import { LEAVE_SHIFT_LABELS } from "@/lib/constants";
import type { LeaveReason, LeaveRecord, LeaveShift, StaffMember } from "@/lib/types";
import { submitLeavePortalAction } from "@/app/dang-ky-phep/actions";

interface SlotItem {
  id: string;
  date: string;
  shift: LeaveShift;
  reason: LeaveReason;
  note: string;
}

interface FlexibleLeaveFormProps {
  currentStaff: StaffMember;
  allStaff?: StaffMember[];
  existingLeaves: LeaveRecord[];
  yearlyStats: {
    totalDays: number;
    totalSessions: number;
    year: number;
  };
  isAdmin?: boolean;
}

// [QWEN3] Helper tÃ­nh toÃ¡n quá»¹ phÃ©p nÄƒm cá»§a nhÃ¢n sá»± báº¥t ká»³
function calculateStaffYearlyStats(staffId: string, leaves: LeaveRecord[], year: number) {
  const yearPrefix = `${year}-`;
  const approvedLeaves = leaves.filter((l) => {
    if (l.staffId !== staffId) return false;
    if (l.status && l.status !== "approved") return false;
    if (l.reason !== "phep") return false;
    try {
      const d = parseISO(l.date).getDay();
      if (d === 0 || d === 6) return false; // KhÃ´ng tÃ­nh Thá»© 7 vÃ  Chá»§ nháº­t
    } catch {
      return false;
    }
    return l.date.startsWith(yearPrefix);
  });

  let totalSessions = 0;
  for (const l of approvedLeaves) {
    totalSessions += l.shift === "full-day" ? 2 : 1;
  }

  return {
    year,
    totalSessions,
    totalDays: totalSessions / 2,
    leavesCount: approvedLeaves.length,
  };
}

export function FlexibleLeaveForm({
  currentStaff,
  allStaff = [],
  existingLeaves,
  yearlyStats,
  isAdmin = false,
}: FlexibleLeaveFormProps) {
  // [QWEN3] Quáº£n trá»‹ viÃªn cÃ³ thá»ƒ chá»n Ä‘Äƒng kÃ½ há»™ cho nhÃ¢n sá»± khÃ¡c
  const [selectedStaffId, setSelectedStaffId] = useState<string>(currentStaff.id);
  const activeTargetStaff = allStaff.find((s) => s.id === selectedStaffId) || currentStaff;
  const isRegisteringForOther = isAdmin && activeTargetStaff.id !== currentStaff.id;

  const activeYearlyStats = isRegisteringForOther
    ? calculateStaffYearlyStats(activeTargetStaff.id, existingLeaves, yearlyStats.year)
    : yearlyStats;

  const [mode, setMode] = useState<"individual" | "range">("individual");
  const [slots, setSlots] = useState<SlotItem[]>([
    {
      id: "slot-initial-1",
      date: "", // KhÃ´ng máº·c nhiÃªn chá»n ngÃ y mai, hiá»‡n lÃªn chÆ°a chá»n ngÃ y
      shift: "full-day",
      reason: "phep",
      note: "",
    },
  ]);

  // Form range inputs
  const [rangeFromDate, setRangeFromDate] = useState("");
  const [rangeToDate, setRangeToDate] = useState("");
  const [rangeShift, setRangeShift] = useState<LeaveShift>("full-day");
  const [rangeReason, setRangeReason] = useState<LeaveReason>("phep");

  // Urgent fields
  const [isUrgent, setIsUrgent] = useState(false);
  const [urgentNote, setUrgentNote] = useState("");

  const [isPending, startTransition] = useTransition();
  const [clientError, setClientError] = useState<string | null>(null);

  // Helper tÃ­nh sá»‘ lÆ°á»£ng ngÆ°á»i Ä‘Ã£ nghá»‰ cho 1 ca cá»¥ thá»ƒ (loáº¡i trá»« chÃ­nh nhÃ¢n sá»± má»¥c tiÃªu)
  function checkSlotQuota(date: string, shift: LeaveShift) {
    if (!date) return { count: 0, exceeded: false };

    const sameDayLeaves = existingLeaves.filter(
      (l) => l.date === date && l.reason !== "dihoc" && l.staffId !== activeTargetStaff.id && l.status !== "rejected",
    );

    let morningCount = 0;
    let afternoonCount = 0;

    for (const l of sameDayLeaves) {
      if (l.shift === "full-day") {
        morningCount++;
        afternoonCount++;
      } else if (l.shift === "morning") {
        morningCount++;
      } else if (l.shift === "afternoon") {
        afternoonCount++;
      }
    }

    let relevantCount = 0;
    if (shift === "full-day") {
      relevantCount = Math.max(morningCount, afternoonCount);
    } else if (shift === "morning") {
      relevantCount = morningCount;
    } else {
      relevantCount = afternoonCount;
    }

    const isExceeded =
      (shift === "full-day" && (morningCount >= 2 || afternoonCount >= 2)) ||
      (shift === "morning" && morningCount >= 2) ||
      (shift === "afternoon" && afternoonCount >= 2);

    return {
      count: relevantCount,
      exceeded: isExceeded,
    };
  }

  // ThÃªm má»™t ca láº»
  function handleAddSlot() {
    setClientError(null);
    setSlots((prev) => [
      ...prev,
      {
        id: `slot-${Date.now()}-${Math.random()}`,
        date: "",
        shift: "full-day",
        reason: "phep",
        note: "",
      },
    ]);
  }

  // XÃ³a má»™t ca
  function handleRemoveSlot(id: string) {
    setClientError(null);
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  // Cáº­p nháº­t trÆ°á»ng cá»§a má»™t ca
  function handleUpdateSlot(id: string, field: keyof SlotItem, value: any) {
    setClientError(null);
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  }

  // Ãp dá»¥ng chá»n theo khoáº£ng ngÃ y
  function handleApplyRange() {
    setClientError(null);
    try {
      if (!rangeFromDate || !rangeToDate) {
        setClientError("Vui lÃ²ng chá»n Ä‘áº§y Ä‘á»§ ngÃ y báº¯t Ä‘áº§u vÃ  ngÃ y káº¿t thÃºc (Ä‘á»‹nh dáº¡ng dd/mm/yyyy).");
        return;
      }
      const start = parseISO(rangeFromDate);
      const end = parseISO(rangeToDate);

      if (isBefore(end, start)) {
        setClientError("NgÃ y káº¿t thÃºc pháº£i lá»›n hÆ¡n hoáº·c báº±ng ngÃ y báº¯t Ä‘áº§u.");
        return;
      }

      const days = eachDayOfInterval({ start, end });
      if (days.length > 20) {
        setClientError("Chá»‰ cÃ³ thá»ƒ chá»n dáº£i tá»‘i Ä‘a 20 ngÃ y.");
        return;
      }

      const newSlots: SlotItem[] = days
        .filter((d) => d.getDay() !== 0 && d.getDay() !== 6) // Loáº¡i bá» Thá»© 7 vÃ  Chá»§ nháº­t
        .map((d) => ({
          id: `slot-range-${format(d, "yyyy-MM-dd")}-${Math.random()}`,
          date: format(d, "yyyy-MM-dd"),
          shift: rangeShift,
          reason: rangeReason,
          note: "",
        }));

      if (newSlots.length === 0) {
        setClientError("Khoáº£ng ngÃ y báº¡n chá»n khÃ´ng cÃ³ ngÃ y lÃ m viá»‡c há»£p lá»‡ (trÃ¹ng Thá»© 7 hoáº·c Chá»§ nháº­t).");
        return;
      }

      setSlots(newSlots);
      setMode("individual");
    } catch {
      setClientError("Äá»‹nh dáº¡ng ngÃ y khÃ´ng há»£p lá»‡.");
    }
  }

  // Kiá»ƒm tra xem danh sÃ¡ch cÃ³ ca nÃ o vÆ°á»£t Ä‘á»‹nh má»©c khÃ´ng
  const slotsWithQuota = slots.map((s) => ({
    ...s,
    quota: checkSlotQuota(s.date, s.shift),
  }));

  const hasExceededQuota = slotsWithQuota.some((s) => s.quota.exceeded);

  // TÃ­nh tá»•ng sá»‘ buá»•i vÃ  ngÃ y phÃ©p Ä‘Äƒng kÃ½ trong phiáº¿u nÃ y
  let pendingSessions = 0;
  for (const s of slots) {
    if (s.reason === "phep") {
      pendingSessions += s.shift === "full-day" ? 2 : 1;
    }
  }
  const pendingDays = pendingSessions / 2;

  // Xá»­ lÃ½ gá»­i Form
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    if (slots.length === 0) {
      setClientError("Vui lÃ²ng thÃªm Ã­t nháº¥t má»™t ngÃ y nghá»‰.");
      return;
    }

    if (slots.some((s) => !s.date)) {
      setClientError("Vui lÃ²ng chá»n ngÃ y nghá»‰ (Ä‘á»‹nh dáº¡ng dd/mm/yyyy) cho táº¥t cáº£ cÃ¡c ca trong danh sÃ¡ch.");
      return;
    }

    const weekendSlot = slots.find((s) => {
      if (!s.date) return false;
      try {
        const day = parseISO(s.date).getDay();
        return day === 0 || day === 6;
      } catch {
        return false;
      }
    });

    if (weekendSlot) {
      setClientError("Nghá»‰ phÃ©p khÃ´ng Ã¡p dá»¥ng vÃ o Thá»© 7 vÃ  Chá»§ nháº­t. Vui lÃ²ng chá»n cÃ¡c ngÃ y tá»« Thá»© 2 Ä‘áº¿n Thá»© 6.");
      return;
    }

    // Náº¿u khÃ´ng pháº£i Ä‘Äƒng kÃ½ há»™ hoáº·c vÆ°á»£t Ä‘á»‹nh má»©c quÃ¡ cao
    if (hasExceededQuota && (!isUrgent || !urgentNote.trim()) && !isRegisteringForOther) {
      setClientError("Phiáº¿u cÃ³ ca vÆ°á»£t Ä‘á»‹nh má»©c (â‰¥ 2 ngÆ°á»i). Vui lÃ²ng Ä‘Ã¡nh dáº¥u 'Nghá»‰ cáº¥p thiáº¿t' vÃ  nháº­p ná»™i dung giáº£i trÃ¬nh Ä‘á»ƒ gá»­i quáº£n lÃ½ duyá»‡t.");
      return;
    }

    const formData = new FormData();
    formData.append("slotsJson", JSON.stringify(slots));
    formData.append("isUrgent", isUrgent ? "true" : "false");
    formData.append("urgentNote", urgentNote.trim());
    formData.append("targetStaffId", activeTargetStaff.id);

    startTransition(async () => {
      await submitLeavePortalAction(formData);
    });
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KHá»I 0: CHáº¾ Äá»˜ ÄÄ‚NG KÃ Há»˜ DÃ€NH CHO QUáº¢N TRá»Š VIÃŠN (CHá»ˆ ADMIN THáº¤Y) */}
      {isAdmin && allStaff && allStaff.length > 0 && (
        <div className="overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50/90 via-white to-indigo-50/50 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-sm">
                  <UserCog className="h-4 w-4" />
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                  Cháº¿ Ä‘á»™ Quáº£n trá»‹ viÃªn: ÄÄƒng kÃ½ nghá»‰ phÃ©p há»™
                </span>
              </div>
              <p className="text-xs text-indigo-800">
                Chá»n nhÃ¢n sá»± cáº§n Ä‘Äƒng kÃ½ há»™. ÄÆ¡n do Quáº£n trá»‹ viÃªn trá»±c tiáº¿p táº¡o sáº½ Ä‘Æ°á»£c <strong>Duyá»‡t chÃ­nh thá»©c ngay</strong>.
              </p>
            </div>

            <div className="w-full sm:w-80">
              <label className="text-[11px] font-bold text-indigo-900 block mb-1">
                Chá»n nhÃ¢n sá»± nháº­n Ä‘Æ¡n:
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border-2 border-indigo-300 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 shadow-sm"
              >
                <option value={currentStaff.id}>
                  {currentStaff.name} ({currentStaff.code}) - [Báº£n thÃ¢n]
                </option>
                <optgroup label="Táº¥t cáº£ nhÃ¢n sá»± trong Ä‘Æ¡n vá»‹">
                  {allStaff
                    .filter((s) => s.id !== currentStaff.id)
                    .sort((a, b) => a.name.localeCompare(b.name, "vi"))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) - {s.email}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>
          </div>

          {isRegisteringForOther && (
            <div className="mt-3 pt-2.5 border-t border-indigo-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Äang láº­p Ä‘Æ¡n há»™ cho: <strong className="text-indigo-950">{activeTargetStaff.name} ({activeTargetStaff.code})</strong>
                </span>
              </span>
              <span className="rounded-full bg-emerald-100 text-emerald-900 px-2.5 py-0.5 text-[11px] font-black border border-emerald-300">
                âœ“ Sáº½ duyá»‡t chÃ­nh thá»©c ngay
              </span>
            </div>
          )}
        </div>
      )}

      {/* KHá»I 1: THÃ”NG TIN NHÃ‚N Sá»° & QUá»¸ PHÃ‰P NÄ‚M (RESPONSIVE) */}
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50/80 via-white to-slate-50 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100/80 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-semibold text-teal-800">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-teal-600" />
              {isRegisteringForOther ? "Há»“ sÆ¡ nhÃ¢n sá»± Ä‘Æ°á»£c Ä‘Äƒng kÃ½ há»™" : "TÃ i khoáº£n Ä‘iá»u dÆ°á»¡ng Ä‘Ã£ xÃ¡c thá»±c"}
            </span>
            <h2 className="text-lg font-bold text-slate-900 sm:text-2xl">
              {activeTargetStaff.name} <span className="text-slate-400 font-medium">({activeTargetStaff.code})</span>
            </h2>
            <p className="text-xs text-slate-500 sm:text-sm">
              Email: <span className="font-medium text-slate-700">{activeTargetStaff.email}</span>
            </p>
          </div>

          {/* Tháº» thá»‘ng kÃª sá»‘ ngÃ y nghá»‰ phÃ©p trong nÄƒm cá»§a nhÃ¢n sá»± má»¥c tiÃªu */}
          <div className="w-full sm:w-auto rounded-2xl border border-teal-200/80 bg-white/95 p-3.5 sm:p-4 shadow-sm text-left sm:text-right">
            <div className="flex items-center gap-1.5 sm:justify-end">
              <Clock className="h-4 w-4 text-teal-600 shrink-0" />
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Quá»¹ phÃ©p nÄƒm {activeYearlyStats.year} (ÄÃ£ duyá»‡t)
              </p>
            </div>
            <p className="mt-0.5 sm:mt-1 text-2xl sm:text-3xl font-extrabold text-teal-700">
              {activeYearlyStats.totalDays} <span className="text-xs sm:text-sm font-semibold text-slate-600">ngÃ y</span>
            </p>
            <p className="text-[11px] sm:text-xs text-slate-500">
              TÆ°Æ¡ng Ä‘Æ°Æ¡ng <strong>{activeYearlyStats.totalSessions} buá»•i</strong> (2 buá»•i = 1 ngÃ y)
            </p>
          </div>
        </div>
      </div>

      {/* KHá»I 2: FORM ÄÄ‚NG KÃ PHÃ‰P LINH HOáº T (RESPONSIVE) */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Chi tiáº¿t ngÃ y & ca xin nghá»‰</h3>
            <p className="text-xs text-slate-500">
              Chá»n linh hoáº¡t nhiá»u ngÃ y rá»i ráº¡c hoáº·c chá»n nhanh dáº£i ngÃ y liÃªn tá»¥c.
            </p>
          </div>

          {/* NÃºt chuyá»ƒn cháº¿ Ä‘á»™ chá»n */}
          <div className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex rounded-xl sm:rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("individual")}
              className={`rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 text-xs font-bold transition text-center ${
                mode === "individual"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Chá»n tá»«ng ca rá»i
            </button>
            <button
              type="button"
              onClick={() => setMode("range")}
              className={`rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 text-xs font-bold transition text-center ${
                mode === "range"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Chá»n khoáº£ng ngÃ y
            </button>
          </div>
        </div>

        {/* CÃ”NG Cá»¤ CHá»ŒN NHANH THEO KHOáº¢NG NGÃ€Y */}
        {mode === "range" && (
          <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3 text-indigo-900 font-bold text-xs sm:text-sm">
              <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
              Chá»n nhanh khoáº£ng ngÃ y liÃªn tá»¥c (Loáº¡i bá» Thá»© 7, CN)
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-xs text-slate-700">
                <span className="font-semibold block">Tá»« ngÃ y (dd/mm/yyyy)</span>
                <input
                  type="date"
                  value={rangeFromDate}
                  onChange={(e) => setRangeFromDate(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 font-medium"
                />
                <span className="block text-[11px] font-semibold text-indigo-700">
                  {rangeFromDate ? format(parseISO(rangeFromDate), "dd/MM/yyyy") : "ChÆ°a chá»n ngÃ y"}
                </span>
              </label>
              <label className="space-y-1 text-xs text-slate-700">
                <span className="font-semibold block">Äáº¿n ngÃ y (dd/mm/yyyy)</span>
                <input
                  type="date"
                  value={rangeToDate}
                  onChange={(e) => setRangeToDate(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 font-medium"
                />
                <span className="block text-[11px] font-semibold text-indigo-700">
                  {rangeToDate ? format(parseISO(rangeToDate), "dd/MM/yyyy") : "ChÆ°a chá»n ngÃ y"}
                </span>
              </label>
              <label className="space-y-1 text-xs text-slate-700">
                <span className="font-semibold block">Ãp dá»¥ng ca</span>
                <select
                  value={rangeShift}
                  onChange={(e) => setRangeShift(e.target.value as LeaveShift)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="full-day">Cáº£ ngÃ y</option>
                  <option value="morning">Chá»‰ buá»•i SÃ¡ng</option>
                  <option value="afternoon">Chá»‰ buá»•i Chiá»u</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-700">
                <span className="font-semibold block">LÃ½ do</span>
                <select
                  value={rangeReason}
                  onChange={(e) => setRangeReason(e.target.value as LeaveReason)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="phep">Nghá»‰ phÃ©p</option>
                  {isAdmin && <option value="om">Nghá»‰ á»‘m (Admin)</option>}
                  {isAdmin && <option value="dihoc">Äi há»c (Admin)</option>}
                </select>
              </label>
            </div>
            <div className="mt-4 flex sm:justify-end">
              <button
                type="button"
                onClick={handleApplyRange}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                Ãp dá»¥ng dáº£i ngÃ y nÃ y
              </button>
            </div>
          </div>
        )}

        {/* DANH SÃCH CÃC CA ÄÄ‚NG KÃ (RESPONSIVE CARDS) */}
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          <div className="space-y-3 sm:space-y-4">
            {slotsWithQuota.map((slot, index) => {
              let isWeekend = false;
              let dateDisplayTitle = "ChÆ°a chá»n ngÃ y (dd/mm/yyyy)";
              if (slot.date) {
                try {
                  const d = parseISO(slot.date);
                  const day = d.getDay();
                  if (day === 0 || day === 6) {
                    isWeekend = true;
                    dateDisplayTitle = `${format(d, "dd/MM/yyyy")} (${day === 6 ? "Thá»© 7" : "Chá»§ nháº­t"} - KhÃ´ng Ã¡p dá»¥ng)`;
                  } else {
                    dateDisplayTitle = `${format(d, "dd/MM/yyyy")} (${format(d, "EEEE", { locale: vi })})`;
                  }
                } catch {}
              }

              return (
                <div
                  key={slot.id}
                  className={`relative rounded-2xl border p-3.5 sm:p-4 transition ${
                    isWeekend || slot.quota.exceeded
                      ? "border-rose-300 bg-rose-50/40"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  {/* Card Header: Sá»‘ thá»© tá»± + NgÃ y + NÃºt xÃ³a tiá»‡n báº¥m */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      <p className="text-xs sm:text-sm font-bold capitalize text-slate-800 truncate">
                        {dateDisplayTitle}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(slot.id)}
                      disabled={slots.length <= 1}
                      title="XÃ³a ca nÃ y"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Card Body: CÃ¡c Ã´ chá»n (Responsive Grid) */}
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {/* NgÃ y */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 block">
                        NgÃ y nghá»‰ (dd/mm/yyyy)
                      </label>
                      <input
                        type="date"
                        value={slot.date}
                        onChange={(e) => handleUpdateSlot(slot.id, "date", e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 font-medium"
                      />
                      <span className="block text-[11px] font-semibold text-teal-700">
                        {slot.date ? format(parseISO(slot.date), "dd/MM/yyyy") : "ChÆ°a chá»n ngÃ y"}
                      </span>
                    </div>

                    {/* Buá»•i */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 block">
                        Buá»•i / Ca
                      </label>
                      <select
                        value={slot.shift}
                        onChange={(e) => handleUpdateSlot(slot.id, "shift", e.target.value as LeaveShift)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 font-medium"
                      >
                        {Object.entries(LEAVE_SHIFT_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* LÃ½ do */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 block">
                        LÃ½ do nghá»‰
                      </label>
                      <select
                        value={slot.reason}
                        onChange={(e) => handleUpdateSlot(slot.id, "reason", e.target.value as LeaveReason)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 font-medium"
                      >
                        <option value="phep">Nghá»‰ phÃ©p</option>
                        {isAdmin && <option value="om">Nghá»‰ á»‘m (Admin)</option>}
                        {isAdmin && <option value="dihoc">Äi há»c (Admin)</option>}
                      </select>
                    </div>

                    {/* Ghi chÃº */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 block">
                        Ghi chÃº thÃªm
                      </label>
                      <input
                        type="text"
                        placeholder="Ghi chÃº thÃªm..."
                        value={slot.note}
                        onChange={(e) => handleUpdateSlot(slot.id, "note", e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Card Footer: Thanh Ä‘á»‹nh má»©c Quota */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    {isWeekend ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                        Thá»© 7 / CN khÃ´ng Ã¡p dá»¥ng nghá»‰ phÃ©p
                      </span>
                    ) : slot.quota.exceeded ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                        VÆ°á»£t Ä‘á»‹nh má»©c: ÄÃ£ Ä‘á»§ {slot.quota.count}/2 ngÆ°á»i nghá»‰
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Äá»‹nh má»©c ca: {slot.quota.count}/2 ngÆ°á»i Ä‘Ã£ nghá»‰
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* NÃºt thÃªm ca & TÃ³m táº¯t sá»‘ ngÃ y táº¡m tÃ­nh */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:items-center sm:justify-between pt-2">
            <button
              type="button"
              onClick={handleAddSlot}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
            >
              <Plus className="h-4 w-4 text-slate-500" />
              ThÃªm ngÃ y/ca nghá»‰ khÃ¡c
            </button>

            {/* TÃ³m táº¯t sá»‘ ngÃ y xin nghá»‰ */}
            <div className="text-center sm:text-right text-xs text-slate-600 bg-slate-50 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
              Äang chá»n: <strong>{slots.length} ca</strong> Â· Táº¡m tÃ­nh:{" "}
              <span className="text-teal-700 font-extrabold">{pendingDays} ngÃ y phÃ©p</span> ({pendingSessions} buá»•i)
            </div>
          </div>

          {/* KHá»I Cáº¢NH BÃO NGHá»ˆ Cáº¤P THIáº¾T KHI VÆ¯á»¢T Äá»ŠNH Má»¨C */}
          {hasExceededQuota && (
            <div className="rounded-2xl border-2 border-orange-300 bg-orange-50/80 p-4 sm:p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-orange-950">
                    Cáº£nh bÃ¡o: Ca nghá»‰ Ä‘Ã£ vÆ°á»£t sá»‘ lÆ°á»£ng cho phÃ©p (tá»‘i Ä‘a 2 ngÆ°á»i/ca)
                  </h4>
                  <p className="mt-0.5 text-xs text-orange-800 leading-relaxed">
                    Theo quy Ä‘á»‹nh, má»™t ca lÃ m viá»‡c chá»‰ cho phÃ©p tá»‘i Ä‘a 2 ngÆ°á»i nghá»‰ cÃ¹ng lÃºc.
                    {isRegisteringForOther
                      ? " Do báº¡n lÃ  Quáº£n trá»‹ viÃªn Ä‘Äƒng kÃ½ há»™, Ä‘Æ¡n sáº½ Ä‘Æ°á»£c duyá»‡t trá»±c tiáº¿p vÃ o há»‡ thá»‘ng."
                      : " Äá»ƒ tiáº¿p tá»¥c gá»­i, báº¡n cáº§n Ä‘Ã¡nh dáº¥u Ä‘Ã¢y lÃ  TrÆ°á»ng há»£p Cáº¥p thiáº¿t vÃ  nháº­p lÃ½ do giáº£i trÃ¬nh Ä‘á»ƒ Quáº£n lÃ½ (tienmed@gmail.com) xem xÃ©t phÃª duyá»‡t."}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-orange-200/80">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    className="h-4 w-4 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-xs sm:text-sm font-bold text-orange-900">
                    XÃ¡c nháº­n Ä‘Ã¢y lÃ  trÆ°á»ng há»£p nghá»‰ Cáº¥p thiáº¿t
                  </span>
                </label>

                {isUrgent && (
                  <div className="space-y-1.5 sm:pl-7">
                    <span className="text-xs font-semibold text-orange-900 block">
                      Ghi chÃº ná»™i dung giáº£i trÃ¬nh <span className="text-rose-600">*</span>:
                    </span>
                    <textarea
                      rows={2}
                      value={urgentNote}
                      onChange={(e) => setUrgentNote(e.target.value)}
                      placeholder="VÃ­ dá»¥: Viá»‡c gia Ä‘Ã¬nh kháº©n cáº¥p, phÃ¢n cÃ´ng Ä‘á»™t xuáº¥t..."
                      className="w-full rounded-xl border border-orange-200 bg-white p-3 text-sm outline-none focus:border-orange-500 text-slate-800 placeholder:text-slate-400"
                      required
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* THÃ”NG BÃO Lá»–I CLIENT */}
          {clientError && (
            <div className="rounded-xl sm:rounded-2xl border border-rose-200 bg-rose-50 p-3.5 sm:p-4 text-xs font-semibold text-rose-800">
              {clientError}
            </div>
          )}

          {/* NÃšT SUBMIT (THAY Äá»”I THEO CHáº¾ Äá»˜ ÄÄ‚NG KÃ Há»˜) */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending || (hasExceededQuota && (!isUrgent || !urgentNote.trim()) && !isRegisteringForOther)}
              className={`w-full min-h-[48px] sm:min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl px-6 py-3.5 sm:py-4 text-sm font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none ${
                isRegisteringForOther
                  ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25"
                  : "bg-teal-600 hover:bg-teal-700 shadow-teal-600/25"
              }`}
            >
              {isPending ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  {isRegisteringForOther
                    ? "Äang ghi nháº­n vÃ  duyá»‡t chÃ­nh thá»©c..."
                    : "Äang ghi nháº­n táº¡m vÃ  gá»­i email duyá»‡t..."}
                </>
              ) : (
                <>
                  {isRegisteringForOther ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {isRegisteringForOther
                    ? `ÄÄƒng kÃ½ & Duyá»‡t chÃ­nh thá»©c cho ÄD ${activeTargetStaff.name}`
                    : "Gá»­i phiáº¿u xin nghá»‰ phÃ©p"}
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] sm:text-xs text-slate-400">
              {isRegisteringForOther
                ? "ÄÆ¡n do Quáº£n trá»‹ viÃªn trá»±c tiáº¿p táº¡o sáº½ Ä‘Æ°á»£c Duyá»‡t chÃ­nh thá»©c ngay vÃ  gá»­i email thÃ´ng bÃ¡o xÃ¡c nháº­n tá»›i Ä‘iá»u dÆ°á»¡ng."
                : "ÄÆ¡n sáº½ Ä‘Æ°á»£c ghi nháº­n táº¡m vÃ  chuyá»ƒn email tá»›i quáº£n lÃ½ Ä‘á»ƒ duyá»‡t 1 cháº¡m."}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}