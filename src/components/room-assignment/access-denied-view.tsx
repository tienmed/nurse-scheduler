import Link from "next/link";
import { ArrowLeft, LogOut, ShieldAlert } from "lucide-react";
import { signOut } from "@/auth";
import type { SessionUser } from "@/lib/types";

interface AccessDeniedViewProps {
  user: SessionUser;
}

// [QWEN3] Màn hình từ chối quyền truy cập khi tài khoản không phải là Admin hoặc Coordinator
export function AccessDeniedView({ user }: AccessDeniedViewProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-lg animate-in zoom-in-95 duration-200">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-100 text-rose-600 shadow-inner">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <h2 className="mt-5 text-xl font-extrabold text-slate-900 sm:text-2xl">
          Quyền Truy Cập Bị Từ Chối
        </h2>

        <p className="mt-2 text-xs text-slate-600 leading-relaxed sm:text-sm">
          Cổng Phân Phòng Theo Ca chỉ dành cho tài khoản có vai trò{" "}
          <strong className="text-rose-700">Quản trị viên (Admin)</strong> hoặc{" "}
          <strong className="text-teal-700">Điều phối viên (Coordinator)</strong> được phân quyền trong bảng{" "}
          <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-mono font-bold text-slate-800">
            access_control
          </code>.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-left space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Tài khoản đang đăng nhập:</span>
            <span className="font-bold text-slate-900">{user.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Email:</span>
            <span className="font-mono text-slate-800 font-semibold">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Vai trò hiện tại:</span>
            <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700 uppercase">
              {user.role}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" />
            Về Lịch chung
          </Link>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/sign-in" });
            }}
          >
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 active:scale-95 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất / Đổi tài khoản
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
