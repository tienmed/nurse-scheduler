import Link from "next/link";
import {
  ExternalLink,
  Download,
  RefreshCcw,
} from "lucide-react";
import {
  generateWeekAction,
} from "@/app/actions";
import { AIAssistant } from "@/components/ai-assistant";
import { AppShell } from "@/components/app-shell";
import { AuthRequiredState } from "@/components/auth-required-state";
import { Pill } from "@/components/pill";
import { ScheduleBoard } from "@/components/schedule-board";
import { SaturdayOvertimeBoard } from "@/components/saturday-overtime-board";
import { AutoGenerateWeek } from "@/components/auto-generate-week";
import { SubmitButton } from "@/components/submit-button";
import { SurfaceSection } from "@/components/surface-section";
import {
  WEEKDAY_LABELS,
} from "@/lib/constants";
import { formatDate, getWeekStartFromInput, isCurrentOrNextWeek, isOffDay } from "@/lib/date";
import { getAppData } from "@/lib/repository";
import {
  buildAssignmentsFromTemplate,
  calculateMonthlyWorkload,
  getActiveScheduleRules,
  getWeekBoard,
  getWeeklyAssignments,
} from "@/lib/schedule";
import { canEdit, getUserContext } from "@/lib/session";
import { parseISO, addDays, format } from "date-fns";

interface SchedulePageProps {
  searchParams: Promise<{
    week?: string;
    day?: string;
    shift?: string;
    message?: string;
    error?: string;
  }>;
}

function getDefaultDayAndShift(weekStart: string): { day: number; shift: "morning" | "afternoon" } {
  const now = new Date();
  const weekStartDate = parseISO(weekStart);
  const weekEndDate = addDays(weekStartDate, 5); // Thá»© 7

  // Náº¿u ngÃ y hiá»‡n táº¡i náº±m trong tuáº§n Ä‘ang xem
  if (now >= weekStartDate && now <= addDays(weekEndDate, 1)) {
    const currentDay = now.getDay(); // 0=CN, 1=T2, ...6=T7
    const hour = now.getHours();

    // Náº¿u lÃ  CN hoáº·c ngoÃ i pháº¡m vi T2-T7, máº·c Ä‘á»‹nh SÃ¡ng T2
    if (currentDay === 0 || currentDay > 6) {
      return { day: 1, shift: "morning" };
    }

    return {
      day: currentDay, // 1=T2, 2=T3... khá»›p dayOfWeek
      shift: hour < 12 ? "morning" : "afternoon",
    };
  }

  // Tuáº§n chÆ°a tá»›i hoáº·c Ä‘Ã£ qua â†’ máº·c Ä‘á»‹nh SÃ¡ng T2
  return { day: 1, shift: "morning" };
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const { week, day: dayParam, shift: shiftParam, message, error } = await searchParams;
  const weekStart = getWeekStartFromInput(week);
  const returnTo = `/schedule?week=${weekStart}`;
  const { authEnabled, user } = await getUserContext({ required: false });
  if (authEnabled && !user) {
    return (
      <AppShell
        currentPath="/schedule"
        title="Lá»‹ch tuáº§n"
        description="Táº¡o dá»± tháº£o tá»« lá»‹ch ná»n, Ä‘iá»u chá»‰nh ca phÃ¡t sinh vÃ  chá»‘t lá»‹ch tuáº§n chÃ­nh thá»©c khi Ä‘Ã£ Ä‘á»§ nhÃ¢n sá»±."
        authEnabled={authEnabled}
        user={user}
        message={message}
        error={error}
      >
        <AuthRequiredState returnTo={returnTo} />
      </AppShell>
    );
  }
  const currentUser = user!;
  const data = await getAppData();
  const editable = canEdit(currentUser.role);
  const canPlan = isCurrentOrNextWeek(weekStart);
  const activeRules = getActiveScheduleRules(data.scheduleRules);

  const actualAssignments = getWeeklyAssignments(data.weeklySchedule, weekStart);
  const displayedAssignments =
    actualAssignments.length > 0
      ? actualAssignments
      : buildAssignmentsFromTemplate(
        data.templateSchedule,
        data.positions,
        weekStart,
        data.leaveRequests,
        data.scheduleRules,
        data.positionRules,
        data.holidays,
      );

  const fullBoard = getWeekBoard(
    displayedAssignments,
    data.positions,
    data.staff,
    data.leaveRequests,
    weekStart,
    data.scheduleRules,
    data.positionRules,
    data.holidays,
  );

  const monthKey = weekStart.slice(0, 7);
  const workload = calculateMonthlyWorkload(actualAssignments, monthKey, data.holidays);

  // TÃ­nh ngÃ y + buá»•i Ä‘ang chá»n
  const defaults = getDefaultDayAndShift(weekStart);
  const selectedDay = dayParam ? Number(dayParam) : defaults.day;
  const selectedShift: "morning" | "afternoon" =
    shiftParam === "morning" || shiftParam === "afternoon" ? shiftParam : defaults.shift;

  // Filter board: chá»‰ láº¥y 1 slot khá»›p
  const filteredBoard = fullBoard.filter(
    (slot) => slot.dayOfWeek === selectedDay && slot.shift === selectedShift,
  );

  // Build danh sÃ¡ch tabs cho Ä‘iá»u hÆ°á»›ng buá»•i
  const slotTabs = activeRules.map((rule) => {
    const date = format(addDays(parseISO(weekStart), rule.dayOfWeek - 1), "yyyy-MM-dd");
    const isActive = rule.dayOfWeek === selectedDay && rule.shift === selectedShift;
    return {
      dayOfWeek: rule.dayOfWeek,
      shift: rule.shift,
      label: `${rule.shift === "morning" ? "S" : "C"} ${WEEKDAY_LABELS[rule.dayOfWeek].replace("Thá»© ", "T")}`,
      href: `/schedule?week=${weekStart}&day=${rule.dayOfWeek}&shift=${rule.shift}`,
      isActive,
      date,
    };
    })
    .filter((tab) => !isOffDay(tab.date, tab.shift as "morning" | "afternoon", data.holidays));

  return (
    <AppShell
      currentPath="/schedule"
      title="Lá»‹ch tuáº§n"
      description="Táº¡o dá»± tháº£o tá»« lá»‹ch ná»n, Ä‘iá»u chá»‰nh ca phÃ¡t sinh vÃ  chá»‘t lá»‹ch tuáº§n chÃ­nh thá»©c khi Ä‘Ã£ Ä‘á»§ nhÃ¢n sá»±."
      authEnabled={authEnabled}
      user={currentUser}
      message={message}
      error={error}
    >
      <SurfaceSection
        eyebrow="Äiá»u phá»‘i tuáº§n"
        title={`Tuáº§n báº¯t Ä‘áº§u ${formatDate(weekStart)}`}
        description="Chá»n buá»•i bÃªn dÆ°á»›i Ä‘á»ƒ xem vÃ  Ä‘iá»u chá»‰nh phÃ¢n cÃ´ng theo tá»«ng ca."
        action={
          <div className="flex flex-wrap gap-2">
            <AIAssistant weekStart={weekStart} mode="schedule" />
            <Link
              href={`/api/export/weekly?week=${weekStart}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <Download className="h-4 w-4" />
              Xuáº¥t Excel
            </Link>
            <Link
              href="/board"
              className="inline-flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 transition hover:border-teal-300 hover:bg-teal-100"
            >
              <ExternalLink className="h-4 w-4" />
              Lá»‹ch Public
            </Link>
            {currentUser.role === "admin" && canPlan && (
              <form action={generateWeekAction}>
                <input type="hidden" name="weekStart" value={weekStart} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <SubmitButton
                  variant="outline"
                  pendingText="Äang sinh lá»‹ch..."
                  confirmMessage="Cáº¢NH BÃO: HÃ nh Ä‘á»™ng nÃ y sáº½ Cáº¬P NHáº¬T Láº I TOÃ€N Bá»˜ lá»‹ch tuáº§n dá»±a trÃªn lá»‹ch ná»n. Má»i sá»± thay Ä‘á»•i, Ä‘iá»u chá»‰nh nhÃ¢n sá»± Ä‘Ã£ thá»±c hiá»‡n thá»§ cÃ´ng trÃªn lá»‹ch tuáº§n hiá»‡n táº¡i sáº½ bá»‹ xoÃ¡ vÃ  khÃ´i phá»¥c vá» tráº¡ng thÃ¡i máº·c Ä‘á»‹nh cá»§a lá»‹ch ná»n. Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n tiáº¿p tá»¥c?"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Sinh láº¡i tá»« lá»‹ch ná»n
                </SubmitButton>
              </form>
            )}
          </div>
        }
      >
        <div className="mb-5 flex flex-wrap gap-2">
          <Pill tone={actualAssignments.length > 0 ? "teal" : "amber"}>
            {actualAssignments.length > 0 ? "Lá»‹ch chÃ­nh thá»©c" : "Äang xem trÆ°á»›c tá»« lá»‹ch ná»n"}
          </Pill>
          <Pill tone="slate">{displayedAssignments.length} dÃ²ng phÃ¢n cÃ´ng</Pill>
          <Pill tone="rose">
            {displayedAssignments.filter((item) => item.status === "needs-review").length} ca cáº§n rÃ  soÃ¡t
          </Pill>
          {!canPlan && (
            <Pill tone="amber">Chá»‰ Ä‘Æ°á»£c sinh/chá»‘t lá»‹ch cho tuáº§n hiá»‡n táº¡i hoáº·c tuáº§n káº¿ tiáº¿p</Pill>
          )}
        </div>

        {/* Tabs ngang Ä‘iá»u hÆ°á»›ng buá»•i */}
        <div className="mb-5 -mx-1 flex flex-wrap gap-1.5">
          {slotTabs.map((tab) => (
            <Link
              key={`${tab.dayOfWeek}-${tab.shift}`}
              href={tab.href}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${tab.isActive
                ? "bg-slate-950 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {selectedDay === 6 && selectedShift === "morning" ? (
          <SaturdayOvertimeBoard
            staff={data.staff}
            weeklySchedule={actualAssignments}
            date={format(addDays(parseISO(weekStart), 5), "yyyy-MM-dd")}
            shift={selectedShift}
            weekStart={weekStart}
            editable={editable}
          />
        ) : (
          <ScheduleBoard
            board={filteredBoard}
            positions={data.positions}
            emptyTitle="Tuáº§n nÃ y chÆ°a cÃ³ ca nÃ o Ä‘á»ƒ Ä‘iá»u phá»‘i"
            emptyDescription="Báº¡n cáº§n Ã­t nháº¥t má»™t vá»‹ trÃ­, má»™t Ä‘iá»u dÆ°á»¡ng Ä‘ang hoáº¡t Ä‘á»™ng vÃ  má»™t ca lÃ m Ä‘ang báº­t Ä‘á»ƒ táº¡o lá»‹ch tuáº§n."
            staff={data.staff}
            leaveRequests={data.leaveRequests}
            workload={workload}
            weeklySchedule={actualAssignments}
            weekStart={weekStart}
            editable={editable}
            showEmptySlotSummary
          />
        )}
      </SurfaceSection>
      <AutoGenerateWeek 
        weekStart={weekStart} 
        enabled={actualAssignments.length === 0 && canPlan} 
      />
    </AppShell>
  );
}
