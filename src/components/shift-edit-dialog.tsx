"use client";

import { useState, useTransition, useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Pill } from "@/components/pill";
import { SubmitButton } from "@/components/submit-button";
import { ASSIGNMENT_STATUS_LABELS, SHIFT_LABELS, WEEKDAY_LABELS } from "@/lib/constants";
import { suggestStaffForSlot, type SuggestionResult } from "@/lib/schedule";
import type { LeaveRecord, Position, StaffMember, WeeklyAssignment, WorkloadSummary, ShiftType } from "@/lib/types";
import { saveWeeklyAssignmentAction, saveSingleTemplateAssignmentAction } from "@/app/actions";
import { parseISO } from "date-fns";

interface ShiftEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  date: string; // yyyy-MM-dd
  shift: ShiftType;
  position: Position;
  currentAssignment?: WeeklyAssignment | null;
  defaultPerson?: StaffMember | null;
  slotIndex?: number;
  dayOfWeek: number;
  mode?: "weekly" | "template";
  anchorRect?: DOMRect;
  staff: StaffMember[];
  positions: Position[];
  leaveRequests: LeaveRecord[];
  workload: WorkloadSummary[];
  weeklySchedule: WeeklyAssignment[];
  weekStart: string;
  returnTo: string;
}

export function ShiftEditDialog({
  isOpen,
  onClose,
  date,
  shift,
  position,
  currentAssignment,
  defaultPerson,
  slotIndex,
  dayOfWeek,
  mode = "weekly",
  anchorRect,
  staff,
  positions,
  leaveRequests,
  workload,
  weeklySchedule,
  weekStart,
  returnTo,
}: ShiftEditDialogProps) {
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    currentAssignment?.staffId ?? defaultPerson?.id ?? ""
  );

  if (!isOpen) return null;

  // Lấy danh sách gợi ý
  const suggestions = suggestStaffForSlot(
    staff,
    positions,
    date,
    shift,
    position.id,
    leaveRequests,
    workload,
    weeklySchedule
  );

  // Lấy staff cũ để nhỡ không có trong list gợi ý vẫn show đc tên
  const currentStaff = staff.find((s) => s.id === (currentAssignment?.staffId ?? defaultPerson?.id));

  const { startOfToday, compareAsc } = require("date-fns");
  const isPast = compareAsc(parseISO(date), startOfToday()) < 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-all duration-300" onClick={onClose} />
      <div className="relative z-[100] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] bg-white p-6 md:p-8 shadow-[0_24px_60px_rgba(15,23,42,0.18)] animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-2 text-xl font-bold text-slate-900">
          Điều chỉnh ca làm việc {mode === "template" && <span className="text-teal-600 font-semibold">(Lịch Nền)</span>}
        </h2>
        <div className="mb-4 flex flex-wrap gap-2 text-sm text-slate-600">
          <Pill tone="slate">{WEEKDAY_LABELS[dayOfWeek]}</Pill>
          <Pill tone="slate">{SHIFT_LABELS[shift]}</Pill>
          <Pill tone="teal">{position.area ? `${position.area} - ` : ""}{position.name}</Pill>
        </div>

        {isPast && (
          <div className="mb-6 rounded-2xl bg-amber-50 p-4 border border-amber-200 text-amber-800 text-sm">
            <span className="font-bold block mb-1">Ngày đã chốt</span>
            Ca làm việc này đã xảy ra trong quá khứ. Bạn không thể thay đổi nhân sự hay đóng vị trí.
          </div>
        )}

        <form
          action={async (formData) => {
            if (isPast) return onClose();
            try {
              if (mode === "template") {
                await saveSingleTemplateAssignmentAction(formData);
              } else {
                await saveWeeklyAssignmentAction(formData);
              }
            } finally {
              onClose();
            }
          }}
          className="space-y-6"
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="weekStart" value={weekStart} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="dayOfWeek" value={dayOfWeek} />
          <input type="hidden" name="shift" value={shift} />
          <input type="hidden" name="status" value={currentAssignment ? "adjusted" : "draft"} />
          <input type="hidden" name="positionId" value={position.id} />
          <input type="hidden" name="staffId" value={selectedStaffId} />
          <input type="hidden" name="slotIndex" value={slotIndex ?? 0} />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Chọn nhân sự mới</h3>
            <div className="grid gap-2 max-h-[260px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">

              {/* Tùy chọn Khoá Vị Trí (Chỉ dành cho Lịch tuần) */}
              {mode === "weekly" && (
                <label
                  className={`group relative flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3 transition ${isPast ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-300 has-[:checked]:border-slate-600 has-[:checked]:bg-slate-100'}`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="_dummyStaffId-closed"
                      value="CLOSED"
                      checked={selectedStaffId === "CLOSED"}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      disabled={isPast}
                      className="h-4 w-4 border-slate-300 text-slate-600 focus:ring-slate-600"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900 group-has-[:checked]:text-slate-900">
                        🔒 Đóng vị trí này
                      </span>
                      <span className="text-[10px] text-slate-500">Cắt giảm vị trí, không cần người trực ca này</span>
                    </div>
                  </div>
                </label>
              )}

              {/* Tùy chọn Bỏ chọn nhân sự (Trống) */}
              <label
                className={`group relative flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3 transition ${isPast ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-300 has-[:checked]:border-rose-500 has-[:checked]:bg-rose-50'}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="_dummyStaffId0"
                    value=""
                    checked={selectedStaffId === ""}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    disabled={isPast}
                    className="h-4 w-4 border-slate-300 text-rose-500 focus:ring-rose-500"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900 group-has-[:checked]:text-rose-900">
                      Bỏ chọn nhân sự (Trống)
                    </span>
                    <span className="text-[10px] text-slate-500">Gỡ tên nhân sự khỏi vị trí này</span>
                  </div>
                </div>
                {!isPast && <X className="h-4 w-4 text-slate-400 group-has-[:checked]:text-rose-500" />}
              </label>

              {/* Danh sách Suggestions */}
              {suggestions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 mb-2">
                  Không tìm thấy nhân sự phù hợp / Đã hết người rảnh.
                </div>
              ) : (
                <>

                  {/* Đưa nhân sự hiện tại nổi bật nếu vẫn trong list gợi ý, hoặc mặc định nếu ko có */}
                  {currentStaff && !suggestions.find(s => s.staff.id === currentStaff.id) && (
                    <label
                      className={`group relative flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3 transition ${isPast ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-300 has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="_dummyStaffId"
                          value={currentStaff.id}
                          checked={selectedStaffId === currentStaff.id}
                          onChange={(e) => setSelectedStaffId(e.target.value)}
                          disabled={isPast}
                          className="h-4 w-4 border-slate-300 text-teal-600 focus:ring-teal-600"
                        />
                        <span className="font-medium text-slate-900">
                          {currentStaff.name} <span className="text-xs text-rose-500">(Ca hiện tại - có thể bận/nghỉ)</span>
                        </span>
                      </div>
                    </label>
                  )}

                  {suggestions.map((sug) => {
                    const isChecked = selectedStaffId === sug.staff.id;
                    return (
                      <label
                        key={sug.staff.id}
                        className={`group relative flex flex-col gap-2 md:flex-row md:items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3 transition ${isPast ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-300 hover:bg-slate-50 has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50 has-[:checked]:shadow-sm'}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="_dummyStaffId2"
                            value={sug.staff.id}
                            checked={isChecked}
                            onChange={(e) => setSelectedStaffId(e.target.value)}
                            disabled={isPast}
                            className="h-4 w-4 shrink-0 rounded-full border-slate-300 text-teal-600 focus:ring-teal-600"
                          />
                          <span className="font-medium text-slate-900 group-has-[:checked]:text-teal-900">
                            {sug.staff.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 ml-7 md:ml-0">
                          {sug.reasons.map((r, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r === "Cùng khu vực"
                                ? "bg-indigo-100 text-indigo-700"
                                : r === "Ít ca"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : r === "Sẵn sàng TC"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </label>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <label className="block space-y-2 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Ghi chú</span>
            <textarea
              name="note"
              rows={2}
              disabled={isPast}
              className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 ${isPast ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="VD: Gọi đổi ca đột xuất vì ốm..."
              defaultValue={currentAssignment?.note ?? ""}
            />
          </label>

          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {isPast ? "Đóng" : "Huỷ"}
            </button>
            {!isPast && (
              <SubmitButton className="px-6 rounded-2xl">
                <CheckCircle2 className="h-4 w-4" />
                Lưu thay đổi
              </SubmitButton>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
