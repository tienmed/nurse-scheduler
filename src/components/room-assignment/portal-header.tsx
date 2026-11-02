import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Home,
  LogOut,
  Shield,
  UserCheck,
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { signOut } from "@/auth";
import type { SessionUser } from "@/lib/types";

interface PortalHeaderProps {
  user: SessionUser;
  weekStart: string;
  prevWeek: string;
  nextWeek: string;
  currentWeekStart: string;
  isCurrentWeek: boolean;
  hasOfficialSchedule: boolean;
}

// [QWEN3] Header độc lập dành riêng cho Cổng Phân Phòng Theo Ca (Portal Phân Phòng)
export function PortalHeader({
  user,
  weekStart,
  prevWeek,
  nextWeek,
  currentWeekStart,
  isCurrentWeek,
  hasOfficialSchedule,
}: PortalHeaderProps) {
  const startDate = parseISO(weekStart);
  const endDate = addDays(startDate, 6);

  const isAdmin = user.role === "admin";
  const userInitials = (user.name || user.email || "AD")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-2xs">
      <div className="mx-auto flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        {/* LOGO & TIÊU ĐỀ CỔNG */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm ring-2 ring-teal-100">
            <Grid3X3 className="h-6 w-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-slate-950 sm:text-lg">
                NurseFlow
              </h1>
              <span className="rounded-lg bg-teal-100 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-teal-850 uppercase">
                Portal Phân Phòng
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Hệ thống ma trận phân phòng theo ca dành cho Ban Điều phối & Quản trị
            </p>
          </div>
        </div>

        {/* BỘ CHỌN TUẦN TRUNG TÂM */}
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1 shadow-2xs">
          <Link
            href={`/room-assignment?week=${prevWeek}`}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-600 shadow-2xs hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Tuần trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-800">
            <Calendar className="h-3.5 w-3.5 text-teal-600" />
            <span>
              {format(startDate, "dd/MM")} – {format(endDate, "dd/MM/yyyy")}
            </span>
            <span
              className={`ml-1 rounded-md px-1.5 py-0.2 text-[10px] font-semibold ${
                hasOfficialSchedule
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {hasOfficialSchedule ? "Chính thức" : "Lịch nền"}
            </span>
          </div>

          {!isCurrentWeek && (
            <Link
              href={`/room-assignment?week=${currentWeekStart}`}
              className="rounded-xl bg-white px-2.5 py-1 text-[11px] font-bold text-teal-700 shadow-2xs hover:bg-teal-50 transition-colors"
            >
              Hiện tại
            </Link>
          )}

          <Link
            href={`/room-assignment?week=${nextWeek}`}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-600 shadow-2xs hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Tuần sau"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* THÔNG TIN TÀI KHOẢN & ĐĂNG XUẤT */}
        <div className="flex items-center gap-2.5">
          {/* Nút về ứng dụng chính */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
            title="Quay lại hệ thống lịch điều dưỡng chung"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Lịch chung</span>
          </Link>

          {/* User profile pill */}
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-100 text-[11px] font-extrabold text-teal-800">
              {userInitials}
            </div>

            <div className="hidden sm:block text-left text-xs">
              <p className="font-bold text-slate-900 truncate max-w-[140px]" title={user.name}>
                {user.name}
              </p>
              <div className="flex items-center gap-1">
                {isAdmin ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-purple-700">
                    <Shield className="h-2.5 w-2.5" /> Quản trị viên
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-teal-700">
                    <UserCheck className="h-2.5 w-2.5" /> Điều phối viên
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Nút đăng xuất */}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/sign-in" });
            }}
          >
            <button
              type="submit"
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all cursor-pointer shadow-2xs"
              title="Đăng xuất tài khoản"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
