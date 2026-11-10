"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import type { WeeklyAssignment } from "@/lib/types";

interface DiffChangeItem {
  id: string;
  date: string;
  dayLabel: string;
  shift: string;
  shiftLabel: string;
  positionId: string;
  positionName: string;
  oldStaffName: string;
  newStaffName: string;
  reason: string;
}

interface SmartExportAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAssignments: WeeklyAssignment[];
  onApplyToBoard?: (updated: WeeklyAssignment[]) => void;
  orderedPositionIds?: string[];
}

export function SmartExportAdjustModal({
  isOpen,
  onClose,
  currentAssignments,
  onApplyToBoard,
  orderedPositionIds = [],
}: SmartExportAdjustModalProps) {
  // Lựa chọn tuần: "current" (tuần hiện tại đang chạy) | "next" (tuần tiếp theo)
  const [scope, setScope] = useState<"current" | "next">("next");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  // Kết quả sau khi AI chạy lại lịch
  const [result, setResult] = useState<{
    diffChanges: DiffChangeItem[];
    recommendations: string[];
    summary: string;
    updatedAssignments: WeeklyAssignment[];
    weekStart: string;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Xử lý gửi phản hồi / chạy lại lịch
  const handleAnalyzeAndReSchedule = () => {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/schedule/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope,
            feedback,
            currentAssignments,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Không thể điều chỉnh lịch tự động.");
        }

        setResult({
          diffChanges: data.diffChanges || [],
          recommendations: data.recommendations || [],
          summary: data.summary || "",
          updatedAssignments: data.updatedAssignments || [],
          weekStart: data.weekStart,
        });
      } catch (err: any) {
        setErrorMessage(err.message || "Đã xảy ra lỗi khi kết nối máy chủ điều phối.");
      }
    });
  };

  // Xử lý Phương án A: Đồng ý & Xuất file Excel tùy chỉnh
  const handleExportExcel = async () => {
    if (!result || !result.updatedAssignments) return;
    setIsExporting(true);
    try {
      const res = await fetch("/api/export/room-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: result.weekStart,
          assignments: result.updatedAssignments,
          order: orderedPositionIds,
        }),
      });

      if (!res.ok) throw new Error("Lỗi khi tạo file Excel ma trận.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ma-tran-phan-phong-${result.weekStart}-dieuchinh.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Không thể tải file Excel: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Áp dụng dữ liệu mới lên bảng web
  const handleApplyAndClose = () => {
    if (result && onApplyToBoard) {
      onApplyToBoard(result.updatedAssignments);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-white/70 bg-white/95 shadow-2xl overflow-hidden text-slate-800">
        
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-gradient-to-r from-teal-600 to-teal-700 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-xs">
              <Sparkles className="h-5 w-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Điều Chỉnh Lịch & Xuất Excel Ma Trận
              </h2>
              <p className="text-xs text-teal-100 font-medium">
                Dành riêng cho BS Tiến & Đ/d Nghĩa • Tối ưu hóa phân phòng trước khi xuất bảng tính
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* NỘI DUNG CUỘN */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          
          {/* 1. CHỌN PHẠM VI TUẦN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              1. Chọn phạm vi tuần làm việc
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setScope("current");
                  setResult(null);
                }}
                className={`flex flex-col p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  scope === "current"
                    ? "border-teal-500 bg-teal-50/70 ring-2 ring-teal-200"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900">Tuần hiện tại đang chạy</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                    Bảo lưu ca đã qua
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-1">
                  Chỉ cho phép điều chỉnh các ca và ngày chưa xảy ra (so với thời điểm hiện tại).
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScope("next");
                  setResult(null);
                }}
                className={`flex flex-col p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  scope === "next"
                    ? "border-teal-500 bg-teal-50/70 ring-2 ring-teal-200"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900">Tuần tiếp theo</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800">
                    Toàn bộ tuần tới
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-1">
                  Rà soát và lên lịch dự kiến cho tất cả các ca từ Thứ Hai đến Thứ Bảy tuần sau.
                </p>
              </button>
            </div>
          </div>

          {/* 2. Ô NHẬP NỘI DUNG GÓP Ý / ĐIỀU CHỈNH */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Nội dung cần điều chỉnh hoặc phân bổ lại
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Hỗ trợ ngôn ngữ tự nhiên tiếng Việt</span>
            </div>

            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Ví dụ: Chuyển Thủy sang phụ trách Mắt chiều thứ 4; Bổ sung thêm 1 người đo sinh hiệu sáng thứ 5; Giảm bớt người sảnh tiếp nhận..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-hidden focus:ring-3 focus:ring-teal-100 transition-all font-sans leading-relaxed resize-none"
            />

            {/* TAG GỢI Ý NHANH */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-500 font-medium">Gợi ý nhanh:</span>
              <button
                type="button"
                onClick={() => setFeedback((prev) => prev ? `${prev}, Tiếp nhận chỉ để 2 người` : "Tiếp nhận chỉ để 2 người")}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
              >
                + Tiếp nhận đúng 2 người
              </button>
              <button
                type="button"
                onClick={() => setFeedback((prev) => prev ? `${prev}, Thủy hỗ trợ tiếp nhận` : "Thủy hỗ trợ tiếp nhận")}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
              >
                + Thủy hỗ trợ tiếp nhận
              </button>
              <button
                type="button"
                onClick={() => setFeedback((prev) => prev ? `${prev}, Thịnh chỉ làm hồ sơ KSK` : "Thịnh chỉ làm hồ sơ KSK")}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
              >
                + Thịnh làm hồ sơ KSK
              </button>
            </div>
          </div>

          {/* NÚT BẤM GỬI PHẢN HỒI / CHẠY LẠI LỊCH */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleAnalyzeAndReSchedule}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-5 py-2.5 shadow-md active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-teal-200" />
                  <span>Đang phân tích & tối ưu lịch...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Phản hồi & Chạy lại lịch</span>
                </>
              )}
            </button>
          </div>

          {/* HIỂN THỊ LỖI NẾU CÓ */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3.5 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-medium">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 3. KHU VỰC KẾT QUẢ ĐIỀU CHỈNH & KHUYẾN NGHỊ */}
          {result && (
            <div className="border border-teal-100 rounded-3xl bg-teal-50/40 p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
              
              {/* Tóm tắt & Đánh giá */}
              <div className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                    Kết Quả Tối Ưu Hóa Phân Phòng
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {result.summary}
                  </p>
                </div>
              </div>

              {/* Khuyến nghị & Cảnh báo */}
              {result.recommendations.length > 0 && (
                <div className="bg-amber-50/80 border border-amber-200/80 p-3.5 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <HelpCircle className="h-3.5 w-3.5 text-amber-700" />
                    <span>Khuyến nghị & Kiểm soát chính sách:</span>
                  </div>
                  <ul className="list-disc pl-5 text-[11.5px] text-amber-800 space-y-0.5">
                    {result.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* BẢNG SO SÁNH THAY ĐỔI (DIFF) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Các Điểm Thay Đổi Tối Ưu Nhất ({result.diffChanges.length} lượt)
                  </h4>
                </div>

                {result.diffChanges.length === 0 ? (
                  <p className="text-xs text-slate-500 italic bg-white p-3 rounded-xl border border-slate-100 text-center">
                    Không có thay đổi nhân sự mới nào (lịch hiện thời đã phù hợp với yêu cầu).
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                          <th className="py-2.5 px-3">Thời điểm</th>
                          <th className="py-2.5 px-3">Vị trí / Phòng</th>
                          <th className="py-2.5 px-3">Người cũ</th>
                          <th className="py-2.5 px-3">Người mới</th>
                          <th className="py-2.5 px-3">Lý do điều chỉnh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.diffChanges.map((ch) => (
                          <tr key={ch.id} className="hover:bg-slate-50/60">
                            <td className="py-2 px-3 font-medium whitespace-nowrap text-slate-700">
                              {ch.dayLabel} ({ch.shiftLabel})
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">{ch.positionName}</td>
                            <td className="py-2 px-3 text-slate-500 line-through">{ch.oldStaffName}</td>
                            <td className="py-2 px-3 font-extrabold text-teal-700 bg-teal-50/50">
                              {ch.newStaffName}
                            </td>
                            <td className="py-2 px-3 text-slate-600 text-[11px]">{ch.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS (QUYẾT ĐỊNH) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <div className="text-[11.5px] text-slate-500 font-medium">
            {result
              ? "Bạn có thể tiếp tục góp ý hoặc đồng ý để xuất file Excel ngoại tuyến (Phương án A)."
              : "Chọn phạm vi tuần và nhập ý kiến điều chỉnh để hệ thống tự động tối ưu."}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {result && (
              <>
                {/* NÚT CHƯA ĐỒNG Ý: TIẾP TỤC GÓP Ý */}
                <button
                  type="button"
                  onClick={() => {
                    setFeedback("");
                    setResult(null);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs px-3.5 py-2 transition-all cursor-pointer shadow-2xs"
                >
                  <RefreshCw className="h-3.5 w-3.5 inline-block mr-1" />
                  Tiếp tục góp ý
                </button>

                {/* NÚT PHỤ: ÁP DỤNG LÊN BẢNG WEB */}
                {onApplyToBoard && (
                  <button
                    type="button"
                    onClick={handleApplyAndClose}
                    className="rounded-2xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs px-3.5 py-2 transition-all cursor-pointer shadow-2xs"
                    title="Cập nhật tạm lên bảng phân phòng trên màn hình để kiểm tra trực quan"
                  >
                    Xem trên bảng
                  </button>
                )}

                {/* NÚT ĐỒNG Ý & XUẤT EXCEL (PHƯƠNG ÁN A) */}
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 py-2 shadow-md active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-200" />
                      <span>Đang xuất Excel...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Đồng ý & Xuất file Excel</span>
                    </>
                  )}
                </button>
              </>
            )}

            {!result && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs px-4 py-2 transition-all cursor-pointer"
              >
                Đóng
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
