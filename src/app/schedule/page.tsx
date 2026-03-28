import Link from "next/link";
import { Download, RefreshCcw, SendHorizontal } from "lucide-react";
import {
  generateWeekAction,
  publishWeekAction,
  saveWeeklyAssignmentAction,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/pill";
import { ScheduleBoard } from "@/components/schedule-board";
import { SurfaceSection } from "@/components/surface-section";
import { SHIFT_LABELS, WEEKDAY_LABELS } from "@/lib/constants";
import { formatDate, getWeekDates, getWeekStartFromInput } from "@/lib/date";
import { getAppData } from "@/lib/repository";
import {
  buildAssignmentsFromTemplate,
  getActiveScheduleRules,
  getWeekBoard,
  getWeeklyAssignments,
} from "@/lib/schedule";
import { canEdit, getUserContext } from "@/lib/session";

interface SchedulePageProps {
  searchParams: Promise<{
    week?: string;
    message?: string;
    error?: string;
  }>;
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const { week, message, error } = await searchParams;
  const weekStart = getWeekStartFromInput(week);
  const returnTo = `/schedule?week=${weekStart}`;
  const { authEnabled, user } = await getUserContext();
  const data = await getAppData();
  const editable = canEdit(user.role);
  const activeRules = getActiveScheduleRules(data.scheduleRules);

  const actualAssignments = getWeeklyAssignments(data.weeklySchedule, weekStart);
  const displayedAssignments =
    actualAssignments.length > 0
      ? actualAssignments
      : buildAssignmentsFromTemplate(
          data.templateSchedule,
          weekStart,
          data.leaveRequests,
          data.scheduleRules,
        );

  const board = getWeekBoard(
    displayedAssignments,
    data.positions,
    data.staff,
    data.leaveRequests,
    weekStart,
    data.scheduleRules,
  );

  const dayOptions = getWeekDates(weekStart);

  return (
    <AppShell
      currentPath="/schedule"
      title="Lá»‹ch tuáº§n"
      description="Láº¥y lá»‹ch ná»n Ä‘á»ƒ táº¡o dá»± tháº£o, tinh chá»‰nh Ä‘á»™t xuáº¥t cho tuáº§n Ä‘ang váº­n hÃ nh vÃ  chá»‘t thÃ nh lá»‹ch chÃ­nh thá»©c khi Ä‘Ã£ Ä‘á»§ nhÃ¢n sá»±."
      authEnabled={authEnabled}
      user={user}
      message={message}
      error={error}
    >
      <SurfaceSection
        eyebrow="Äiá»u phá»‘i tuáº§n"
        title={`Tuáº§n báº¯t Ä‘áº§u ${formatDate(weekStart)}`}
        description="Náº¿u tuáº§n nÃ y chÆ°a cÃ³ dá»¯ liá»‡u chÃ­nh thá»©c, app Ä‘ang hiá»ƒn thá»‹ preview sinh tá»« lá»‹ch ná»n theo quy táº¯c ca lÃ m hiá»‡n táº¡i."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/api/export/weekly?week=${weekStart}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <Download className="h-4 w-4" />
              Xuáº¥t Excel
            </Link>
            {editable ? (
              <>
                <form action={generateWeekAction}>
                  <input type="hidden" name="weekStart" value={weekStart} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Sinh láº¡i tá»« lá»‹ch ná»n
                  </button>
                </form>
                <form action={publishWeekAction}>
                  <input type="hidden" name="weekStart" value={weekStart} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    <SendHorizontal className="h-4 w-4" />
                    Chá»‘t lá»‹ch tuáº§n
                  </button>
                </form>
              </>
            ) : null}
          </div>
        }
      >
        <div className="mb-5 flex flex-wrap gap-2">
          <Pill tone={actualAssignments.length > 0 ? "teal" : "amber"}>
            {actualAssignments.length > 0 ? "Äang xem lá»‹ch Ä‘Ã£ lÆ°u" : "Äang xem preview tá»« lá»‹ch ná»n"}
          </Pill>
          <Pill tone="slate">{displayedAssignments.length} dÃ²ng phÃ¢n cÃ´ng</Pill>
          <Pill tone="rose">
            {
              displayedAssignments.filter((item) => item.status === "needs-review")
                .length
            } ca cáº§n rÃ  soÃ¡t
          </Pill>
        </div>
        <ScheduleBoard board={board} />
      </SurfaceSection>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SurfaceSection
          eyebrow="Äiá»u chá»‰nh Ä‘á»™t xuáº¥t"
          title="Cáº­p nháº­t má»™t ca cá»¥ thá»ƒ"
          description="DÃ¹ng khi cáº§n Ä‘á»•i ngÆ°á»i cho tuáº§n Ä‘ang váº­n hÃ nh hoáº·c tuáº§n Ä‘Ã£ submit. Dá»¯ liá»‡u sáº½ ghi Ä‘Ã¨ lÃªn vá»‹ trÃ­ - ngÃ y - ca tÆ°Æ¡ng á»©ng."
        >
          <form action={saveWeeklyAssignmentAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="weekStart" value={weekStart} />
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">NgÃ y lÃ m</span>
              <select
                name="date"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                defaultValue={dayOptions[0]?.date}
                disabled={!editable}
              >
                {dayOptions.map((day) => (
                  <option key={day.date} value={day.date}>
                    {WEEKDAY_LABELS[day.weekday]} - {day.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Ca</span>
              <select
                name="shift"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                defaultValue="morning"
                disabled={!editable}
              >
                {Object.entries(SHIFT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Vá»‹ trÃ­</span>
              <select
                name="positionId"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                disabled={!editable}
              >
                {data.positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">NhÃ¢n sá»±</span>
              <select
                name="staffId"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                disabled={!editable}
              >
                {data.staff.filter((member) => member.active).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
              <span className="font-medium">Tráº¡ng thÃ¡i</span>
              <select
                name="status"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                defaultValue="adjusted"
                disabled={!editable}
              >
                <option value="draft">Dá»± tháº£o</option>
                <option value="adjusted">Äiá»u chá»‰nh</option>
                <option value="published">ChÃ­nh thá»©c</option>
                <option value="needs-review">Cáº§n rÃ  soÃ¡t</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
              <span className="font-medium">Ghi chÃº</span>
              <textarea
                name="note"
                rows={4}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="VÃ­ dá»¥: Ä‘á»•i trá»±c do nghá»‰ á»‘m Ä‘á»™t xuáº¥t"
                disabled={!editable}
              />
            </label>
            <button
              type="submit"
              disabled={!editable}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              LÆ°u Ä‘iá»u chá»‰nh
            </button>
          </form>
        </SurfaceSection>

        <SurfaceSection
          eyebrow="Quy táº¯c ca lÃ m"
          title="Khung lá»‹ch Ä‘ang Ã¡p dá»¥ng"
          description="Trang Lá»‹ch ná»n cho phÃ©p báº­t/táº¯t tá»«ng ca trong tuáº§n. Báº£ng dÆ°á»›i Ä‘Ã¢y cho báº¡n tháº¥y chÃ­nh xÃ¡c lá»‹ch tuáº§n Ä‘ang sinh theo rule nÃ o."
        >
          <div className="space-y-3">
            {activeRules.map((slot) => (
              <div
                key={`${slot.dayOfWeek}-${slot.shift}`}
                className="flex items-center justify-between rounded-[22px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{WEEKDAY_LABELS[slot.dayOfWeek]}</p>
                  <p className="text-slate-500">{SHIFT_LABELS[slot.shift]}</p>
                </div>
                <Pill tone="slate">{data.positions.length} vá»‹ trÃ­</Pill>
              </div>
            ))}
          </div>
        </SurfaceSection>
      </div>
    </AppShell>
  );
}
