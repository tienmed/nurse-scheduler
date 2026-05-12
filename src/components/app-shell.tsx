import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  LayoutTemplate,
  LogOut,
  MapPin,
  Users,
} from "lucide-react";
import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { Pill } from "@/components/pill";
import { DataHorizonPicker } from "@/components/data-horizon-picker";
import { APP_NAME, APP_TAGLINE, ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { canEdit } from "@/lib/session";
import { getAppVersion } from "@/lib/version";
import type { SessionUser } from "@/lib/types";

interface AppShellProps {
  currentPath: string;
  title: string;
  description: string;
  authEnabled: boolean;
  user: SessionUser | null;
  children: React.ReactNode;
  message?: string;
  error?: string;
}

const navItems = [
  { href: "/", label: "Tổng quan", shortLabel: "Tổng quan", icon: ClipboardList },
  { href: "/schedule", label: "Lịch tuần", shortLabel: "Tuần", icon: CalendarDays },
  { href: "/template", label: "Lịch nền", shortLabel: "Nền", icon: LayoutTemplate },
  { href: "/areas", label: "Khu vực", shortLabel: "Khu vực", icon: MapPin },
  { href: "/staff", label: "Nhân sự", shortLabel: "Nhân sự", icon: Users },
  { href: "/leave", label: "Nghỉ Phép", shortLabel: "Nghỉ", icon: CalendarOff },
  { href: "/reports", label: "Báo cáo", shortLabel: "Báo cáo", icon: FileSpreadsheet },
];

export async function AppShell({
  currentPath,
  title,
  description,
  authEnabled,
  user,
  children,
  message,
  error,
}: AppShellProps) {
  const cookieStore = await cookies();
  const initialHorizon = cookieStore.get("nh-data-horizon")?.value;

  const editable = user ? canEdit(user.role) : false;
  const filteredNavItems = navItems.filter((item) => {
    if (["/staff", "/areas", "/template"].includes(item.href)) {
      return editable;
    }
    return true;
  });

  const userInitials = user
    ? user.name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
    : "??";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-teal-100 selection:text-teal-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_40%),radial-gradient(circle_at_80%_20%,_rgba(99,102,241,0.08),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-[1700px]">
        <aside className="sticky top-0 h-screen hidden w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white/80 backdrop-blur-xl lg:flex">
          <div className="flex-1 space-y-8 overflow-y-auto scrollbar-none px-6 pt-7 pb-4">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-lg font-bold text-white shadow-lg shadow-teal-600/20">
                  NF
                </div>
                <div className="space-y-0.5">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">{APP_NAME}</h1>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">{APP_TAGLINE}</p>
                </div>
              </div>
            </div>

            <nav className="space-y-1.5">
              {filteredNavItems.map(({ href, label, icon: Icon }) => {
                const active = currentPath === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-200/50"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 transition-colors", active ? "text-teal-600" : "text-slate-400 group-hover:text-slate-600")} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="shrink-0 px-6 pb-8">
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 text-sm font-semibold text-teal-600">
                  {userInitials}
                </div>
                <div className="space-y-0.5 text-sm">
                  <p className="font-semibold text-slate-900">
                    {user?.name ?? "Khách"}
                  </p>
                  <p className="text-xs text-slate-500 truncate w-32">
                    {user?.email ?? "Chưa đăng nhập"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Pill tone={!authEnabled ? "amber" : user ? "teal" : "rose"} className="text-[10px] py-0 px-2">
                  {!authEnabled ? "Demo" : user ? "Google" : "Hết hạn"}
                </Pill>
                <Pill tone="slate" className="text-[10px] py-0 px-2">{ROLE_LABELS[user?.role ?? "viewer"]}</Pill>
              </div>
              {authEnabled && user ? (
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/sign-in" });
                  }}
                >
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-rose-600"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Đăng xuất
                  </button>
                </form>
              ) : authEnabled ? (
                <Link
                  href="/sign-in"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Đăng nhập
                </Link>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col pb-24 lg:pb-0">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur-xl md:px-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">Bảng điều phối thông minh</p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{title}</h2>
                <p className="max-w-2xl text-xs font-medium text-slate-500 line-clamp-1 md:line-clamp-none">{description}</p>
              </div>
              <div className="hidden md:flex items-center gap-3">
                <div className="flex flex-wrap gap-2 mr-2">
                  <Pill tone={!authEnabled ? "amber" : user ? "teal" : "rose"} className="shadow-sm">
                    {!authEnabled ? "Dữ liệu mẫu" : user ? "Trực tuyến" : "Ngoại tuyến"}
                  </Pill>
                  <Pill tone="slate" className="shadow-sm border-slate-200">{getAppVersion()}</Pill>
                </div>
                <DataHorizonPicker initialHorizon={initialHorizon} />
              </div>
            </div>
            {message ? (
              <div className="mt-4 flex animate-in slide-in-from-top-2 items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-teal-600" />
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 flex animate-in slide-in-from-top-2 items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 shadow-sm">
                <AlertCircle className="h-5 w-5 text-rose-600" />
                {error}
              </div>
            ) : null}
          </header>

          <main className="flex-1 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
            <div className="space-y-6">{children}</div>
          </main>

          <nav className="fixed inset-x-4 bottom-4 z-30 rounded-[32px] border border-slate-200 bg-white/90 px-3 py-2 shadow-[0_20px_50px_rgba(15,23,42,0.15)] backdrop-blur-xl lg:hidden">
            <div className={cn(
              "grid gap-1",
              filteredNavItems.length >= 6 ? "grid-cols-7" : "grid-cols-4"
            )}>
              {filteredNavItems.map(({ href, shortLabel, icon: Icon }) => {
                const active = currentPath === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-[10px] font-semibold transition-all duration-300",
                      active ? "bg-teal-600 text-white shadow-lg shadow-teal-600/30 scale-105" : "text-slate-500 hover:text-slate-900",
                    )}
                  >
                    <Icon className={cn("h-4.5 w-4.5", active ? "text-white" : "text-slate-400")} />
                    <span className="leading-none">{shortLabel}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
