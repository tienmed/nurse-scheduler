import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { signIn } from "@/auth";
import { Pill } from "@/components/pill";
import { APP_NAME } from "@/lib/constants";
import { isAuthConfigured, isSheetsConfigured } from "@/lib/env";

interface SignInPageProps {
  searchParams: Promise<{
    returnTo?: string;
    error?: string;
  }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { returnTo, error } = await searchParams;
  const redirectTo = returnTo || "/";
  const oauthReady = isAuthConfigured();
  const sheetsReady = isSheetsConfigured();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.24),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.18),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#0f172a_46%,_#172554_100%)] px-4 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.04)_38%,transparent_72%)]" />
      <div className="relative w-full max-w-[1180px] overflow-hidden rounded-[40px] border border-white/10 bg-white/8 shadow-[0_30px_120px_rgba(2,6,23,0.5)] backdrop-blur">
        <div className="grid gap-0 lg:grid-cols-[1.12fr_0.88fr]">
          <section className="space-y-8 p-6 md:p-8 lg:p-10">
            <div className="space-y-4">
              <Pill tone={oauthReady ? "teal" : "amber"}>
                {oauthReady ? "Google OAuth sẵn sàng" : "Chưa cấu hình OAuth"}
              </Pill>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
                {APP_NAME} cho điều phối điều dưỡng cần một màn hình làm việc nhanh và dứt khoát.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-white/72">
                Tạo tuần mới từ lịch nền, cập nhật nghỉ phép, xử lý phát sinh và xuất báo cáo mà không bị rối bởi quá nhiều bước hay quá nhiều màn hình.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[30px] border border-white/10 bg-white/8 p-5">
                <p className="text-sm font-semibold text-teal-300">Luồng vận hành</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-white/72">
                  <li>1. Tạo tuần mới từ lịch nền.</li>
                  <li>2. Nhập nghỉ phép và chỉnh ca phát sinh.</li>
                  <li>3. Chốt lịch, xuất Excel và xem báo cáo tháng.</li>
                </ul>
              </div>
              <div className="rounded-[30px] border border-white/10 bg-white/8 p-5">
                <p className="text-sm font-semibold text-amber-300">Trạng thái tích hợp</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone={oauthReady ? "teal" : "amber"}>
                    {oauthReady ? "OAuth đã nối" : "OAuth chưa nối"}
                  </Pill>
                  <Pill tone={sheetsReady ? "teal" : "slate"}>
                    {sheetsReady ? "Sheets đang live" : "Đang xem demo"}
                  </Pill>
                </div>
                <p className="mt-4 text-sm leading-6 text-white/72">
                  Khi hai phần này sẵn sàng, ứng dụng có thể chạy production trên Vercel với dữ liệu thật.
                </p>
              </div>
            </div>
          </section>

          <section className="border-t border-white/10 bg-white/94 p-6 text-slate-900 md:p-8 lg:border-l lg:border-t-0 lg:p-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-500">Đăng nhập</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Vào bảng điều phối</h2>
                <p className="text-sm leading-6 text-slate-600">
                  Dành cho điều phối viên, trưởng ca và người xem lịch theo đúng phân quyền đã cấu hình.
                </p>
              </div>

              {error === "AccessDenied" ? (
                <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 animate-in fade-in slide-in-from-top-2">
                  <strong className="block mb-1 text-sm text-rose-900">Đăng nhập từ chối</strong>
                  <p className="text-sm leading-6 text-rose-800">Tài khoản Google của bạn chưa được cấp quyền truy cập vào hệ thống. Vui lòng liên hệ quản trị viên để được thêm tên vào danh sách nhân sự.</p>
                </div>
              ) : error ? (
                <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 animate-in fade-in slide-in-from-top-2">
                  <strong className="block mb-1 text-sm text-rose-900">Lỗi đăng nhập</strong>
                  <p className="text-sm leading-6 text-rose-800">{error}</p>
                </div>
              ) : null}

              {oauthReady ? (
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo });
                  }}
                >
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-4 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Đăng nhập với Google
                  </button>
                </form>
              ) : (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                  Chưa có cấu hình Google OAuth. Bạn vẫn có thể mở bản demo để kiểm tra giao diện và luồng nghiệp vụ.
                </div>
              )}

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-700">Checklist trước khi chạy production</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>1. Tạo OAuth Client và điền `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.</li>
                  <li>2. Tạo service account cho Google Sheets và khai báo `GOOGLE_SHEET_ID`, email, private key.</li>
                  <li>3. Thêm email được phép truy cập trong tab `access_control` hoặc allowlist môi trường.</li>
                </ul>
              </div>

              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                Vào bản demo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
