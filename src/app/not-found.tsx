import Link from "next/link";
import { Calendar, FileQuestion, Home, UserCheck } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/80 px-4 py-12">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-10">
        {/* Glow decoration */}
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-indigo-400/10 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-8 ring-teal-50/50">
            <FileQuestion className="h-8 w-8" />
          </div>

          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-teal-100/80 px-3 py-1 text-xs font-semibold text-teal-800">
            Mã lỗi 404 · Không tìm thấy trang
          </span>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Đường dẫn không tồn tại
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Trang bạn đang tìm kiếm có thể đã được đổi tên, chuyển vị trí hoặc không còn khả dụng trên hệ thống NurseFlow.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/schedule"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:bg-teal-700 hover:shadow-teal-600/35 active:scale-[0.98]"
            >
              <Calendar className="h-4 w-4" />
              Bảng lịch phân ca
            </Link>

            <Link
              href="/dang-ky-phep"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
            >
              <UserCheck className="h-4 w-4" />
              Cổng đăng ký phép
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-[0.98]"
            >
              <Home className="h-4 w-4" />
              Trang chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
