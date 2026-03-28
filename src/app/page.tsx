import Link from "next/link";
import { ArrowRight, CalendarRange, Database, FileSpreadsheet, UserRoundCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/pill";
import { SurfaceSection } from "@/components/surface-section";
import { getMonthKey, getNextWeekStart } from "@/lib/date";
import { isSheetsConfigured } from "@/lib/env";
import { getAppData } from "@/lib/repository";
import {
  buildAssignmentsFromTemplate,
  calculateMonthlyLeaves,
  calculateMonthlyWorkload,
  getWeekBoard,
  getWeeklyAssignments,
} from "@/lib/schedule";
import { getUserContext } from "@/lib/session";

interface HomePageProps {
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { message, error } = await searchParams;
  const { authEnabled, user } = await getUserContext();
  const data = await getAppData();
  const currentMonth = getMonthKey();
  const nextWeekStart = getNextWeekStart();

  const nextWeekAssignments = getWeeklyAssignments(data.weeklySchedule, nextWeekStart);
  const nextWeekView =
    nextWeekAssignments.length > 0
      ? nextWeekAssignments
      : buildAssignmentsFromTemplate(
          data.templateSchedule,
          nextWeekStart,
          data.leaveRequests,
          data.scheduleRules,
        );

  const nextWeekBoard = getWeekBoard(
    nextWeekView,
    data.positions,
    data.staff,
    data.leaveRequests,
    nextWeekStart,
    data.scheduleRules,
  );

  const monthlyWorkload = calculateMonthlyWorkload(data.weeklySchedule, currentMonth);
  const monthlyLeaves = calculateMonthlyLeaves(data.leaveRequests, currentMonth);

  const kpis = [
    {
      label: "Äiá»u dÆ°á»¡ng hoáº¡t Ä‘á»™ng",
      value: `${data.staff.filter((item) => item.active).length}`,
      detail: "NhÃ¢n sá»± Ä‘ang á»Ÿ tráº¡ng thÃ¡i sáºµn sÃ ng phÃ¢n cÃ´ng",
      icon: UserRoundCheck,
    },
    {
      label: "Vá»‹ trÃ­ váº­n hÃ nh",
      value: `${data.positions.length}`,
      detail: "Danh má»¥c vá»‹ trÃ­ cÃ³ thá»ƒ phÃ¢n cÃ´ng trong lá»‹ch ná»n",
      icon: CalendarRange,
    },
    {
      label: "Ca tuáº§n tá»›i",
      value: `${nextWeekView.length}`,
      detail: nextWeekAssignments.length
        ? "ÄÃ£ cÃ³ lá»‹ch dá»± tháº£o/chÃ­nh thá»©c cho tuáº§n káº¿ tiáº¿p"
        : "Äang hiá»ƒn thá»‹ preview sinh tá»« lá»‹ch ná»n",
      icon: FileSpreadsheet,
    },
    {
      label: "Nguá»“n dá»¯ liá»‡u",
      value: isSheetsConfigured() ? "Live" : "Demo",
      detail: isSheetsConfigured()
        ? "Äang Ä‘á»c vÃ  ghi trá»±c tiáº¿p trÃªn Google Sheets"
        : "ChÆ°a ná»‘i Google Sheets, Ä‘ang dÃ¹ng dá»¯ liá»‡u máº«u",
      icon: Database,
    },
  ];

  const pendingConflicts = nextWeekView.filter((item) => item.status === "needs-review");

  return (
    <AppShell
      currentPath="/"
      title="Tá»•ng quan váº­n hÃ nh"
      description="Theo dÃµi lá»‹ch ná»n, tuáº§n Ä‘ang cháº¡y, tuáº§n káº¿ tiáº¿p vÃ  tráº¡ng thÃ¡i Ä‘á»“ng bá»™ trÆ°á»›c khi chá»‘t lá»‹ch chÃ­nh thá»©c."
      authEnabled={authEnabled}
      user={user}
      message={message}
      error={error}
    >
      <div className="grid gap-4 xl:grid-cols-4">
        {kpis.map(({ label, value, detail, icon: Icon }) => (
          <section
            key={label}
            className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <Icon className="h-5 w-5 text-teal-700" />
            </div>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
              {value}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p>
          </section>
        ))}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.45fr_0.95fr]">
        <SurfaceSection
          eyebrow="Tuáº§n káº¿ tiáº¿p"
          title="Lá»‹ch tuáº§n sau Ä‘á»ƒ rÃ  soÃ¡t cuá»‘i tuáº§n"
          description="Náº¿u tuáº§n sau chÆ°a cÃ³ lá»‹ch chÃ­nh thá»©c, app sáº½ láº¥y lá»‹ch ná»n Ä‘á»ƒ preview. Khi ná»‘i Google Sheets, báº¡n cÃ³ thá»ƒ sinh dá»± tháº£o rá»“i chá»‰nh tiáº¿p trÆ°á»›c khi chá»‘t."
          action={
            <Link
              href={`/schedule?week=${nextWeekStart}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Má»Ÿ lá»‹ch tuáº§n tá»›i
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Pill tone={nextWeekAssignments.length > 0 ? "teal" : "amber"}>
                {nextWeekAssignments.length > 0 ? "ÄÃ£ cÃ³ dá»¯ liá»‡u tuáº§n tá»›i" : "Äang preview tá»« lá»‹ch ná»n"}
              </Pill>
              <Pill tone={pendingConflicts.length > 0 ? "rose" : "emerald"}>
                {pendingConflicts.length > 0
                  ? `${pendingConflicts.length} vá»‹ trÃ­ cáº§n rÃ  soÃ¡t nghá»‰ phÃ©p`
                  : "KhÃ´ng cÃ³ xung Ä‘á»™t nghá»‰ phÃ©p"}
              </Pill>
            </div>
            <div className="space-y-4">
              {nextWeekBoard.slice(0, 4).map((slot) => (
                <div
                  key={`${slot.date}-${slot.shift}`}
                  className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{slot.title}</p>
                      <p className="text-sm text-slate-500">{slot.date}</p>
                    </div>
                    <Pill tone="slate">{slot.entries.length} vá»‹ trÃ­</Pill>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {slot.entries.slice(0, 4).map((entry) => (
                      <div
                        key={`${slot.date}-${slot.shift}-${entry.position.id}`}
                        className="rounded-2xl border border-white bg-white px-3 py-3 text-sm"
                      >
                        <p className="font-medium text-slate-900">{entry.position.name}</p>
                        <p className="mt-1 text-slate-500">
                          {entry.person?.name ?? "ChÆ°a phÃ¢n cÃ´ng"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SurfaceSection>

        <div className="space-y-6">
          <SurfaceSection
            eyebrow="RÃ  soÃ¡t"
            title="Nhá»¯ng Ä‘iá»ƒm cáº§n nhÃ¬n ngay"
            description="CÃ¡c chá»‰ bÃ¡o ngáº¯n Ä‘á»ƒ Ä‘iá»u phá»‘i biáº¿t tuáº§n nÃ o cáº§n chá»‘t láº¡i nhÃ¢n sá»±, tuáº§n nÃ o Ä‘Ã£ á»•n."
          >
            <div className="space-y-4">
              <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-semibold text-rose-700">Xung Ä‘á»™t nghá»‰ phÃ©p</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-rose-950">
                  {pendingConflicts.length}
                </p>
                <p className="mt-2 text-sm leading-6 text-rose-700">
                  Nhá»¯ng ca nÃ y Ä‘ang trÃ¹ng vá»›i thÃ´ng tin nghá»‰ Ä‘Ã£ nháº­p vÃ  nÃªn Ä‘á»•i ngÆ°á»i trÆ°á»›c khi submit.
                </p>
              </div>
              <div className="rounded-[24px] border border-teal-200 bg-teal-50 p-4">
                <p className="text-sm font-semibold text-teal-700">CÃ´ng suáº¥t phÃ¢n cÃ´ng thÃ¡ng nÃ y</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-teal-950">
                  {monthlyWorkload.reduce((sum, item) => sum + item.shifts, 0)} ca
                </p>
                <p className="mt-2 text-sm leading-6 text-teal-700">
                  Tá»•ng ca Ä‘Ã£ phÃ¢n cÃ´ng trong thÃ¡ng Ä‘ang chá»n Ä‘á»ƒ lÃ m cÆ¡ sá»Ÿ cÃ¢n báº±ng táº£i.
                </p>
              </div>
            </div>
          </SurfaceSection>

          <SurfaceSection
            eyebrow="Nghá»‰ phÃ©p"
            title="Danh sÃ¡ch nghá»‰ gáº§n nháº¥t"
            description="Theo dÃµi nhanh cÃ¡c ca nghá»‰ Ä‘Ã£ nháº­p Ä‘á»ƒ trÃ¡nh trÃ¹ng lá»‹ch khi sinh tuáº§n má»›i tá»« lá»‹ch ná»n."
          >
            <div className="space-y-3">
              {data.leaveRequests.slice(0, 6).map((leave) => {
                const person = data.staff.find((item) => item.id === leave.staffId);
                return (
                  <div
                    key={leave.id}
                    className="flex flex-col gap-2 rounded-[22px] border border-slate-200/80 bg-slate-50/75 px-4 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-950">{person?.name ?? leave.staffId}</p>
                      <p className="text-sm text-slate-500">{leave.date}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Pill tone="amber">{leave.reason}</Pill>
                      <Pill tone="slate">{leave.shift}</Pill>
                    </div>
                  </div>
                );
              })}
            </div>
          </SurfaceSection>
        </div>
      </div>

      <SurfaceSection
        eyebrow="PhÃ¢n tÃ­ch nhanh"
        title="Chá»‰ sá»‘ thÃ¡ng hiá»‡n táº¡i"
        description="Báº£n tÃ³m táº¯t Ä‘á»ƒ nhÃ¬n nhanh má»©c phÃ¢n cÃ´ng vÃ  nghá»‰ phÃ©p trÆ°á»›c khi sang trang bÃ¡o cÃ¡o chi tiáº¿t."
        action={
          <Link
            href={`/reports?month=${currentMonth}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Má»Ÿ bÃ¡o cÃ¡o thÃ¡ng
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-950">Top nhÃ¢n sá»± cÃ³ nhiá»u ca nháº¥t</p>
            <div className="mt-4 space-y-3">
              {monthlyWorkload
                .sort((left, right) => right.shifts - left.shifts)
                .slice(0, 5)
                .map((item) => {
                  const person = data.staff.find((staff) => staff.id === item.staffId);
                  return (
                    <div key={item.staffId} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{person?.name ?? item.staffId}</p>
                        <p className="text-slate-500">{item.workDays} ngÃ y lÃ m</p>
                      </div>
                      <Pill tone="teal">{item.shifts} ca</Pill>
                    </div>
                  );
                })}
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-950">NhÃ¢n sá»± cÃ³ nghá»‰ trong thÃ¡ng</p>
            <div className="mt-4 space-y-3">
              {monthlyLeaves.slice(0, 5).map((item) => {
                const person = data.staff.find((staff) => staff.id === item.staffId);
                return (
                  <div key={item.staffId} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{person?.name ?? item.staffId}</p>
                      <p className="text-slate-500">{item.days} ngÃ y nghá»‰ quy Ä‘á»•i</p>
                    </div>
                    <Pill tone="amber">{item.phep + item.om + item.khac} lÆ°á»£t</Pill>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SurfaceSection>
    </AppShell>
  );
}
