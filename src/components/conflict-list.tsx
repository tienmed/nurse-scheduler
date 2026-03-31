"use client";

import { useState } from "react";
import { parseISO } from "date-fns";
import { Pill } from "@/components/pill";
import { ShiftEditDialog } from "@/components/shift-edit-dialog";
import { LEAVE_SHIFT_LABELS } from "@/lib/constants";
import type { LeaveRecord, Position, StaffMember, WeeklyAssignment, WorkloadSummary } from "@/lib/types";

export interface ConflictListProps {
  conflicts: (WeeklyAssignment & { note?: string })[];
  staff: StaffMember[];
  positions: Position[];
  leaveRequests: LeaveRecord[];
  workload: WorkloadSummary[];
  weeklySchedule: WeeklyAssignment[];
  weekStart: string;
}

export function ConflictList({
  conflicts,
  staff,
  positions,
  leaveRequests,
  workload,
  weeklySchedule,
  weekStart,
}: ConflictListProps) {
  const [selectedConflict, setSelectedConflict] = useState<WeeklyAssignment | null>(null);

  if (conflicts.length === 0) return null;

  const displayLimit = 6;
  const visibleConflicts = conflicts.slice(0, displayLimit);
  const remainingCount = conflicts.length - displayLimit;

  // Render Dialog when a conflict is selected
  const renderDialog = () => {
    if (!selectedConflict) return null;

    const position = positions.find(p => p.id === selectedConflict.positionId);
    if (!position) return null;

    const dayOfWeek = parseISO(selectedConflict.date).getDay();

    return (
      <ShiftEditDialog
        isOpen={true}
        onClose={() => setSelectedConflict(null)}
        date={selectedConflict.date}
        shift={selectedConflict.shift}
        position={position}
        currentAssignment={selectedConflict}
        slotIndex={selectedConflict.slotIndex}
        dayOfWeek={dayOfWeek}
        mode="weekly"
        staff={staff}
        positions={positions}
        leaveRequests={leaveRequests}
        workload={workload}
        weeklySchedule={weeklySchedule}
        weekStart={weekStart}
        returnTo="/"
      />
    );
  };

  return (
    <>
      <div className="space-y-4">
        {visibleConflicts.map((conflict, idx) => {
          const person = staff.find((s) => s.id === conflict.staffId);
          const pName = person?.name || conflict.staffId;
          const pos = positions.find((p) => p.id === conflict.positionId);
          const posName = pos?.name || conflict.positionId;

          return (
            <div
              key={`${conflict.id}-${idx}`}
              onClick={() => setSelectedConflict(conflict)}
              className="group cursor-pointer flex flex-col gap-3 rounded-[20px] bg-rose-50 px-5 py-4 shadow-sm ring-1 ring-inset ring-rose-200/60 transition-all hover:bg-rose-100/50 hover:shadow-md active:scale-[0.99] md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold text-rose-950 group-hover:text-rose-700 transition-colors">{pName}</p>
                <p className="mt-1 text-sm text-rose-700">
                  Đang xếp vào <span className="font-semibold">{posName}</span> (Ca {LEAVE_SHIFT_LABELS[conflict.shift]} • {conflict.date})
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 md:flex-row md:items-center">
                <Pill tone="rose">Xung đột: {conflict.note}</Pill>
                <span className="text-xs font-semibold text-rose-600 bg-white border border-rose-200 rounded-full px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Đổi người →
                </span>
              </div>
            </div>
          );
        })}
        {remainingCount > 0 && (
          <p className="text-center text-sm font-medium text-rose-600">
            Và {remainingCount} trường hợp khác đang đợi giải quyết...
          </p>
        )}
      </div>

      {renderDialog()}
    </>
  );
}
