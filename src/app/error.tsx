"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ghi nhận lỗi ra console phục vụ gỡ lỗi trong môi trường phát triển
    console.error("[NurseFlow Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/80 px-4 py-12">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-10">
        {/* Glow decoration */}
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-rose-400/10 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-8 ring-rose-50/50">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-rose-100/80 px-3 py-1 text-xs font-semibold text-rose-700">
            Đã xảy ra sự cố không mong muốn
          </span>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Hệ thống gián đoạn tạm thời
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Đã phát sinh sự cố trong quá trình xử lý dữ liệu. Điều này có thể do kết nối mạng tạm thời gián đoạn hoặc phản hồi từ Google Sheets chậm.
          </p>

          {error.digest && (
            <div className="mt-4 w-full rounded-xl bg-slate-100/80 px-3 py-2 text-xs font-mono text-slate-500">
              Mã theo dõi lỗi: <span className="font-semibold text-slate-700">{error.digest}</span>
            </div>
          )}

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:bg-teal-700 hover:shadow-teal-600/35 active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" />
              Thử tải lại trang
            </button>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
            >
              <Home className="h-4 w-4" />
              Về bảng điều khiển
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
