"use client";

import { useState } from "react";
import { AlertCircle, RotateCcw, X } from "lucide-react";
import type { LeaveRecord, Position, StaffMember } from "@/lib/types";
import { getAreaStyle } from "./types";
import { LEAVE_REASON_LABELS } from "@/lib/constants";

interface StaffDropCardProps {
  staff: StaffMember;
  assignedPositions: Position[];
  leave?: LeaveRecord | null;
  draggedPositionId?: string | null;
  onAssignPosition: (staffId: string, positionId: string) => void;
  onRemovePosition: (staffId: string, positionId: string) => void;
  onClearAllPositions: (staffId: string) => void;
}

export function StaffDropCard({
  staff,
  assignedPositions,
  leave,
  draggedPositionId,
  onAssignPosition,
  onRemovePosition,
  onClearAllPositions,
}: StaffDropCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    let positionId = draggedPositionId;
    if (!positionId) {
      positionId = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text");
    }
    if (!positionId) {
      try {
        const json = e.dataTransfer.getData("application/json");
        if (json) {
          const parsed = JSON.parse(json);
          positionId = parsed.positionId;
        }
      } catch {
        // ignore
      }
    }

    if (positionId) {
      onAssignPosition(staff.id, positionId);
    }
  };

  const hasAssigned = assignedPositions.length > 0;
  const isLeave = Boolean(leave);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col justify-between rounded-3xl border p-4 shadow-sm transition-all duration-150 ${
        isDragOver
          ? "border-teal-500 bg-teal-50/60 ring-4 ring-teal-100 scale-[1.01]"
          : isLeave
          ? "border-amber-200/90 bg-amber-50/30 hover:border-amber-300 hover:shadow-md"
          : hasAssigned
          ? "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md"
          : "border-dashed border-slate-300 bg-slate-50/70 hover:border-slate-400 hover:bg-slate-50"
      }`}
    >
      {/* Phần thông tin nhân sự */}
      <div>
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-bold ${
                isLeave
                  ? "bg-amber-100 text-amber-700"
                  : hasAssigned
                  ? "bg-teal-100 text-teal-800"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {staff.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900" title={staff.name}>
                {staff.name}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                Mã: {staff.code || staff.id}
              </p>
            </div>
          </div>

          {/* Badge trạng thái */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isLeave && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800" title={leave?.note || "Đang có lịch nghỉ"}>
                <AlertCircle className="h-3 w-3" />
                Nghỉ {leave?.reason ? LEAVE_REASON_LABELS[leave.reason] : "phép"}
              </span>
            )}
            {hasAssigned && (
              <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                {assignedPositions.length} phòng
              </span>
            )}
          </div>
        </div>

        {/* Danh sách phòng đã phân công */}
        <div className="mt-3 min-h-[48px]">
          {hasAssigned ? (
            <div className="flex flex-wrap gap-1.5">
              {assignedPositions.map((pos) => {
                const style = getAreaStyle(pos.area);

                return (
                  <div
                    key={pos.id}
                    className={`inline-flex items-center gap-1.5 rounded-xl border ${style.border} ${style.lightBg} py-1 pl-2.5 pr-1.5 text-xs font-semibold ${style.text} shadow-2xs group transition-all`}
                  >
                    <span className="truncate max-w-[130px]" title={`${pos.name} (${pos.area})`}>
                      {pos.name}
                    </span>

                    {/* [QWEN3] Nút tháo phòng: Cho phép gỡ bỏ phòng khỏi nhân sự ngay tức thì */}
                    <button
                      type="button"
                      onClick={() => onRemovePosition(staff.id, pos.id)}
                      title={`Tháo phòng ${pos.name} khỏi ${staff.name}`}
                      className="flex h-4 w-4 items-center justify-center rounded-md hover:bg-black/10 active:scale-90 transition-colors cursor-pointer text-slate-500 hover:text-rose-600"
                    >
                      <X className="h-3 w-3 stroke-[2.5]" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-12 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 text-center">
              <p className="text-xs text-slate-400">
                {isDragOver ? "Thả thẻ phòng vào đây!" : "Chưa có phòng • Kéo phòng thả vào"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer thẻ: Nút Tháo tất cả khi nhân sự có từ 1 phòng trở lên */}
      {hasAssigned && (
        <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => onClearAllPositions(staff.id)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
            title="Tháo tất cả các phòng đang phân cho nhân sự này"
          >
            <RotateCcw className="h-3 w-3" />
            Tháo toàn bộ phòng
          </button>
        </div>
      )}
    </div>
  );
}
