"use client";

import { useRef, useState } from "react";
import { History } from "lucide-react";
import { MultiSelectCombobox } from "@/components/multi-select-combobox";
import { SubmitButton } from "@/components/submit-button";
import { SHIFT_LABELS, WEEKDAY_LABELS } from "@/lib/constants";
import type { TemplateAssignment } from "@/lib/types";

interface StaffOption {
  id: string;
  name: string;
}

interface PositionOption {
  value: string;
  label: string;
  meta?: string;
}

interface TemplateAssignmentFormProps {
  action: (formData: FormData) => void;
  weekdayOptions: number[];
  shiftOptions: Array<["morning" | "afternoon", string]>;
  positionOptions: PositionOption[];
  activeStaff: StaffOption[];
  templateSchedule: TemplateAssignment[];
  editable: boolean;
}

export function TemplateAssignmentForm({
  action,
  weekdayOptions,
  shiftOptions,
  positionOptions,
  activeStaff,
  templateSchedule,
  editable,
}: TemplateAssignmentFormProps) {
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [checkedDays, setCheckedDays] = useState<number[]>([]);
  const [checkedShifts, setCheckedShifts] = useState<string[]>([]);
  const [recalledPositions, setRecalledPositions] = useState<string[]>([]);
  const [hasRecalled, setHasRecalled] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleRecall() {
    if (!selectedStaffId) return;

    // Tìm tất cả lịch nền của nhân sự đã chọn
    const staffAssignments = templateSchedule.filter(
      (a) => a.staffId === selectedStaffId,
    );

    if (staffAssignments.length === 0) {
      setCheckedDays([]);
      setCheckedShifts([]);
      setRecalledPositions([]);
      setHasRecalled(true);
      return;
    }

    // Extract ngày, ca, vị trí duy nhất
    const days = [...new Set(staffAssignments.map((a) => a.dayOfWeek))].sort();
    const shifts = [...new Set(staffAssignments.map((a) => a.shift))];
    const positions = [...new Set(staffAssignments.map((a) => a.positionId))];

    setCheckedDays(days);
    setCheckedShifts(shifts);
    setRecalledPositions(positions);
    setHasRecalled(true);
  }

  function toggleDay(day: number) {
    setCheckedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function toggleShift(shift: string) {
    setCheckedShifts((prev) =>
      prev.includes(shift) ? prev.filter((s) => s !== shift) : [...prev, shift],
    );
  }

  const staffAssignmentCount = selectedStaffId
    ? templateSchedule.filter((a) => a.staffId === selectedStaffId).length
    : 0;

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <input type="hidden" name="returnTo" value="/template" />

      {/* Nhân sự mặc định — Đưa lên đầu */}
      <div className="space-y-2 text-sm text-slate-700">
        <span className="font-medium">Nhân sự mặc định</span>
        <div className="flex gap-2">
          <select
            name="staffId"
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
            disabled={!editable}
            value={selectedStaffId}
            onChange={(e) => {
              setSelectedStaffId(e.target.value);
              setHasRecalled(false);
            }}
          >
            <option value="">-- Chọn nhân sự --</option>
            {activeStaff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedStaffId || !editable}
            onClick={handleRecall}
            className="inline-flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700 transition hover:border-teal-400 hover:bg-teal-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <History className="h-4 w-4" />
            Gọi lại
          </button>
        </div>
        {hasRecalled && (
          <p className="text-xs text-teal-600">
            {staffAssignmentCount > 0
              ? `Đã tải ${staffAssignmentCount} dòng lịch nền cũ → đã tick sẵn bên dưới.`
              : "Nhân sự này chưa có lịch nền nào."}
          </p>
        )}
      </div>

      {/* Ngày trong tuần */}
      <div className="space-y-2 text-sm text-slate-700">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">Ngày trong tuần</span>
          <span className="text-xs text-slate-400">Có thể chọn nhiều</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {weekdayOptions.map((dayOfWeek) => (
            <label
              key={dayOfWeek}
              className="group cursor-pointer"
            >
              <input
                type="checkbox"
                name="dayOfWeek"
                value={dayOfWeek}
                checked={checkedDays.includes(dayOfWeek)}
                onChange={() => toggleDay(dayOfWeek)}
                disabled={!editable}
                className="peer sr-only"
              />
              <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition group-hover:border-teal-300 group-hover:bg-teal-50 peer-checked:border-teal-500 peer-checked:bg-teal-500 peer-checked:text-white peer-disabled:cursor-not-allowed peer-disabled:bg-slate-100 peer-disabled:text-slate-400">
                {WEEKDAY_LABELS[dayOfWeek]}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Ca */}
      <div className="space-y-2 text-sm text-slate-700">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">Ca</span>
          <span className="text-xs text-slate-400">Có thể chọn nhiều</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {shiftOptions.map(([value, label]) => (
            <label key={value} className="group cursor-pointer">
              <input
                type="checkbox"
                name="shift"
                value={value}
                checked={checkedShifts.includes(value)}
                onChange={() => toggleShift(value)}
                disabled={!editable}
                className="peer sr-only"
              />
              <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition group-hover:border-teal-300 group-hover:bg-teal-50 peer-checked:border-slate-950 peer-checked:bg-slate-950 peer-checked:text-white peer-disabled:cursor-not-allowed peer-disabled:bg-slate-100 peer-disabled:text-slate-400">
                {label}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Vị trí đa chọn */}
      <MultiSelectCombobox
        name="positionId"
        label="Vị trí đa chọn"
        options={positionOptions}
        selectedValues={recalledPositions}
        disabled={!editable}
        placeholder="Chọn một hoặc nhiều vị trí"
        emptyText="Không tìm thấy vị trí."
      />

      {/* Ghi chú */}
      <label className="space-y-2 text-sm text-slate-700">
        <span className="font-medium">Ghi chú</span>
        <textarea
          name="note"
          rows={3}
          className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          placeholder="Ví dụ: ưu tiên điều dưỡng đã quen vị trí này"
          disabled={!editable}
        />
      </label>

      <SubmitButton disabled={!editable}>
        Lưu hàng loạt vào Lịch nền
      </SubmitButton>
    </form>
  );
}
