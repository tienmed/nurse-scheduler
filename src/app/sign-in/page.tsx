import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { signIn } from "@/auth";
import { APP_NAME } from "@/lib/constants";
import { isAuthConfigured, isSheetsConfigured } from "@/lib/env";
import { getUserContext } from "@/lib/session";

export default async function SignInPage() {
  const { authEnabled, user } = await getUserContext({ required: false });

  if (authEnabled && user) {
    redirect("/");
  }

  const oauthReady = isAuthConfigured();
  const sheetsReady = isSheetsConfigured();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.16),_transparent_32%),linear-gradient(180deg,_#f7fbfb_0%,_#eef2ff_100%)] px-4 py-8">
      <div className="w-full max-w-[1120px] rounded-[36px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_100px_rgba(15,23,42,0.12)] backdrop-blur md:p-8">
        <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <section className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-teal-700">
                Nurse Scheduling Workspace
              </p>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                {APP_NAME} giÃƒÂºp ch?t l?ch di?u du?ng theo tu?n mÃƒÂ  v?n gi? du?c du?ng m? r?ng cho cÃƒÂ¡c ÃƒÂ½ tu?ng sau nÃƒÂ y.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600">
                App du?c d?ng theo hu?ng d? deploy t? GitHub, phÃƒÂ¢n quy?n b?ng Google OAuth vÃƒÂ  luu d? li?u trÃƒÂªn Google Sheets.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[28px] border border-teal-200 bg-teal-50 p-5">
                <p className="text-sm font-semibold text-teal-700">Google OAuth</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-teal-950">
                  {oauthReady ? "S?n sÃƒÂ ng" : "Chua n?i"}
                </p>
                <p className="mt-2 text-sm leading-6 text-teal-700">
                  {oauthReady
                    ? "CÃƒÂ³ th? dÃƒÂ¹ng dang nh?p Google ngay khi deploy."
                    : "C?n thÃƒÂªm AUTH_GOOGLE_ID vÃƒÂ  AUTH_GOOGLE_SECRET trong mÃƒÂ´i tru?ng."}
                </p>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-600">Google Sheets</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {sheetsReady ? "Live" : "Demo"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {sheetsReady
                    ? "ÃƒÂÃƒÂ£ cÃƒÂ³ c?u hÃƒÂ¬nh d? d?c ghi d? li?u th?c t?."
                    : "Hi?n t?i app ch?y du?c b?ng d? li?u m?u d? ki?m tra lu?ng."}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200/80 bg-slate-50/85 p-6">
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
                  ÃƒÂang nh?p
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  VÃƒÂ o b?ng di?u ph?i
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
                    ÃƒÂang nh?p v?i Google
                  </button>
                </form>
              ) : (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                  Chua cÃƒÂ³ c?u hÃƒÂ¬nh Google OAuth. B?n v?n cÃƒÂ³ th? vÃƒÂ o app b?ng ch? d? demo d? xem giao di?n vÃƒÂ  lu?ng nghi?p v?.
                </div>
              )}
              <div className="space-y-3 text-sm leading-6 text-slate-600">
                <p>Checklist tru?c khi ch?y production:</p>
                <ul className="space-y-2">
                  <li>1. T?o Google OAuth Client vÃƒÂ  di?n `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.</li>
                  <li>2. T?o service account cho Google Sheets r?i thÃƒÂªm `GOOGLE_SHEET_ID`, email, private key.</li>
                  <li>3. Khai bÃƒÂ¡o danh sÃƒÂ¡ch email du?c phÃƒÂ©p truy c?p b?ng tab `access_control` ho?c bi?n mÃƒÂ´i tru?ng allowlist.</li>
                </ul>
              </div>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
              >
                VÃƒÂ o b?n demo
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

