import Link from "next/link";
import { LogOut, CalendarCheck, ShieldAlert, HeartPulse, CalendarDays, BarChart3, Compass } from "lucide-react";
import { signOut } from "@/auth";
import { getAppData, calculateYearlyApprovedLeaveStats } from "@/lib/repository";
import { getUserContext } from "@/lib/session";
import { getWeekStartFromInput } from "@/lib/date";
import { FlexibleLeaveForm } from "@/components/leave-portal/flexible-leave-form";
import { PortalLeaveCalendar } from "@/components/leave-portal/portal-leave-calendar";
import { MyLeaveStatsView } from "@/components/leave-portal/my-leave-stats-view";
import { MyPersonalScheduleView } from "@/components/leave-portal/my-personal-schedule-view";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    week?: string;
    message?: string;
    error?: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function LeavePortalPage({ searchParams }: PageProps) {
  const { tab = "my-schedule", week, message, error } = await searchParams;
  const activeTab = tab || "my-schedule";
  const weekStart = getWeekStartFromInput(week);
  const { authEnabled, user } = await getUserContext({ required: false });

  // 1. KIỂM TRA ĐĂNG NHẬP
  if (authEnabled && !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-slate-200/80 text-center space-y-5 sm:space-y-6">
          <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
            <HeartPulse className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Cổng Nhân Sự Cá Nhân</h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Vui lòng đăng nhập bằng tài khoản Google cơ quan của bạn để theo dõi lịch phân vị trí và đăng ký nghỉ phép.
            </p>
          </div>
          <Link
            href="/sign-in?callbackUrl=/dang-ky-phep"
            className="w-full inline-flex items-center justify-center rounded-xl sm:rounded-2xl bg-teal-600 px-5 sm:px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition"
          >
            Đăng nhập với Google
          </Link>
        </div>
      </div>
    );
  }

  // 2. KIỂM TRA EMAIL TRONG DANH SÁCH NHÂN SỰ CHÍNH THỨC
  const data = await getAppData();
  let currentStaff = data.staff.find(
    (s) => s.email.toLowerCase() === (user?.email || "").toLowerCase() && s.active !== false,
  );

  // [QWEN3] Cho phép tài khoản admin@nurseflow.local (demo/preview) được quyền truy cập và chạy
  if (!currentStaff && user?.email?.toLowerCase() === "admin@nurseflow.local") {
    currentStaff = {
      id: "staff-admin-demo",
      name: user.name || "Quản trị viên (Demo)",
      code: "ADMIN",
      email: "admin@nurseflow.local",
      role: "admin",
      positionIds: [],
      active: true,
      prefersOvertime: false,
    };
  }

  if (!currentStaff) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-rose-100 text-center space-y-5 sm:space-y-6">
          <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <ShieldAlert className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Từ chối truy cập</h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Tài khoản <strong>{user?.email}</strong> không thuộc danh sách nhân sự chính thức của đơn vị.
            </p>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Yêu cầu đăng nhập đúng email đã được cấp quyền trong hệ thống điều dưỡng.
            </p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/sign-in" });
            }}
          >
            <button
              type="submit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất & Đổi tài khoản khác
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. NHÂN SỰ HỢP LỆ -> RENDER GIAO DIỆN CỔNG ĐỘC LẬP
  const yearlyStats = calculateYearlyApprovedLeaveStats(currentStaff.id, data.leaveRequests);
  const activeStaffList = data.staff.filter((s) => s.active !== false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 sm:pb-16 selection:bg-teal-100 selection:text-teal-900">
      {/* HEADER ĐỘC LẬP CHO CỔNG NGHỈ PHÉP (RESPONSIVE) */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-3">
            {/* Logo & Thương hiệu */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white font-bold shadow-md shadow-teal-600/20">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                  NurseFlow Portal
                </h1>
                <p className="text-[10px] sm:text-[11px] font-medium text-teal-600 uppercase tracking-wider truncate">
                  Cổng Nhân Sự Cá Nhân
                </p>
              </div>
            </div>

            {/* Thông tin nhân sự & Nút đăng xuất */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="text-right">
                <span className="block text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[120px] sm:max-w-none">
                  {currentStaff.name}
                </span>
                <span className="block text-[10px] sm:text-[11px] text-slate-400 font-medium">
                  {currentStaff.code}
                </span>
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/dang-ky-phep" });
                }}
              >
                <button
                  type="submit"
                  title="Đăng xuất"
                  className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition shadow-sm"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* NỘI DUNG CHÍNH (RESPONSIVE CONTAINER) */}
      <main className="mx-auto max-w-5xl px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
        {/* BANNER THÔNG BÁO / LỖI */}
        {message && (
          <div className="rounded-xl sm:rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3 sm:p-4 text-xs sm:text-sm font-semibold text-emerald-900 shadow-sm flex items-center gap-2.5 sm:gap-3">
            <span className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 text-xs">
              ✓
            </span>
            <span className="flex-1">{message}</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl sm:rounded-2xl border border-rose-200 bg-rose-50/90 p-3 sm:p-4 text-xs sm:text-sm font-semibold text-rose-900 shadow-sm flex items-center gap-2.5 sm:gap-3">
            <span className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-rose-200 text-rose-800 text-xs font-bold">
              !
            </span>
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* ĐIỀU HƯỚNG 4 TABS (RESPONSIVE GRID) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-200 gap-1 sm:gap-2">
          {/* Tab 1: Lịch trực của tôi (MỚI - MẶC ĐỊNH) */}
          <Link
            href="/dang-ky-phep?tab=my-schedule"
            className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-b-2 transition text-center ${
              activeTab === "my-schedule"
                ? "border-teal-600 text-teal-700 bg-teal-50/40 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Compass className="h-4 w-4 shrink-0" />
            <span className="truncate">Lịch của tôi</span>
          </Link>

          {/* Tab 2: Đăng ký nghỉ phép */}
          <Link
            href="/dang-ky-phep?tab=register"
            className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-b-2 transition text-center ${
              activeTab === "register"
                ? "border-teal-600 text-teal-700 bg-teal-50/40 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <CalendarCheck className="h-4 w-4 shrink-0" />
            <span className="truncate">Đăng ký phép</span>
          </Link>

          {/* Tab 3: Thống kê phép của tôi */}
          <Link
            href="/dang-ky-phep?tab=stats"
            className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-b-2 transition text-center ${
              activeTab === "stats"
                ? "border-teal-600 text-teal-700 bg-teal-50/40 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span className="truncate">Thống kê phép</span>
          </Link>

          {/* Tab 4: Lịch các thành viên */}
          <Link
            href="/dang-ky-phep?tab=calendar"
            className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-b-2 transition text-center ${
              activeTab === "calendar"
                ? "border-teal-600 text-teal-700 bg-teal-50/40 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="truncate">Lịch thành viên</span>
          </Link>
        </div>

        {/* NỘI DUNG TƯƠNG ỨNG TỪNG TAB */}
        {activeTab === "calendar" ? (
          <PortalLeaveCalendar
            currentStaff={currentStaff}
            allStaff={data.staff.some((s) => s.id === currentStaff.id) ? data.staff : [currentStaff, ...data.staff]}
            allLeaves={data.leaveRequests}
          />
        ) : activeTab === "stats" ? (
          <MyLeaveStatsView
            currentStaff={currentStaff}
            allLeaves={data.leaveRequests}
            yearlyStats={yearlyStats}
          />
        ) : activeTab === "register" ? (
          <FlexibleLeaveForm
            currentStaff={currentStaff}
            allStaff={activeStaffList}
            existingLeaves={data.leaveRequests}
            yearlyStats={yearlyStats}
            isAdmin={user?.role === "admin" || user?.role === "coordinator" || user?.email?.toLowerCase() === "admin@nurseflow.local"}
          />
        ) : (
          <MyPersonalScheduleView
            currentStaff={currentStaff}
            weeklySchedule={data.weeklySchedule}
            positions={data.positions}
            leaveRequests={data.leaveRequests}
            weekStart={weekStart}
            holidays={data.holidays}
          />
        )}
      </main>
    </div>
  );
}
