"use client";

import { AlertTriangle, CalendarX2, X } from "lucide-react";
import type { LeaveRecord, Position, StaffMember } from "@/lib/types";
import { getStaffMatrixLabel } from "./types";

interface LeaveWarningModalProps {
  isOpen: boolean;
  staff: StaffMember | null;
  position: Position | null;
  slotLabel: string;
  leaveRecord: LeaveRecord | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// [QWEN3] Popup cảnh báo khi nhân viên được kéo/phân vào buổi/thứ đã có đăng ký nghỉ phép
export function LeaveWarningModal({
  isOpen,
  staff,
  position,
  slotLabel,
  leaveRecord,
  onConfirm,
  onCancel,
}: LeaveWarningModalProps) {
  if (!isOpen || !staff) return null;

  const matrixLabel = getStaffMatrixLabel(staff.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-inner">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Cảnh Báo Lịch Nghỉ Phép
              </h3>
              <p className="text-xs text-amber-700 font-medium">
                Nhân sự đã đăng ký nghỉ trong ca này!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nội dung chi tiết */}
        <div className="mt-4 space-y-3 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 text-xs text-slate-700">
          <div className="flex justify-between items-center py-1 border-b border-amber-200/50">
            <span className="text-slate-500 font-medium">Nhân sự:</span>
            <span className="font-bold text-slate-900 text-sm">
              {matrixLabel} ({staff.name})
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-amber-200/50">
            <span className="text-slate-500 font-medium">Buổi / Thứ:</span>
            <span className="font-bold text-teal-800 flex items-center gap-1">
              <CalendarX2 className="h-3.5 w-3.5 text-amber-600" />
              {slotLabel}
            </span>
          </div>

          {position && (
            <div className="flex justify-between items-center py-1 border-b border-amber-200/50">
              <span className="text-slate-500 font-medium">Phòng muốn gán:</span>
              <span className="font-bold text-slate-800">
                {position.name} {position.area ? `(${position.area})` : ""}
              </span>
            </div>
          )}

          {leaveRecord && (
            <div className="pt-1">
              <div className="text-slate-500 font-medium mb-1">Chi tiết nghỉ phép:</div>
              <div className="rounded-xl bg-white/90 p-2.5 border border-amber-200 text-amber-950 font-semibold space-y-0.5">
                {leaveRecord.reason && (
                  <div>
                    <span className="text-amber-800 font-normal">Lý do: </span>
                    <span className="capitalize">{leaveRecord.reason}</span>
                  </div>
                )}
                {leaveRecord.note && (
                  <div>
                    <span className="text-amber-800 font-normal">Ghi chú: </span>
                    <span>{leaveRecord.note}</span>
                  </div>
                )}
                {leaveRecord.shift && (
                  <div>
                    <span className="text-amber-800 font-normal">Phạm vi: </span>
                    <span>
                      {leaveRecord.shift === "full-day"
                        ? "Cả ngày"
                        : leaveRecord.shift === "morning"
                        ? "Buổi sáng"
                        : "Buổi chiều"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nút hành động */}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer shadow-2xs"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 active:scale-95 transition-all cursor-pointer"
          >
            Vẫn phân phòng
          </button>
        </div>
      </div>
    </div>
  );
}
