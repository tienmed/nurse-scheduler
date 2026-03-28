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
  { href: "/", label: "Tổng quan", icon: ClipboardList },
  { href: "/schedule", label: "Lịch tuần", icon: CalendarDays },
  { href: "/template", label: "Lịch nền", icon: LayoutTemplate },
  { href: "/staff", label: "Nhân sự", icon: Users },
  { href: "/reports", label: "Báo cáo", icon: FileSpreadsheet },
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
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.14),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.1),_transparent_28%),linear-gradient(180deg,_#f8fbfb_0%,_#f4f7f7_45%,_#edf2f7_100%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-[1560px]">
        <aside className="hidden w-[288px] shrink-0 flex-col justify-between border-r border-white/70 bg-white/60 px-6 py-7 backdrop-blur lg:flex">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-[22px] bg-teal-700 text-lg font-bold text-white shadow-lg shadow-teal-900/20">
                NF
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-teal-700">Lịch điều dưỡng</p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{APP_NAME}</h1>
                <p className="text-sm leading-6 text-slate-600">{APP_TAGLINE}</p>
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
                        ? "bg-slate-950 text-white shadow-lg shadow-slate-950/15"
                        : "text-slate-600 hover:bg-white hover:text-slate-950",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="space-y-4 rounded-[24px] border border-white/80 bg-white/88 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                {userInitials}
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-slate-950">{user.name}</p>
                <p className="text-slate-500">{user.email}</p>
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              </form>
            ) : (
              <p className="text-sm leading-6 text-slate-500">
                Bạn đang xem bản demo. Khi nối Google OAuth và Google Sheets, toàn bộ thao tác sẽ lưu trực tiếp lên dữ liệu thật.
              </p>
            )}
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/70 bg-white/70 px-4 py-4 backdrop-blur md:px-6 lg:px-8">
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
                  <p className="text-xs font-semibold text-teal-700">Bảng điều phối</p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill tone={authEnabled ? "teal" : "amber"}>
                  {authEnabled ? "Dữ liệu từ Google Sheets" : "Đang dùng dữ liệu mẫu"}
                </Pill>
                <Pill tone="slate">Mở rộng tính năng dễ dàng</Pill>
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
        </div>
      </div>
    </div>
  );
}
