import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { signIn } from "@/auth";
import { Pill } from "@/components/pill";
import { APP_NAME } from "@/lib/constants";
import { isAuthConfigured, isSheetsConfigured } from "@/lib/env";

export default async function SignInPage() {
  const oauthReady = isAuthConfigured();
  const sheetsReady = isSheetsConfigured();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.14),_transparent_30%),linear-gradient(180deg,_#f8fbfb_0%,_#eef2f7_100%)] px-4 py-8">
      <div className="w-full max-w-[1120px] rounded-[36px] border border-white/80 bg-white/88 p-6 shadow-[0_24px_100px_rgba(15,23,42,0.12)] backdrop-blur md:p-8">
        <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <section className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-teal-700">Không gian điều phối lịch</p>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                {APP_NAME} giúp lập lịch tuần rõ ràng, sửa nhanh khi có phát sinh và lưu dữ liệu tập trung.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600">
                Ứng dụng dành cho điều phối điều dưỡng: lấy lịch nền để tạo tuần mới, nhập nghỉ phép, chỉnh lịch đột xuất, xuất Excel và theo dõi báo cáo tháng.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill tone={oauthReady ? "teal" : "amber"}>
                {oauthReady ? "Google OAuth sẵn sàng" : "Chưa cấu hình OAuth"}
              </Pill>
              <Pill tone={sheetsReady ? "teal" : "slate"}>
                {sheetsReady ? "Google Sheets đang hoạt động" : "Đang xem bằng dữ liệu mẫu"}
              </Pill>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[28px] border border-teal-200 bg-teal-50 p-5">
                <p className="text-sm font-semibold text-teal-700">Quy trình vận hành</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-teal-800">
                  <li>1. Lấy tuần mới từ lịch nền.</li>
                  <li>2. Cập nhật nghỉ phép và chỉnh ca phát sinh.</li>
                  <li>3. Chốt lịch và xuất Excel khi hoàn tất.</li>
                </ul>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-700">Dữ liệu quản trị</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>• Nhân sự và vị trí trực.</li>
                  <li>• Lịch nền và lịch tuần chính thức.</li>
                  <li>• Báo cáo tháng theo nhân sự và vị trí.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200/80 bg-slate-50/88 p-6">
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-slate-500">Đăng nhập</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Vào bảng điều phối
                </h2>
              </div>
              {oauthReady ? (
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: "/" });
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
              <div className="space-y-3 text-sm leading-6 text-slate-600">
                <p>Checklist trước khi chạy production:</p>
                <ul className="space-y-2">
                  <li>1. Tạo OAuth Client và điền `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.</li>
                  <li>2. Tạo service account cho Google Sheets và khai báo `GOOGLE_SHEET_ID`, email, private key.</li>
                  <li>3. Cấp quyền email truy cập bằng tab `access_control` hoặc allowlist môi trường.</li>
                </ul>
              </div>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
              >
                Vào bản demo
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
