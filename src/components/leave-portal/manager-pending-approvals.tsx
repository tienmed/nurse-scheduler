"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import type { LeaveRecord, StaffMember } from "@/lib/types";
import { approveLeaveFromWebAction, rejectLeaveFromWebAction } from "@/app/dang-ky-phep/actions";
import { LEAVE_REASON_LABELS, LEAVE_SHIFT_LABELS } from "@/lib/constants";

interface ManagerPendingApprovalsProps {
  pendingLeaves: LeaveRecord[];
  allStaff: StaffMember[];
}

export function ManagerPendingApprovals({
  pendingLeaves,
  allStaff,
}: ManagerPendingApprovalsProps) {
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  // Nhóm các ca pending theo approveToken hoặc staffId + ngày tạo (để hiển thị theo đợt nộp)
  const groupedRequests = pendingLeaves.reduce<
    Record<
      string,
      {
        token: string;
        staffId: string;
        staffName: string;
        staffCode: string;
        staffEmail: string;
        createdAt: string;
        urgentNote?: string;
        items: LeaveRecord[];
      }
    >
  >((acc, leave) => {
    const groupKey = leave.approveToken || `${leave.staffId}-${leave.createdAt?.slice(0, 10) || "legacy"}`;
    if (!acc[groupKey]) {
      const person = allStaff.find((s) => s.id === leave.staffId);
      acc[groupKey] = {
        token: leave.approveToken || "",
        staffId: leave.staffId,
        staffName: person?.name || leave.staffId,
        staffCode: person?.code || "",
        staffEmail: person?.email || "",
        createdAt: leave.createdAt || leave.date,
        urgentNote: leave.note,
        items: [],
      };
    }
    acc[groupKey].items.push(leave);
    return acc;
  }, {});

  const groupsList = Object.values(groupedRequests).sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || ""),
  );

  const handleApprove = (token?: string, leaveId?: string) => {
    const targetKey = token || leaveId || "all";
    setProcessingId(targetKey);
    setFeedback(null);

    startTransition(async () => {
      const res = await approveLeaveFromWebAction({
        approveToken: token,
        leaveId,
      });
      setProcessingId(null);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  const handleReject = (token?: string, leaveId?: string) => {
    if (!confirm("Bạn có chắc chắn muốn TỪ CHỐI ca/đơn nghỉ phép này không?")) return;

    const targetKey = token || leaveId || "all";
    setProcessingId(targetKey);
    setFeedback(null);

    startTransition(async () => {
      const res = await rejectLeaveFromWebAction({
        approveToken: token,
        leaveId,
      });
      setProcessingId(null);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  if (groupsList.length === 0) {
    return (
      <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/50 to-white p-8 text-center space-y-4 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            Không có đơn nghỉ phép nào đang chờ duyệt
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Tuyệt vời! Tất cả các đơn xin nghỉ phép hợp lệ đã được hệ thống tự động duyệt hoặc Quản lý đã xử lý hoàn tất.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Banner thông báo kết quả thao tác */}
      {feedback && (
        <div
          className={`rounded-2xl p-4 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-sm border ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold underline opacity-70 hover:opacity-100"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Header hướng dẫn */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white font-bold shadow-sm">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Danh sách đơn nghỉ phép chờ Quản lý duyệt ({pendingLeaves.length} ca)
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Các ca nghỉ vượt định mức (≥ 2 người nghỉ/buổi hoặc ≥ 3 người đi học) đang chờ phê duyệt. Bạn có thể duyệt trực tiếp tại đây khi chưa kịp duyệt qua email.
            </p>
          </div>
        </div>
      </div>

      {/* Danh sách các đơn theo khối phiếu */}
      <div className="space-y-4">
        {groupsList.map((group, groupIndex) => {
          const isGroupProcessing = processingId === group.token || isPending;
          let createdDateFormatted = group.createdAt;
          try {
            createdDateFormatted = format(parseISO(group.createdAt), "HH:mm dd/MM/yyyy", {
              locale: vi,
            });
          } catch {}

          return (
            <div
              key={group.token || groupIndex}
              className="rounded-2xl sm:rounded-3xl border-2 border-amber-300/80 bg-white p-4 sm:p-5 shadow-sm space-y-4 hover:shadow-md transition"
            >
              {/* Header Thẻ: Thông tin nhân sự */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800 font-bold">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                        {group.staffName}
                      </span>
                      {group.staffCode && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">
                          {group.staffCode}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500">
                      Gửi lúc: {createdDateFormatted} · {group.items.length} ca nghỉ
                    </p>
                  </div>
                </div>

                {/* Nút Duyệt toàn bộ phiếu (Touch-Friendly cho Mobile) */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    disabled={isGroupProcessing}
                    onClick={() => handleReject(group.token, group.items[0]?.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Từ chối
                  </button>

                  <button
                    type="button"
                    disabled={isGroupProcessing}
                    onClick={() => handleApprove(group.token, group.items[0]?.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-600/20 hover:bg-teal-700 transition disabled:opacity-50"
                  >
                    {isGroupProcessing ? (
                      <Clock className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Duyệt đơn này ({group.items.length} ca)
                  </button>
                </div>
              </div>

              {/* Chi tiết từng ca trong phiếu */}
              <div className="grid gap-2 sm:grid-cols-2">
                {group.items.map((item) => {
                  let dateLabel = item.date;
                  try {
                    dateLabel = format(parseISO(item.date), "EEEE, dd/MM/yyyy", { locale: vi });
                  } catch {}

                  const shiftLabel = LEAVE_SHIFT_LABELS[item.shift] || item.shift;
                  const reasonLabel = LEAVE_REASON_LABELS[item.reason] || item.reason;
                  const isMorning = item.shift === "morning";
                  const isAfternoon = item.shift === "afternoon";
                  const shiftBadgeBg = isMorning
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : isAfternoon
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : "bg-teal-100 text-teal-800 border-teal-200";

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 capitalize flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {dateLabel}
                        </span>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${shiftBadgeBg}`}
                        >
                          {shiftLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700">{reasonLabel}</span>
                        {item.note && (
                          <span className="truncate italic text-slate-500 max-w-[160px]">
                            {item.note}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
