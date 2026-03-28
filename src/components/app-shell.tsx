import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  LayoutTemplate,
  LogOut,
  Users,
} from "lucide-react";
import { signOut } from "@/auth";
import { Pill } from "@/components/pill";
import { APP_NAME, APP_TAGLINE, ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/types";

interface AppShellProps {
  currentPath: string;
  title: string;
  description: string;
  authEnabled: boolean;
  user: SessionUser;
  children: React.ReactNode;
  message?: string;
  error?: string;
}

const navItems = [
  { href: "/", label: "Tổng quan", shortLabel: "Tổng quan", icon: ClipboardList },
  { href: "/schedule", label: "Lịch tuần", shortLabel: "Tuần", icon: CalendarDays },
  { href: "/template", label: "Lịch nền", shortLabel: "Nền", icon: LayoutTemplate },
  { href: "/staff", label: "Nhân sự", shortLabel: "Nhân sự", icon: Users },
  { href: "/reports", label: "Báo cáo", shortLabel: "Báo cáo", icon: FileSpreadsheet },
];

export function AppShell({
  currentPath,
  title,
  description,
  authEnabled,
  user,
  children,
  message,
  error,
}: AppShellProps) {
  const userInitials = user.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_32%),radial-gradient(circle_at_85%_15%,_rgba(249,115,22,0.14),_transparent_24%),linear-gradient(180deg,_#f8fbfb_0%,_#edf3f3_44%,_#e8edf5_100%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden w-[300px] shrink-0 flex-col justify-between border-r border-slate-900/70 bg-[linear-gradient(180deg,#020617_0%,#0f172a_52%,#111827_100%)] px-6 py-7 text-white lg:flex">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#14b8a6_0%,#f97316_100%)] text-lg font-bold text-white shadow-lg shadow-teal-950/30">
                NF
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-teal-300">Lịch điều dưỡng</p>
                <h1 className="text-3xl font-semibold tracking-tight text-white">{APP_NAME}</h1>
                <p className="text-sm leading-6 text-slate-300">{APP_TAGLINE}</p>
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = currentPath === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition duration-200",
                      active
                        ? "bg-white text-slate-950 shadow-[0_12px_35px_rgba(255,255,255,0.14)]"
                        : "text-slate-300 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-slate-950">
                {userInitials}
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-white">{user.name}</p>
                <p className="text-slate-400">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone={authEnabled ? "teal" : "amber"}>
                {authEnabled ? "Đăng nhập Google" : "Chế độ demo"}
              </Pill>
              <Pill tone="slate">{ROLE_LABELS[user.role]}</Pill>
            </div>
            {authEnabled ? (
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/sign-in" });
                }}
              >
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/14 bg-white/6 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/12"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              </form>
            ) : (
              <p className="text-sm leading-6 text-slate-400">
                Bạn đang xem bản demo. Khi nối Google OAuth và Google Sheets, toàn bộ thao tác sẽ lưu trực tiếp lên dữ liệu thật.
              </p>
            )}
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col pb-24 lg:pb-0">
          <header className="sticky top-0 z-20 border-b border-white/70 bg-white/76 px-4 py-4 backdrop-blur md:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 lg:hidden">
                  {navItems.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition",
                        currentPath === href
                          ? "bg-slate-950 text-white"
                          : "bg-white text-slate-600 shadow-sm",
                      )}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">Bảng điều phối</p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2.2rem]">{title}</h2>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill tone={authEnabled ? "teal" : "amber"}>
                  {authEnabled ? "Dữ liệu từ Google Sheets" : "Đang dùng dữ liệu mẫu"}
                </Pill>
                <Pill tone="slate">Sẵn sàng mở rộng</Pill>
              </div>
            </div>
            {message ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </header>

          <main className="flex-1 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
            <div className="space-y-6">{children}</div>
          </main>

          <nav className="fixed inset-x-3 bottom-3 z-30 rounded-[28px] border border-slate-900/10 bg-slate-950/96 px-2 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.24)] backdrop-blur lg:hidden">
            <div className="grid grid-cols-5 gap-1">
              {navItems.map(({ href, shortLabel, icon: Icon }) => {
                const active = currentPath === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition",
                      active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{shortLabel}</span>
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
