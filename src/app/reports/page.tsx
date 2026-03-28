import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/pill";
import { SurfaceSection } from "@/components/surface-section";
import { getMonthKey } from "@/lib/date";
import { getAppData } from "@/lib/repository";
import {
  calculateMonthlyLeaves,
  calculateMonthlyWorkload,
  calculatePositionRotations,
} from "@/lib/schedule";
import { getUserContext } from "@/lib/session";

interface ReportsPageProps {
  searchParams: Promise<{
    month?: string;
    message?: string;
    error?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { month, message, error } = await searchParams;
  const monthKey = getMonthKey(month);
  const { authEnabled, user } = await getUserContext();
  const data = await getAppData();

  const workload = calculateMonthlyWorkload(data.weeklySchedule, monthKey).sort(
    (left, right) => right.shifts - left.shifts,
  );
  const leaves = calculateMonthlyLeaves(data.leaveRequests, monthKey).sort(
    (left, right) => right.days - left.days,
  );
  const rotations = calculatePositionRotations(data.weeklySchedule).slice(0, 18);

  return (
    <AppShell
      currentPath="/reports"
      title="BÃƒÂ¡o cÃƒÂ¡o thÃƒÂ¡ng"
      description="Th?ng kÃƒÂª s? ngÃƒÂ y lÃƒÂ m, s? lu?t ngh? vÃƒÂ  ph?m vi v? trÃƒÂ­ dÃƒÂ£ ph? trÃƒÂ¡ch d? h? tr? cÃƒÂ¢n b?ng t?i vÃƒÂ  xoay vÃƒÂ²ng nhÃƒÂ¢n s?."
      authEnabled={authEnabled}
      user={user}
      message={message}
      error={error}
    >
      <SurfaceSection
        eyebrow="B? l?c"
        title="ThÃƒÂ¡ng bÃƒÂ¡o cÃƒÂ¡o"
        description="BÃƒÂ¡o cÃƒÂ¡o nÃƒÂ y t?ng h?p t? toÃƒÂ n b? l?ch tu?n dÃƒÂ£ luu vÃƒÂ  danh sÃƒÂ¡ch ngh? phÃƒÂ©p trong thÃƒÂ¡ng dang ch?n."
      >
        <form action="/reports" className="flex flex-col gap-3 md:max-w-xs">
          <input
            type="month"
            name="month"
            defaultValue={monthKey}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Xem bÃƒÂ¡o cÃƒÂ¡o
          </button>
        </form>
      </SurfaceSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceSection
          eyebrow="Kh?i lu?ng cÃƒÂ´ng vi?c"
          title="S? ngÃƒÂ y lÃƒÂ m theo nhÃƒÂ¢n s?"
          description="TÃƒÂ­nh theo s? ngÃƒÂ y xu?t hi?n trÃƒÂªn l?ch vÃƒÂ  t?ng s? ca trong thÃƒÂ¡ng dang ch?n."
        >
          <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">NhÃƒÂ¢n s?</th>
                  <th className="px-4 py-3 font-medium">NgÃƒÂ y lÃƒÂ m</th>
                  <th className="px-4 py-3 font-medium">Ca sÃƒÂ¡ng</th>
                  <th className="px-4 py-3 font-medium">Ca chi?u</th>
                  <th className="px-4 py-3 font-medium">T?ng ca</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {workload.map((item) => {
                  const person = data.staff.find((staff) => staff.id === item.staffId);
                  return (
                    <tr key={item.staffId}>
                      <td className="px-4 py-3 font-medium text-slate-900">{person?.name ?? item.staffId}</td>
                      <td className="px-4 py-3 text-slate-500">{item.workDays}</td>
                      <td className="px-4 py-3 text-slate-500">{item.morningShifts}</td>
                      <td className="px-4 py-3 text-slate-500">{item.afternoonShifts}</td>
                      <td className="px-4 py-3">
                        <Pill tone="teal">{item.shifts}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SurfaceSection>

        <SurfaceSection
          eyebrow="Ngh? phÃƒÂ©p"
          title="CÃƒÂ¡c ngÃƒÂ y ngh? theo nhÃƒÂ¢n s?"
          description="T?ng h?p t? phi?u ngh? dÃƒÂ£ nh?p, quy d?i ca ngh? n?a ngÃƒÂ y thÃƒÂ nh 0.5 ngÃƒÂ y."
        >
          <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">NhÃƒÂ¢n s?</th>
                  <th className="px-4 py-3 font-medium">NgÃƒÂ y ngh?</th>
                  <th className="px-4 py-3 font-medium">PhÃƒÂ©p</th>
                  <th className="px-4 py-3 font-medium">?m</th>
                  <th className="px-4 py-3 font-medium">KhÃƒÂ¡c</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {leaves.map((item) => {
                  const person = data.staff.find((staff) => staff.id === item.staffId);
                  return (
                    <tr key={item.staffId}>
                      <td className="px-4 py-3 font-medium text-slate-900">{person?.name ?? item.staffId}</td>
                      <td className="px-4 py-3 text-slate-500">{item.days}</td>
                      <td className="px-4 py-3 text-slate-500">{item.phep}</td>
                      <td className="px-4 py-3 text-slate-500">{item.om}</td>
                      <td className="px-4 py-3 text-slate-500">{item.khac}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SurfaceSection>
      </div>

      <SurfaceSection
        eyebrow="Xoay vÃƒÂ²ng v? trÃƒÂ­"
        title="Theo dÃƒÂµi ph?m vi v? trÃƒÂ­ dÃƒÂ£ ph? trÃƒÂ¡ch"
        description="B?ng nÃƒÂ y t?ng h?p d? li?u dang cÃƒÂ³ d? bi?t m?i nhÃƒÂ¢n s? dÃƒÂ£ lÃƒÂ m ? v? trÃƒÂ­ nÃƒÂ o t? th?i di?m nÃƒÂ o d?n th?i di?m nÃƒÂ o trong l?ch s? luu tr? hi?n cÃƒÂ³."
      >
        <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">NhÃƒÂ¢n s?</th>
                <th className="px-4 py-3 font-medium">V? trÃƒÂ­</th>
                <th className="px-4 py-3 font-medium">T? ngÃƒÂ y</th>
                <th className="px-4 py-3 font-medium">ÃƒÂ?n ngÃƒÂ y</th>
                <th className="px-4 py-3 font-medium">S? ca</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rotations.map((item) => {
                const person = data.staff.find((staff) => staff.id === item.staffId);
                const position = data.positions.find((position) => position.id === item.positionId);
                return (
                  <tr key={`${item.staffId}-${item.positionId}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">{person?.name ?? item.staffId}</td>
                    <td className="px-4 py-3 text-slate-500">{position?.name ?? item.positionId}</td>
                    <td className="px-4 py-3 text-slate-500">{item.firstDate}</td>
                    <td className="px-4 py-3 text-slate-500">{item.lastDate}</td>
                    <td className="px-4 py-3">
                      <Pill tone="teal">{item.shifts} ca</Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SurfaceSection>
    </AppShell>
  );
}

