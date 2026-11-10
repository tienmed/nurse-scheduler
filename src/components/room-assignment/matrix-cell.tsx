"use client";

import { useState } from "react";
import { AlertCircle, Plus, X } from "lucide-react";
import type { LeaveRecord, Position, StaffMember } from "@/lib/types";
import { getAreaStyle } from "./types";
import type { SlotInfo } from "./room-summary-matrix";
import { LEAVE_REASON_LABELS } from "@/lib/constants";

interface MatrixCellProps {
  staff: StaffMember;
  slot: SlotInfo;
  assignedPositions: Position[];
  leave?: LeaveRecord | null;
  draggedPosition: Position | null;
  selectedPosition: Position | null;
  onAssignPosition: (staffId: string, slotKey: string, positionId: string) => void;
  onRemovePosition: (staffId: string, slotKey: string, positionId: string) => void;
  editable?: boolean;
}

export function MatrixCell({
  staff,
  slot,
  assignedPositions,
  leave,
  draggedPosition,
  selectedPosition,
  onAssignPosition,
  onRemovePosition,
  editable = true,
}: MatrixCellProps) {
  const [isHovered, setIsHovered] = useState(false);
  const slotKey = `${slot.date}_${slot.shift}`;
  const isLeave = Boolean(leave);
  const hasAssigned = assignedPositions.length > 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    if (!isHovered) setIsHovered(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovered(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsHovered(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovered(false);

    if (!editable) return;

    let posId = draggedPosition?.id;
    if (!posId) {
      posId = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text");
    }
    if (!posId) {
      try {
        const json = e.dataTransfer.getData("application/json");
        if (json) {
          const parsed = JSON.parse(json);
          posId = parsed.positionId;
        }
      } catch {
        // ignore
      }
    }
    if (!posId && selectedPosition) {
      posId = selectedPosition.id;
    }

    if (posId) {
      onAssignPosition(staff.id, slotKey, posId);
    }
  };

  const handleClick = () => {
    if (!editable) return;
    if (selectedPosition) {
      onAssignPosition(staff.id, slotKey, selectedPosition.id);
    }
  };

  return (
    <td
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`min-w-[125px] max-w-[150px] border-r border-b border-slate-200/80 p-1.5 align-top transition-all duration-150 ${
        isHovered
          ? "border-teal-500 bg-teal-50/80 ring-2 ring-inset ring-teal-300"
          : selectedPosition
          ? "cursor-pointer hover:bg-teal-50/40"
          : isLeave
          ? "bg-amber-50/20"
          : "bg-white"
      }`}
    >
      <div className="flex min-h-[44px] flex-col justify-between gap-1">
        {/* Cảnh báo nghỉ phép */}
        {isLeave && (
          <div className="flex items-center gap-1 rounded-md bg-amber-100/80 px-1.5 py-0.5 text-[9px] font-bold text-amber-900 pointer-events-none">
            <AlertCircle className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">
              Nghỉ {leave?.reason ? LEAVE_REASON_LABELS[leave.reason] : "phép"}
            </span>
          </div>
        )}

        {/* [QWEN3] Cảnh báo quá tải khi gánh >= 4 vị trí trong ca */}
        {assignedPositions.length >= 4 && (
          <div
            className="flex items-center gap-1 rounded-md bg-rose-100/90 border border-rose-300 px-1.5 py-0.5 text-[9px] font-bold text-rose-800 animate-pulse pointer-events-none"
            title="Nhân sự đang phụ trách ≥ 4 vị trí trong ca này (nguy cơ quá tải). Cần điều hỗ trợ từ Đo sinh hiệu / KHNV."
          >
            <AlertCircle className="h-2.5 w-2.5 shrink-0 text-rose-600" />
            <span className="truncate">Quá tải ({assignedPositions.length} phòng)</span>
          </div>
        )}

        {/* Danh sách phòng đã phân công trong ô này */}
        {hasAssigned ? (
          <div className="flex flex-wrap gap-1">
            {assignedPositions.map((pos) => {
              const style = getAreaStyle(pos.area);

              return (
                <div
                  key={pos.id}
                  className={`group inline-flex items-center gap-1 rounded-lg border ${style.border} ${style.lightBg} px-1.5 py-0.5 text-[11px] font-semibold ${style.text} shadow-2xs transition-all`}
                  title={`${pos.name} (${pos.area || "Khu vực khác"})`}
                >
                  <span className="truncate max-w-[85px]">{pos.name}</span>

                  {/* [QWEN3] Nút tháo phòng trên từng thẻ đã gán */}
                  {editable && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePosition(staff.id, slotKey, pos.id);
                      }}
                      title={`Tháo phòng ${pos.name}`}
                      className="flex h-3.5 w-3.5 items-center justify-center rounded hover:bg-black/10 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                    >
                      <X className="h-2.5 w-2.5 stroke-[2.5]" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className={`flex h-9 items-center justify-center rounded-lg border border-dashed transition-all ${
              isHovered
                ? "border-teal-400 bg-teal-100/50 text-teal-800 font-bold"
                : selectedPosition
                ? "border-teal-200 bg-teal-50/30 text-teal-600 hover:border-teal-400"
                : "border-slate-200 text-slate-300"
            }`}
          >
            {isHovered ? (
              <span className="text-[10px] font-bold">Thả vào đây</span>
            ) : selectedPosition ? (
              <span className="flex items-center gap-0.5 text-[10px] font-medium">
                <Plus className="h-3 w-3" /> Nhấp gán
              </span>
            ) : (
              <span className="text-[11px] select-none text-slate-300">-</span>
            )}
          </div>
        )}
      </div>
    </td>
  );
}
