import Link from "next/link";
import {
  CalendarClock,
  Download,
  RefreshCcw,
  SendHorizontal,
} from "lucide-react";
import {
  generateWeekAction,
  publishWeekAction,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { AuthRequiredState } from "@/components/auth-required-state";
import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/pill";
import { ScheduleBoard } from "@/components/schedule-board";
import { SubmitButton } from "@/components/submit-button";
import { SurfaceSection } from "@/components/surface-section";
import {
  ASSIGNMENT_STATUS_LABELS,
  SHIFT_LABELS,
  WEEKDAY_LABELS,
} from "@/lib/constants";
import { formatDate, getWeekDates, getWeekStartFromInput, isCurrentOrNextWeek, isOffDay } from "@/lib/date";
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
  const weekEndDate = addDays(weekStartDate, 5); // Thứ 7

  // Nếu ngày hiện tại nằm trong tuần đang xem
  if (now >= weekStartDate && now <= addDays(weekEndDate, 1)) {
    const currentDay = now.getDay(); // 0=CN, 1=T2, ...6=T7
    const hour = now.getHours();

    // Nếu là CN hoặc ngoài phạm vi T2-T7, mặc định Sáng T2
    if (currentDay === 0 || currentDay > 6) {
      return { day: 1, shift: "morning" };
    }

    return {
      day: currentDay, // 1=T2, 2=T3... khớp dayOfWeek
      shift: hour < 12 ? "morning" : "afternoon",
    };
  }

  // Tuần chưa tới hoặc đã qua → mặc định Sáng T2
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
        title="Lịch tuần"
        description="Tạo dự thảo từ lịch nền, điều chỉnh ca phát sinh và chốt lịch tuần chính thức khi đã đủ nhân sự."
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

  // Tính ngày + buổi đang chọn
  const defaults = getDefaultDayAndShift(weekStart);
  const selectedDay = dayParam ? Number(dayParam) : defaults.day;
  const selectedShift: "morning" | "afternoon" =
    shiftParam === "morning" || shiftParam === "afternoon" ? shiftParam : defaults.shift;

  // Filter board: chỉ lấy 1 slot khớp
  const filteredBoard = fullBoard.filter(
    (slot) => slot.dayOfWeek === selectedDay && slot.shift === selectedShift,
  );

  const dayOptions = getWeekDates(weekStart);
  const activeStaff = data.staff.filter((member) => member.active);

  // Build danh sách tabs cho điều hướng buổi
  const slotTabs = activeRules.map((rule) => {
    const date = format(addDays(parseISO(weekStart), rule.dayOfWeek - 1), "yyyy-MM-dd");
    const isActive = rule.dayOfWeek === selectedDay && rule.shift === selectedShift;
    return {
      dayOfWeek: rule.dayOfWeek,
      shift: rule.shift,
      label: `${rule.shift === "morning" ? "S" : "C"} ${WEEKDAY_LABELS[rule.dayOfWeek].replace("Thứ ", "T")}`,
      href: `/schedule?week=${weekStart}&day=${rule.dayOfWeek}&shift=${rule.shift}`,
      isActive,
      date,
    };
    })
    .filter((tab) => !isOffDay(tab.date, tab.shift as "morning" | "afternoon", data.holidays));

  return (
    <AppShell
      currentPath="/schedule"
      title="Lịch tuần"
      description="Tạo dự thảo từ lịch nền, điều chỉnh ca phát sinh và chốt lịch tuần chính thức khi đã đủ nhân sự."
      authEnabled={authEnabled}
      user={currentUser}
      message={message}
      error={error}
    >
      <SurfaceSection
        eyebrow="Điều phối tuần"
        title={`Tuần bắt đầu ${formatDate(weekStart)}`}
        description="Chọn buổi bên dưới để xem và điều chỉnh phân công theo từng ca."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/api/export/weekly?week=${weekStart}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <Download className="h-4 w-4" />
              Xuất Excel
            </Link>
            {currentUser.role === "admin" && canPlan && (
              <form action={generateWeekAction}>
                <input type="hidden" name="weekStart" value={weekStart} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <SubmitButton
                  variant="outline"
                  pendingText="Đang sinh lịch..."
                >
                  <RefreshCcw className="h-4 w-4" />
                  Sinh lại từ lịch nền
                </SubmitButton>
              </form>
            )}
            {editable && canPlan && (
              <form action={publishWeekAction}>
                <input type="hidden" name="weekStart" value={weekStart} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <SubmitButton
                  pendingText="Đang chốt lịch..."
                >
                  <SendHorizontal className="h-4 w-4" />
                  Chốt lịch tuần
                </SubmitButton>
              </form>
            )}
          </div>
        }
      >
        <div className="mb-5 flex flex-wrap gap-2">
          <Pill tone={actualAssignments.length > 0 ? "teal" : "amber"}>
            {actualAssignments.length > 0 ? "Đang xem lịch đã lưu" : "Đang xem trước từ lịch nền"}
          </Pill>
          <Pill tone="slate">{displayedAssignments.length} dòng phân công</Pill>
          <Pill tone="rose">
            {displayedAssignments.filter((item) => item.status === "needs-review").length} ca cần rà soát
          </Pill>
          {!canPlan && (
            <Pill tone="amber">Chỉ được sinh/chốt lịch cho tuần hiện tại hoặc tuần kế tiếp</Pill>
          )}
        </div>

        {/* Tabs ngang điều hướng buổi */}
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

        <ScheduleBoard
          board={filteredBoard}
          positions={data.positions}
          emptyTitle="Tuần này chưa có ca nào để điều phối"
          emptyDescription="Bạn cần ít nhất một vị trí, một điều dưỡng đang hoạt động và một ca làm đang bật để tạo lịch tuần."
          staff={data.staff}
          leaveRequests={data.leaveRequests}
          workload={workload}
          weeklySchedule={actualAssignments}
          weekStart={weekStart}
          editable={editable}
        />
      </SurfaceSection>


    </AppShell>
  );
}
