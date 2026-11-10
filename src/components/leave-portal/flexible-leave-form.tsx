"use client";

import { useState, useTransition } from "react";
import { format, parseISO, isBefore, eachDayOfInterval } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar, Plus, Trash2, AlertTriangle, CheckCircle2, Clock, Send, Sparkles, UserCog } from "lucide-react";
import { LEAVE_SHIFT_LABELS } from "@/lib/constants";
import type { LeaveReason, LeaveRecord, LeaveShift, StaffMember } from "@/lib/types";
import { submitLeavePortalAction } from "@/app/dang-ky-phep/actions";
import { isStudyStaff as checkIsStudyStaff } from "@/lib/study-staff";

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
  isStudyStaff?: boolean;
}

// [QWEN3] Helper tính toán quỹ phép năm của nhân sự bất kỳ
function calculateStaffYearlyStats(staffId: string, leaves: LeaveRecord[], year: number) {
  const yearPrefix = `${year}-`;
  const approvedLeaves = leaves.filter((l) => {
    if (l.staffId !== staffId) return false;
    if (l.status && l.status !== "approved") return false;
    if (l.reason !== "phep") return false;
    try {
      const d = parseISO(l.date).getDay();
      if (d === 0 || d === 6) return false; // Không tính Thứ 7 và Chủ nhật
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
  isStudyStaff = false,
}: FlexibleLeaveFormProps) {
  // [QWEN3] Quản trị viên có thể chọn đăng ký hộ cho nhân sự khác
  const [selectedStaffId, setSelectedStaffId] = useState<string>(currentStaff.id);
  const activeTargetStaff = allStaff.find((s) => s.id === selectedStaffId) || currentStaff;
  const isRegisteringForOther = isAdmin && activeTargetStaff.id !== currentStaff.id;
  const effectiveIsStudyStaff = isStudyStaff || checkIsStudyStaff(activeTargetStaff);

  const activeYearlyStats = isRegisteringForOther
    ? calculateStaffYearlyStats(activeTargetStaff.id, existingLeaves, yearlyStats.year)
    : yearlyStats;

  const [mode, setMode] = useState<"individual" | "range">("individual");
  const [slots, setSlots] = useState<SlotItem[]>([
    {
      id: "slot-initial-1",
      date: "", // Không mặc nhiên chọn ngày mai, hiện lên chưa chọn ngày
      shift: "full-day",
      reason: effectiveIsStudyStaff ? "dihoc" : "phep",
      note: "",
    },
  ]);

  // Form range inputs
  const [rangeFromDate, setRangeFromDate] = useState("");
  const [rangeToDate, setRangeToDate] = useState("");
  const [rangeShift, setRangeShift] = useState<LeaveShift>("full-day");
  const [rangeReason, setRangeReason] = useState<LeaveReason>(effectiveIsStudyStaff ? "dihoc" : "phep");

  // Urgent fields
  const [isUrgent, setIsUrgent] = useState(false);
  const [urgentNote, setUrgentNote] = useState("");

  const [isPending, startTransition] = useTransition();
  const [clientError, setClientError] = useState<string | null>(null);

  // Helper tính số lượng người đã nghỉ cho 1 ca cụ thể (loại trừ chính nhân sự mục tiêu)
  function checkSlotQuota(date: string, shift: LeaveShift, reason: LeaveReason = "phep") {
    const isStudy = reason === "dihoc";
    const maxQuota = isStudy ? 3 : 2;

    if (!date) return { count: 0, exceeded: false, maxQuota, isStudy };

    const sameDayLeaves = existingLeaves.filter((l) => {
      if (l.date !== date || l.staffId === activeTargetStaff.id || l.status === "rejected") return false;
      // Với nghỉ phép thông thường: không tính ca đi học vào định mức 2 người
      if (!isStudy && l.reason === "dihoc") return false;
      return true;
    });

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
      (shift === "full-day" && (morningCount >= maxQuota || afternoonCount >= maxQuota)) ||
      (shift === "morning" && morningCount >= maxQuota) ||
      (shift === "afternoon" && afternoonCount >= maxQuota);

    return {
      count: relevantCount,
      exceeded: isExceeded,
      maxQuota,
      isStudy,
    };
  }

  // Thêm một ca lẻ
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

  // Xóa một ca
  function handleRemoveSlot(id: string) {
    setClientError(null);
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  // Cập nhật trường của một ca
  function handleUpdateSlot(id: string, field: keyof SlotItem, value: any) {
    setClientError(null);
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  }

  // Áp dụng chọn theo khoảng ngày
  function handleApplyRange() {
    setClientError(null);
    try {
      if (!rangeFromDate || !rangeToDate) {
        setClientError("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc (định dạng dd/mm/yyyy).");
        return;
      }
      const start = parseISO(rangeFromDate);
      const end = parseISO(rangeToDate);

      if (isBefore(end, start)) {
        setClientError("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.");
        return;
      }

      const days = eachDayOfInterval({ start, end });
      if (days.length > 20) {
        setClientError("Chỉ có thể chọn dải tối đa 20 ngày.");
        return;
      }

      const newSlots: SlotItem[] = days
        .filter((d) => d.getDay() !== 0 && d.getDay() !== 6) // Loại bỏ Thứ 7 và Chủ nhật
        .map((d) => ({
          id: `slot-range-${format(d, "yyyy-MM-dd")}-${Math.random()}`,
          date: format(d, "yyyy-MM-dd"),
          shift: rangeShift,
          reason: rangeReason,
          note: "",
        }));

      if (newSlots.length === 0) {
        setClientError("Khoảng ngày bạn chọn không có ngày làm việc hợp lệ (trùng Thứ 7 hoặc Chủ nhật).");
        return;
      }

      setSlots(newSlots);
      setMode("individual");
    } catch {
      setClientError("Định dạng ngày không hợp lệ.");
    }
  }

  // Kiểm tra xem danh sách có ca nào vượt định mức không
  const slotsWithQuota = slots.map((s) => ({
    ...s,
    quota: checkSlotQuota(s.date, s.shift, s.reason),
  }));

  const hasExceededQuota = slotsWithQuota.some((s) => s.quota.exceeded);
  const hasLeaveQuotaExceeded = slotsWithQuota.some((s) => s.reason !== "dihoc" && s.quota.exceeded);

  // Tính tổng số buổi và ngày phép đăng ký trong phiếu này
  let pendingSessions = 0;
  for (const s of slots) {
    if (s.reason === "phep") {
      pendingSessions += s.shift === "full-day" ? 2 : 1;
    }
  }
  const pendingDays = pendingSessions / 2;

  // Xử lý gửi Form
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    if (slots.length === 0) {
      setClientError("Vui lòng thêm ít nhất một ngày nghỉ.");
      return;
    }

    if (slots.some((s) => !s.date)) {
      setClientError("Vui lòng chọn ngày nghỉ (định dạng dd/mm/yyyy) cho tất cả các ca trong danh sách.");
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
      setClientError("Nghỉ phép không áp dụng vào Thứ 7 và Chủ nhật. Vui lòng chọn các ngày từ Thứ 2 đến Thứ 6.");
      return;
    }

    // Nếu ca nghỉ phép thường vượt định mức (≥ 2 người)
    if (hasLeaveQuotaExceeded && (!isUrgent || !urgentNote.trim()) && !isRegisteringForOther) {
      setClientError("Phiếu có ca nghỉ phép vượt định mức (≥ 2 người). Vui lòng đánh dấu 'Nghỉ cấp thiết' và nhập nội dung giải trình để gửi quản lý duyệt.");
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
      {/* KHỐI 0: CHẾ ĐỘ ĐĂNG KÝ HỘ DÀNH CHO QUẢN TRỊ VIÊN (CHỈ ADMIN THẤY) */}
      {isAdmin && allStaff && allStaff.length > 0 && (
        <div className="overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50/90 via-white to-indigo-50/50 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-sm">
                  <UserCog className="h-4 w-4" />
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                  Chế độ Quản trị viên: Đăng ký nghỉ phép hộ
                </span>
              </div>
              <p className="text-xs text-indigo-800">
                Chọn nhân sự cần đăng ký hộ. Đơn do Quản trị viên trực tiếp tạo sẽ được <strong>Duyệt chính thức ngay</strong>.
              </p>
            </div>

            <div className="w-full sm:w-80">
              <label className="text-[11px] font-bold text-indigo-900 block mb-1">
                Chọn nhân sự nhận đơn:
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border-2 border-indigo-300 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 shadow-sm"
              >
                <option value={currentStaff.id}>
                  {currentStaff.name} ({currentStaff.code}) - [Bản thân]
                </option>
                <optgroup label="Tất cả nhân sự trong đơn vị">
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
                  Đang lập đơn hộ cho: <strong className="text-indigo-950">{activeTargetStaff.name} ({activeTargetStaff.code})</strong>
                </span>
              </span>
              <span className="rounded-full bg-emerald-100 text-emerald-900 px-2.5 py-0.5 text-[11px] font-black border border-emerald-300">
                ✓ Sẽ duyệt chính thức ngay
              </span>
            </div>
          )}
        </div>
      )}

      {/* KHỐI 1: THÔNG TIN NHÂN SỰ & QUỸ PHÉP NĂM (RESPONSIVE) */}
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50/80 via-white to-slate-50 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100/80 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-semibold text-teal-800">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-teal-600" />
              {isRegisteringForOther ? "Hồ sơ nhân sự được đăng ký hộ" : "Tài khoản điều dưỡng đã xác thực"}
            </span>
            <h2 className="text-lg font-bold text-slate-900 sm:text-2xl">
              {activeTargetStaff.name} <span className="text-slate-400 font-medium">({activeTargetStaff.code})</span>
            </h2>
            <p className="text-xs text-slate-500 sm:text-sm">
              Email: <span className="font-medium text-slate-700">{activeTargetStaff.email}</span>
            </p>
          </div>

          {/* Thẻ thống kê số ngày nghỉ phép trong năm của nhân sự mục tiêu */}
          <div className="w-full sm:w-auto rounded-2xl border border-teal-200/80 bg-white/95 p-3.5 sm:p-4 shadow-sm text-left sm:text-right">
            <div className="flex items-center gap-1.5 sm:justify-end">
              <Clock className="h-4 w-4 text-teal-600 shrink-0" />
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Quỹ phép năm {activeYearlyStats.year} (Đã duyệt)
              </p>
            </div>
            <p className="mt-0.5 sm:mt-1 text-2xl sm:text-3xl font-extrabold text-teal-700">
              {activeYearlyStats.totalDays} <span className="text-xs sm:text-sm font-semibold text-slate-600">ngày</span>
            </p>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Tương đương <strong>{activeYearlyStats.totalSessions} buổi</strong> (2 buổi = 1 ngày)
            </p>
          </div>
        </div>
      </div>

      {/* KHỐI 2: FORM ĐĂNG KÝ PHÉP LINH HOẠT (RESPONSIVE) */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Chi tiết ngày & ca xin nghỉ</h3>
            <p className="text-xs text-slate-500">
              Chọn linh hoạt nhiều ngày rời rạc hoặc chọn nhanh dải ngày liên tục.
            </p>
          </div>

          {/* Nút chuyển chế độ chọn */}
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
              Chọn từng ca rời
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
              Chọn khoảng ngày
            </button>
          </div>
        </div>

        {/* CÔNG CỤ CHỌN NHANH THEO KHOẢNG NGÀY */}
        {mode === "range" && (
          <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3 text-indigo-900 font-bold text-xs sm:text-sm">
              <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
              Chọn nhanh khoảng ngày liên tục (Loại bỏ Thứ 7, CN)
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-xs text-slate-700">
                <span className="font-semibold block">Từ ngày (dd/mm/yyyy)</span>
                <input
                  type="date"
                  value={rangeFromDate}
                  onChange={(e) => setRangeFromDate(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 font-medium"
                />
                <span className="block text-[11px] font-semibold text-indigo-700">
                  {rangeFromDate ? format(parseISO(rangeFromDate), "dd/MM/yyyy") : "Chưa chọn ngày"}
                </span>
              </label>
              <label className="space-y-1 text-xs text-slate-700">
                <span className="font-semibold block">Đến ngày (dd/mm/yyyy)</span>
                <input
                  type="date"
                  value={rangeToDate}
                  onChange={(e) => setRangeToDate(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 font-medium"
                />
                <span className="block text-[11px] font-semibold text-indigo-700">
                  {rangeToDate ? format(parseISO(rangeToDate), "dd/MM/yyyy") : "Chưa chọn ngày"}
                </span>
              </label>
              <label className="space-y-1 text-xs text-slate-700">
                <span className="font-semibold block">Áp dụng ca</span>
                <select
                  value={rangeShift}
                  onChange={(e) => setRangeShift(e.target.value as LeaveShift)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="full-day">Cả ngày</option>
                  <option value="morning">Chỉ buổi Sáng</option>
                  <option value="afternoon">Chỉ buổi Chiều</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-700">
                <span className="font-semibold block">Lý do</span>
                <select
                  value={rangeReason}
                  onChange={(e) => setRangeReason(e.target.value as LeaveReason)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="phep">Nghỉ phép</option>
                  {(isAdmin || effectiveIsStudyStaff) && (
                    <option value="dihoc">{isAdmin && !effectiveIsStudyStaff ? "Đi học (Admin)" : "Đi học"}</option>
                  )}
                  {isAdmin && <option value="om">Nghỉ ốm (Admin)</option>}
                </select>
              </label>
            </div>
            <div className="mt-4 flex sm:justify-end">
              <button
                type="button"
                onClick={handleApplyRange}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                Áp dụng dải ngày này
              </button>
            </div>
          </div>
        )}

        {/* DANH SÁCH CÁC CA ĐĂNG KÝ (RESPONSIVE CARDS) */}
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          <div className="space-y-3 sm:space-y-4">
            {slotsWithQuota.map((slot, index) => {
              let isWeekend = false;
              let dateDisplayTitle = "Chưa chọn ngày (dd/mm/yyyy)";
              if (slot.date) {
                try {
                  const d = parseISO(slot.date);
                  const day = d.getDay();
                  if (day === 0 || day === 6) {
                    isWeekend = true;
                    dateDisplayTitle = `${format(d, "dd/MM/yyyy")} (${day === 6 ? "Thứ 7" : "Chủ nhật"} - Không áp dụng)`;
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
                  {/* Card Header: Số thứ tự + Ngày + Nút xóa tiện bấm */}
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
                      title="Xóa ca này"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Card Body: Các ô chọn (Responsive Grid) */}
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Ngày */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 block">
                        Ngày nghỉ (dd/mm/yyyy)
                      </label>
                      <input
                        type="date"
                        value={slot.date}
                        onChange={(e) => handleUpdateSlot(slot.id, "date", e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 font-medium"
                      />
                      <span className="block text-[11px] font-semibold text-teal-700">
                        {slot.date ? format(parseISO(slot.date), "dd/MM/yyyy") : "Chưa chọn ngày"}
                      </span>
                    </div>

                    {/* Buổi */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 block">
                        Buổi / Ca
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

                    {/* Lý do */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 block">
                        Lý do nghỉ
                      </label>
                      <select
                        value={slot.reason}
                        onChange={(e) => handleUpdateSlot(slot.id, "reason", e.target.value as LeaveReason)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 font-medium"
                      >
                        <option value="phep">Nghỉ phép</option>
                        {(isAdmin || effectiveIsStudyStaff) && (
                          <option value="dihoc">{isAdmin && !effectiveIsStudyStaff ? "Đi học (Admin)" : "Đi học"}</option>
                        )}
                        {isAdmin && <option value="om">Nghỉ ốm (Admin)</option>}
                      </select>
                    </div>

                    {/* Ghi chú */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 block">
                        Ghi chú thêm
                      </label>
                      <input
                        type="text"
                        placeholder="Ghi chú thêm..."
                        value={slot.note}
                        onChange={(e) => handleUpdateSlot(slot.id, "note", e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Card Footer: Thanh định mức Quota */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    {isWeekend ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                        Thứ 7 / CN không áp dụng nghỉ phép
                      </span>
                    ) : slot.reason === "dihoc" ? (
                      slot.quota.exceeded ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          Đã có {slot.quota.count}/3 người nghỉ buổi này (Chuyển sang Quản lý duyệt)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Định mức đi học: {slot.quota.count}/3 người đã nghỉ (Tự động duyệt ngay)
                        </span>
                      )
                    ) : slot.quota.exceeded ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                        Vượt định mức: Đã đủ {slot.quota.count}/2 người nghỉ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Định mức ca: {slot.quota.count}/2 người đã nghỉ
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nút thêm ca & Tóm tắt số ngày tạm tính */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:items-center sm:justify-between pt-2">
            <button
              type="button"
              onClick={handleAddSlot}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
            >
              <Plus className="h-4 w-4 text-slate-500" />
              Thêm ngày/ca nghỉ khác
            </button>

            {/* Tóm tắt số ngày xin nghỉ */}
            <div className="text-center sm:text-right text-xs text-slate-600 bg-slate-50 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
              Đang chọn: <strong>{slots.length} ca</strong> · Tạm tính:{" "}
              <span className="text-teal-700 font-extrabold">{pendingDays} ngày phép</span> ({pendingSessions} buổi)
            </div>
          </div>

          {/* KHỐI CẢNH BÁO NGHỈ CẤP THIẾT KHI VƯỢT ĐỊNH MỨC */}
          {hasExceededQuota && (
            <div className="rounded-2xl border-2 border-orange-300 bg-orange-50/80 p-4 sm:p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-orange-950">
                    Cảnh báo: Ca nghỉ đã vượt số lượng cho phép (tối đa 2 người/ca)
                  </h4>
                  <p className="mt-0.5 text-xs text-orange-800 leading-relaxed">
                    Theo quy định, một ca làm việc chỉ cho phép tối đa 2 người nghỉ cùng lúc.
                    {isRegisteringForOther
                      ? " Do bạn là Quản trị viên đăng ký hộ, đơn sẽ được duyệt trực tiếp vào hệ thống."
                      : " Để tiếp tục gửi, bạn cần đánh dấu đây là Trường hợp Cấp thiết và nhập lý do giải trình để Quản lý (tienmed@gmail.com) xem xét phê duyệt."}
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
                    Xác nhận đây là trường hợp nghỉ Cấp thiết
                  </span>
                </label>

                {isUrgent && (
                  <div className="space-y-1.5 sm:pl-7">
                    <span className="text-xs font-semibold text-orange-900 block">
                      Ghi chú nội dung giải trình <span className="text-rose-600">*</span>:
                    </span>
                    <textarea
                      rows={2}
                      value={urgentNote}
                      onChange={(e) => setUrgentNote(e.target.value)}
                      placeholder="Ví dụ: Việc gia đình khẩn cấp, phân công đột xuất..."
                      className="w-full rounded-xl border border-orange-200 bg-white p-3 text-sm outline-none focus:border-orange-500 text-slate-800 placeholder:text-slate-400"
                      required
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* THÔNG BÁO LỖI CLIENT */}
          {clientError && (
            <div className="rounded-xl sm:rounded-2xl border border-rose-200 bg-rose-50 p-3.5 sm:p-4 text-xs font-semibold text-rose-800">
              {clientError}
            </div>
          )}

          {/* NÚT SUBMIT (THAY ĐỔI THEO CHẾ ĐỘ ĐĂNG KÝ HỘ) */}
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
                    ? "Đang ghi nhận và duyệt chính thức..."
                    : "Đang ghi nhận tạm và gửi email duyệt..."}
                </>
              ) : (
                <>
                  {isRegisteringForOther ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {isRegisteringForOther
                    ? `Đăng ký & Duyệt chính thức cho ĐD ${activeTargetStaff.name}`
                    : "Gửi phiếu xin nghỉ phép"}
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] sm:text-xs text-slate-400">
              {isRegisteringForOther
                ? "Đơn do Quản trị viên trực tiếp tạo sẽ được Duyệt chính thức ngay và gửi email thông báo xác nhận tới điều dưỡng."
                : "Đơn sẽ được ghi nhận tạm và chuyển email tới quản lý để duyệt 1 chạm."}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}