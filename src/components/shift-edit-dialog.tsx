"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, X, Search } from "lucide-react";
import { Pill } from "@/components/pill";
import { SubmitButton } from "@/components/submit-button";
import { SHIFT_LABELS, WEEKDAY_LABELS } from "@/lib/constants";
import { suggestStaffForSlot } from "@/lib/schedule";
import { isPastShift } from "@/lib/date";
import type { LeaveRecord, Position, StaffMember, WeeklyAssignment, WorkloadSummary, ShiftType } from "@/lib/types";
import { saveMultiAssignmentsAction } from "@/app/actions";

interface SlotEntry {
  assignment?: WeeklyAssignment | null;
  person?: StaffMember | null;
  slotIndex: number;
}

interface ShiftEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  date: string; // yyyy-MM-dd
  shift: ShiftType;
  position: Position;
  currentSlots?: SlotEntry[];
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
  currentSlots = [],
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
  const isClosedInit = currentSlots.some((s) => s.assignment?.staffId === "CLOSED");
  const initialStaffIds = currentSlots
    .map((s) => s.assignment?.staffId || s.person?.id)
    .filter((id) => id && id !== "CLOSED") as string[];

  const [isClosed, setIsClosed] = useState(isClosedInit);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(initialStaffIds);
  const [searchQuery, setSearchQuery] = useState("");
  void anchorRect;

  // Lấy danh sách gợi ý
  const suggestions = useMemo(() => suggestStaffForSlot(
    staff,
    positions,
    date,
    shift,
    position.id,
    leaveRequests,
    workload,
    weeklySchedule
  ), [staff, positions, date, shift, position.id, leaveRequests, workload, weeklySchedule]);

  if (!isOpen) return null;

  // Lọc theo từ khóa tìm kiếm
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredSuggestions = suggestions.filter((sug) =>
    sug.staff.name.toLowerCase().includes(normalizedQuery) ||
    (sug.staff.code && sug.staff.code.toLowerCase().includes(normalizedQuery))
  );

  const isPast = mode !== "template" && isPastShift(date, shift);

  function toggleStaff(staffId: string) {
    setSelectedStaffIds((prev) => 
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  }

  const dialogContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-all duration-300" onClick={onClose} />
      <div className="relative z-[9999] w-full max-w-lg max-h-[85vh] flex flex-col rounded-[2rem] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 md:p-6 pb-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 rounded-full p-2 text-slate-400 opacity-70 transition hover:bg-slate-100 hover:text-slate-600 hover:opacity-100"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Đóng</span>
          </button>

          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
              {mode === "weekly" ? "Phân công tuần" : "Lịch nền"}
            </span>
          </div>

          <h2 className="mb-1 text-2xl font-bold tracking-tight text-slate-800">
            {position.name}
          </h2>
          <p className="text-sm font-medium text-slate-500">
            {WEEKDAY_LABELS[dayOfWeek]} • Ca {SHIFT_LABELS[shift]}
            {mode === "weekly" && ` • ${date}`}
          </p>
        </div>

        <form action={saveMultiAssignmentsAction} className="flex flex-col min-h-0 overflow-hidden">
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="shift" value={shift} />
          <input type="hidden" name="positionId" value={position.id} />
          <input type="hidden" name="dayOfWeek" value={dayOfWeek.toString()} />
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="weekStart" value={weekStart} />
          
          {isClosed ? (
            <input type="hidden" name="staffIds" value="CLOSED" />
          ) : (
            selectedStaffIds.map((id) => (
              <input key={id} type="hidden" name="staffIds" value={id} />
            ))
          )}

          <div className="px-5 md:px-6 py-3 shrink-0 border-b border-slate-100">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={isClosed} 
                onChange={(e) => setIsClosed(e.target.checked)} 
                className="w-5 h-5 rounded border-slate-300 text-rose-600 focus:ring-rose-600"
              />
              <span className="text-sm font-semibold text-rose-700 group-hover:text-rose-800 transition">
                Đóng vị trí này (không xếp người)
              </span>
            </label>
          </div>

          {!isClosed && (
            <div className="px-5 md:px-6 py-4 shrink-0">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm nhân sự..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border-0 bg-slate-50 py-3.5 pl-10 pr-4 text-sm font-medium text-slate-900 ring-1 ring-inset ring-slate-200 transition-all placeholder:text-slate-400 hover:bg-slate-100/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-600"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 md:px-6 pb-6">
            {!isClosed && (
              <div className="space-y-2">
                {filteredSuggestions.length > 0 ? (
                  filteredSuggestions.map(({ staff, isAvailable, leaveReason, score, missingSkills, consecutiveShifts }) => {
                    const isSelected = selectedStaffIds.includes(staff.id);
                    return (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => toggleStaff(staff.id)}
                        className={`group relative flex w-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all duration-200 ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/50 shadow-sm"
                            : !isAvailable
                              ? "border-slate-100 bg-slate-50/50 opacity-75 hover:bg-slate-100"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className="flex flex-col">
                            <span className={`font-semibold ${isSelected ? "text-indigo-900" : "text-slate-800"}`}>
                              {staff.name}
                            </span>
                          </div>
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
                            isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white group-hover:border-slate-400"
                          }`}>
                            {isSelected && <CheckCircle2 className="h-4 w-4" />}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 w-full">
                          <Pill variant={isAvailable ? "success" : "danger"}>
                            {isAvailable ? "Sẵn sàng" : leaveReason ? LEAVE_REASON_LABELS[leaveReason] : "Bận"}
                          </Pill>
                          
                          {score !== undefined && score > 0 && isAvailable && (
                            <Pill variant="neutral" className="bg-amber-100/50 text-amber-700">
                              Điểm ưu tiên: {score}
                            </Pill>
                          )}
                          
                          {missingSkills && missingSkills.length > 0 && (
                            <Pill variant="neutral" className="bg-rose-100/50 text-rose-700 max-w-[200px] truncate" title={missingSkills.join(", ")}>
                              Thiếu: {missingSkills.join(", ")}
                            </Pill>
                          )}
                          
                          {consecutiveShifts !== undefined && consecutiveShifts >= 2 && (
                            <Pill variant="neutral" className="bg-orange-100/50 text-orange-700">
                              Đã làm {consecutiveShifts} ca liên tiếp
                            </Pill>
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-slate-500">
                      Không tìm thấy nhân sự phù hợp
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 p-5 md:p-6 border-t border-slate-100 bg-white">
            <SubmitButton 
              disabled={isPast || (!isClosed && selectedStaffIds.length === 0)}
              variant="primary" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white border-none py-3"
            >
              Lưu thay đổi ({isClosed ? 1 : selectedStaffIds.length} nhân sự)
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(dialogContent, document.body) : null;
}
