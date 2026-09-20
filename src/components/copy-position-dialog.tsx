"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, AlertTriangle } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { SHIFT_LABELS, WEEKDAY_LABELS } from "@/lib/constants";
import { copyPositionAssignmentsAction } from "@/app/actions";
import { addDays, parseISO, format } from "date-fns";
import type { Position, ShiftType } from "@/lib/types";

interface CopyPositionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  weekStart: string;
  sourceDate: string;
  sourceShift: ShiftType;
  position: Position;
  returnTo: string;
}

export function CopyPositionDialog({
  isOpen,
  onClose,
  weekStart,
  sourceDate,
  sourceShift,
  position,
  returnTo,
}: CopyPositionDialogProps) {
  const [checkedDates, setCheckedDates] = useState<string[]>([]);
  const [checkedShifts, setCheckedShifts] = useState<string[]>([]);

  if (!isOpen) return null;

  // Generate week dates (Mon-Sun)
  const weekDates = Array.from({ length: 7 }).map((_, i) => {
    const date = addDays(parseISO(weekStart), i);
    return {
      dateStr: format(date, "yyyy-MM-dd"),
      dayOfWeek: i + 1, // 1 = Monday, ..., 7 = Sunday
    };
  });

  const shiftOptions: Array<["morning" | "afternoon", string]> = [
    ["morning", "Sáng"],
    ["afternoon", "Chiều"],
  ];

  function toggleDate(dateStr: string) {
    setCheckedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  }

  function toggleShift(shift: string) {
    setCheckedShifts((prev) =>
      prev.includes(shift) ? prev.filter((s) => s !== shift) : [...prev, shift]
    );
  }

  const isValid = checkedDates.length > 0 && checkedShifts.length > 0;

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <Copy className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              Sao chép phân công
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form action={copyPositionAssignmentsAction} className="p-6">
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="weekStart" value={weekStart} />
          <input type="hidden" name="sourceDate" value={sourceDate} />
          <input type="hidden" name="sourceShift" value={sourceShift} />
          <input type="hidden" name="positionId" value={position.id} />

          <div className="mb-6 rounded-xl bg-slate-50 p-4 border border-slate-100 text-sm">
            Nguồn: <strong className="font-semibold">{position.name}</strong>, ca{" "}
            <strong className="font-semibold">{SHIFT_LABELS[sourceShift]}</strong>{" "}
            ngày {format(parseISO(sourceDate), "dd/MM")}.
          </div>

          <div className="space-y-6">
            {/* Dest Dates */}
            <div className="space-y-3">
              <span className="text-sm font-medium text-slate-700">Chọn ngày đích (có thể chọn nhiều):</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {weekDates.map((item) => {
                  const isSource = item.dateStr === sourceDate;
                  return (
                    <label
                      key={item.dateStr}
                      className={`group cursor-pointer ${isSource ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        name="destDate"
                        value={item.dateStr}
                        checked={checkedDates.includes(item.dateStr)}
                        onChange={() => toggleDate(item.dateStr)}
                        disabled={isSource}
                        className="peer sr-only"
                      />
                      <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-2 text-center text-sm font-medium text-slate-600 transition group-hover:border-indigo-300 group-hover:bg-indigo-50 peer-checked:border-indigo-500 peer-checked:bg-indigo-500 peer-checked:text-white peer-disabled:cursor-not-allowed">
                        {WEEKDAY_LABELS[item.dayOfWeek]}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Dest Shifts */}
            <div className="space-y-3">
              <span className="text-sm font-medium text-slate-700">Chọn ca đích (có thể chọn nhiều):</span>
              <div className="grid grid-cols-2 gap-2">
                {shiftOptions.map(([value, label]) => (
                  <label key={value} className="group cursor-pointer">
                    <input
                      type="checkbox"
                      name="destShift"
                      value={value}
                      checked={checkedShifts.includes(value)}
                      onChange={() => toggleShift(value)}
                      className="peer sr-only"
                    />
                    <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-2 text-center text-sm font-medium text-slate-600 transition group-hover:border-indigo-300 group-hover:bg-indigo-50 peer-checked:border-slate-950 peer-checked:bg-slate-950 peer-checked:text-white">
                      {label}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3 text-sm text-rose-700">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>
                <strong>Cảnh báo:</strong> Phân công hiện tại ở các vị trí đích sẽ bị <strong>ghi đè (xóa sạch)</strong> và thay thế bằng danh sách nhân sự của vị trí nguồn.
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Hủy
            </button>
            <SubmitButton 
              disabled={!isValid}
              variant="primary"
              className="bg-indigo-600 hover:bg-indigo-700 text-white border-none"
              confirmMessage="Bạn có chắc chắn muốn SAO CHÉP ĐÈ lên các buổi đích không? Toàn bộ nhân sự ở đích sẽ bị xóa và thay thế."
            >
              Xác nhận sao chép
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}
