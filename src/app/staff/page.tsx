import { saveLeaveAction, savePositionAction, saveStaffAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/pill";
import { SurfaceSection } from "@/components/surface-section";
import {
  LEAVE_REASON_LABELS,
  LEAVE_SHIFT_LABELS,
  ROLE_LABELS,
} from "@/lib/constants";
import { getAppData } from "@/lib/repository";
import { canEdit, getUserContext } from "@/lib/session";

interface StaffPageProps {
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const { message, error } = await searchParams;
  const { authEnabled, user } = await getUserContext();
  const editable = canEdit(user.role);
  const data = await getAppData();

  return (
    <AppShell
      currentPath="/staff"
      title="NhÃƒÂ¢n s? vÃƒÂ  ngh? phÃƒÂ©p"
      description="Qu?n lÃƒÂ½ danh sÃƒÂ¡ch di?u du?ng, v? trÃƒÂ­ v?n hÃƒÂ nh, thÃƒÂ´ng tin ngh? phÃƒÂ©p/?m vÃƒÂ  b?ng phÃƒÂ¢n quy?n email cho dang nh?p Google."
      authEnabled={authEnabled}
      user={user}
      message={message}
      error={error}
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SurfaceSection
          eyebrow="ÃƒÂi?u du?ng"
          title="Danh sÃƒÂ¡ch nhÃƒÂ¢n s?"
          description="ThÃƒÂ´ng tin n?n d? ch?n khi l?p l?ch tu?n vÃƒÂ  t?ng h?p bÃƒÂ¡o cÃƒÂ¡o thÃƒÂ¡ng."
        >
          <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">ÃƒÂi?u du?ng</th>
                  <th className="px-4 py-3 font-medium">MÃƒÂ£</th>
                  <th className="px-4 py-3 font-medium">NhÃƒÂ³m</th>
                  <th className="px-4 py-3 font-medium">Tr?ng thÃƒÂ¡i</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {data.staff.map((member) => (
                  <tr key={member.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{member.name}</td>
                    <td className="px-4 py-3 text-slate-500">{member.code}</td>
                    <td className="px-4 py-3 text-slate-500">{member.team}</td>
                    <td className="px-4 py-3">
                      <Pill tone={member.active ? "emerald" : "amber"}>
                        {member.active ? "S?n sÃƒÂ ng" : "T?m ngh?"}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceSection>

        <SurfaceSection
          eyebrow="ThÃƒÂªm m?i"
          title="C?p nh?t di?u du?ng"
          description="ThÃƒÂªm ho?c c?p nh?t nhÃƒÂ¢n s? d? dÃƒÂ¹ng ngay cho l?ch n?n vÃƒÂ  l?ch tu?n."
        >
          <form action={saveStaffAction} className="grid gap-4">
            <input type="hidden" name="returnTo" value="/staff" />
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">H? vÃƒÂ  tÃƒÂªn</span>
              <input
                name="name"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="Nguy?n Th? A"
                disabled={!editable}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">MÃƒÂ£ di?u du?ng</span>
              <input
                name="code"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="DD09"
                disabled={!editable}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">NhÃƒÂ³m / khoa</span>
              <input
                name="team"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="KhÃƒÂ¡m t?ng quÃƒÂ¡t"
                disabled={!editable}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Ghi chÃƒÂº</span>
              <textarea
                name="notes"
                rows={3}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="VÃƒÂ­ d?: uu tiÃƒÂªn ca sÃƒÂ¡ng"
                disabled={!editable}
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" name="active" defaultChecked disabled={!editable} />
              ÃƒÂang ho?t d?ng
            </label>
            <button
              type="submit"
              disabled={!editable}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Luu di?u du?ng
            </button>
          </form>
        </SurfaceSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SurfaceSection
          eyebrow="V? trÃƒÂ­"
          title="Danh m?c v? trÃƒÂ­ lÃƒÂ m vi?c"
          description="M?i v? trÃƒÂ­ s? xu?t hi?n trong l?ch n?n vÃƒÂ  bÃƒÂ¡o cÃƒÂ¡o xoay vÃƒÂ²ng v? trÃƒÂ­."
        >
          <div className="space-y-3">
            {data.positions.map((position) => (
              <div
                key={position.id}
                className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{position.name}</p>
                    <p className="text-sm text-slate-500">{position.area}</p>
                  </div>
                  <Pill tone="teal">{position.description ? "MÃƒÂ´ t? s?n" : "Chua ghi chÃƒÂº"}</Pill>
                </div>
              </div>
            ))}
          </div>
          <form action={savePositionAction} className="mt-5 grid gap-4 border-t border-slate-200 pt-5">
            <input type="hidden" name="returnTo" value="/staff" />
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">TÃƒÂªn v? trÃƒÂ­</span>
              <input
                name="name"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="PhÃƒÂ²ng ECG"
                disabled={!editable}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Khu v?c</span>
              <input
                name="area"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="C?n lÃƒÂ¢m sÃƒÂ ng"
                disabled={!editable}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">MÃƒÂ´ t?</span>
              <textarea
                name="description"
                rows={3}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="MÃƒÂ´ t? ng?n v? ph?m vi v? trÃƒÂ­"
                disabled={!editable}
              />
            </label>
            <button
              type="submit"
              disabled={!editable}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              Luu v? trÃƒÂ­
            </button>
          </form>
        </SurfaceSection>

        <SurfaceSection
          eyebrow="Ngh? phÃƒÂ©p"
          title="Nh?p ca ngh?"
          description="ThÃƒÂ´ng tin ngh? phÃƒÂ©p ho?c ngh? ?m s? du?c dÃƒÂ¹ng d? c?nh bÃƒÂ¡o khi t?o l?ch tu?n m?i t? l?ch n?n."
        >
          <div className="grid gap-5 lg:grid-cols-[0.96fr_1.04fr]">
            <form action={saveLeaveAction} className="grid gap-4">
              <input type="hidden" name="returnTo" value="/staff" />
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">NhÃƒÂ¢n s?</span>
                <select
                  name="staffId"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  disabled={!editable}
                >
                  {data.staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">NgÃƒÂ y ngh?</span>
                <input
                  type="date"
                  name="date"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  disabled={!editable}
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Ca ngh?</span>
                <select
                  name="shift"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  defaultValue="full-day"
                  disabled={!editable}
                >
                  {Object.entries(LEAVE_SHIFT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">LÃƒÂ½ do</span>
                <select
                  name="reason"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  defaultValue="phep"
                  disabled={!editable}
                >
                  {Object.entries(LEAVE_REASON_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Ghi chÃƒÂº</span>
                <textarea
                  name="note"
                  rows={3}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  placeholder="VÃƒÂ­ d?: ngh? phÃƒÂ©p dÃƒÂ£ duy?t"
                  disabled={!editable}
                />
              </label>
              <button
                type="submit"
                disabled={!editable}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Luu ca ngh?
              </button>
            </form>

            <div className="space-y-3">
              {data.leaveRequests.map((leave) => {
                const person = data.staff.find((member) => member.id === leave.staffId);
                return (
                  <div
                    key={leave.id}
                    className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{person?.name ?? leave.staffId}</p>
                        <p className="text-slate-500">{leave.date}</p>
                      </div>
                      <Pill tone="amber">{LEAVE_REASON_LABELS[leave.reason]}</Pill>
                    </div>
                    <p className="mt-2 text-slate-500">{LEAVE_SHIFT_LABELS[leave.shift]}</p>
                    {leave.note ? <p className="mt-2 text-slate-500">{leave.note}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </SurfaceSection>
      </div>

      <SurfaceSection
        eyebrow="PhÃƒÂ¢n quy?n"
        title="Danh sÃƒÂ¡ch email du?c quy?n truy c?p"
        description="? b?n hi?n t?i, quy?n du?c d?c t? tab `access_control` trong Google Sheets ho?c t? bi?n mÃƒÂ´i tru?ng allowlist."
      >
        <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Hi?n th?</th>
                <th className="px-4 py-3 font-medium">Quy?n</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {data.accessControl.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{entry.email}</td>
                  <td className="px-4 py-3 text-slate-500">{entry.displayName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Pill tone="teal">{ROLE_LABELS[entry.role]}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceSection>
    </AppShell>
  );
}

