"use client";

import { useState } from "react";
import { AlertCircle, Plus, X } from "lucide-react";
import type { LeaveRecord, Position, StaffMember } from "@/lib/types";
import { getStaffColorStyle, getStaffMatrixLabel } from "./types";
import type { SlotInfo } from "./room-summary-matrix";

interface RoomMatrixCellProps {
  position: Position;
  slot: SlotInfo;
  assignedStaff: StaffMember[];
  leaveMap: Map<string, LeaveRecord>;
  selectedStaffId: string | null;
  editable: boolean;
  onAssignStaff: (staffId: string, positionId: string, slotKey: string) => void;
  onRemoveStaff: (staffId: string, positionId: string, slotKey: string) => void;
  onMoveStaff?: (
    staffId: string,
    sourcePositionId: string,
    sourceSlotKey: string,
    targetPositionId: string,
    targetSlotKey: string,
  ) => void;
}

// [QWEN3] Ã” ma tráº­n phÃ¢n phÃ²ng theo ca: nháº­n kÃ©o tháº£ tháº» nhÃ¢n viÃªn, hiá»ƒn thá»‹ "ÄD TÃªn", cÃ³ nÃºt thÃ¡o phÃ²ng
export function RoomMatrixCell({
  position,
  slot,
  assignedStaff,
  leaveMap,
  selectedStaffId,
  editable,
  onAssignStaff,
  onRemoveStaff,
  onMoveStaff,
}: RoomMatrixCellProps) {
  const [isOver, setIsOver] = useState(false);
  const slotKey = `${slot.date}_${slot.shift}`;

  const handleDragOver = (e: React.DragEvent) => {
    if (!editable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!editable) return;
    e.preventDefault();
    setIsOver(false);

    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const data = JSON.parse(dataStr);

      if (data.type === "staff" && data.staffId) {
        // Náº¿u kÃ©o tá»« má»™t Ã´ khÃ¡c sang
        if (data.sourcePositionId && data.sourceSlotKey && onMoveStaff) {
          onMoveStaff(
            data.staffId,
            data.sourcePositionId,
            data.sourceSlotKey,
            position.id,
            slotKey,
          );
        } else {
          // KÃ©o má»›i tá»« kho tháº» nhÃ¢n viÃªn
          onAssignStaff(data.staffId, position.id, slotKey);
        }
      }
    } catch (err) {
      console.error("Lá»—i khi drop tháº» nhÃ¢n sá»±:", err);
    }
  };

  const handleClickCell = () => {
    if (!editable || !selectedStaffId) return;
    onAssignStaff(selectedStaffId, position.id, slotKey);
  };

  return (
    <td
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClickCell}
      className={`border-r border-b border-slate-200/90 p-1.5 align-top min-w-[125px] transition-all ${
        isOver
          ? "bg-teal-100/90 ring-2 ring-teal-500 ring-inset"
          : selectedStaffId
          ? "hover:bg-teal-50/70 cursor-pointer"
          : ""
      }`}
    >
      <div className="flex flex-col gap-1 min-h-[38px] justify-center">
        {assignedStaff.map((person) => {
          const matrixLabel = getStaffMatrixLabel(person.name);
          const hasLeave = leaveMap.has(`${person.id}_${slotKey}`);
          const colorStyle = getStaffColorStyle(person.id || person.name);

          return (
            <div
              key={person.id}
              draggable={editable}
              onDragStart={(e) => {
                if (!editable) return;
                e.dataTransfer.setData(
                  "application/json",
                  JSON.stringify({
                    type: "staff",
                    staffId: person.id,
                    sourcePositionId: position.id,
                    sourceSlotKey: slotKey,
                  }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
              className={`group/card relative flex items-center justify-between rounded-xl px-2 py-1 text-xs font-bold transition-all shadow-2xs border ${
                hasLeave
                  ? "bg-amber-100 text-amber-950 border-amber-400 ring-2 ring-amber-400/80"
                  : `${colorStyle.bg} ${colorStyle.border} ${colorStyle.text} hover:shadow-xs`
              } ${editable ? "cursor-grab active:cursor-grabbing hover:scale-102" : ""}`}
              title={`${matrixLabel} (${person.name}) - KÃ©o Ä‘á»ƒ chuyá»ƒn phÃ²ng, hoáº·c nháº¥p âœ• Ä‘á»ƒ thÃ¡o.`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {hasLeave ? (
                  <span title="NhÃ¢n sá»± cÃ³ Ä‘Æ¡n nghá»‰ phÃ©p ca nÃ y!">
                    <AlertCircle className="h-3 w-3 shrink-0 text-amber-600" />
                  </span>
                ) : (
                  <span className={`h-2 w-2 shrink-0 rounded-full ${colorStyle.avatarBg}`} />
                )}
                {/* [QWEN3] Hiá»ƒn thá»‹ gá»n 'ÄD TÃªn' vá»›i mÃ u sáº¯c Ä‘áº·c trÆ°ng cá»§a tá»«ng nhÃ¢n sá»± */}
                <span className="truncate text-[11px] font-bold">
                  {matrixLabel}
                </span>
              </div>

              {/* NÃºt thÃ¡o phÃ²ng: gá»¡ nhÃ¢n sá»± khá»i phÃ²ng */}
              {editable && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveStaff(person.id, position.id, slotKey);
                  }}
                  className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full opacity-60 hover:opacity-100 hover:bg-rose-100 hover:text-rose-600 transition-all cursor-pointer"
                  title={`ThÃ¡o ${matrixLabel} khá»i phÃ²ng ${position.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* NÃºt gá»£i Ã½ gÃ¡n khi Ã´ trá»‘ng vÃ  Ä‘ang chá»n nhÃ¢n sá»± */}
        {assignedStaff.length === 0 && (
          <div className="flex items-center justify-center py-1 text-slate-300 text-[11px]">
            {selectedStaffId ? (
              <span className="flex items-center gap-1 text-teal-600 font-semibold text-[10px] bg-teal-50/80 rounded-lg px-1.5 py-0.5 border border-teal-200">
                <Plus className="h-3 w-3" /> Tháº£ / Nháº¥p
              </span>
            ) : (
              <span className="select-none">-</span>
            )}
          </div>
        )}
      </div>
    </td>
  );
}
