import { saveScheduleRuleAction, saveTemplateAssignmentAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/pill";
import { ScheduleBoard } from "@/components/schedule-board";
import { SurfaceSection } from "@/components/surface-section";
import { DEFAULT_SCHEDULE_RULES, SHIFT_LABELS, WEEKDAY_LABELS } from "@/lib/constants";
import { getNextWeekStart } from "@/lib/date";
import { getAppData } from "@/lib/repository";
import {
  buildAssignmentsFromTemplate,
  getWeekBoard,
} from "@/lib/schedule";
import { canEdit, getUserContext } from "@/lib/session";

interface TemplatePageProps {
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
}

export default async function TemplatePage({ searchParams }: TemplatePageProps) {
  const { message, error } = await searchParams;
  const { authEnabled, user } = await getUserContext();
  const data = await getAppData();
  const editable = canEdit(user.role);
  const previewWeekStart = getNextWeekStart();
  const scheduleRules = data.scheduleRules.length > 0 ? data.scheduleRules : DEFAULT_SCHEDULE_RULES;

  const previewAssignments = buildAssignmentsFromTemplate(
    data.templateSchedule,
    previewWeekStart,
    data.leaveRequests,
    scheduleRules,
  );
  const board = getWeekBoard(
    previewAssignments,
    data.positions,
    data.staff,
    data.leaveRequests,
    previewWeekStart,
    scheduleRules,
  );

  return (
    <AppShell
      currentPath="/template"
      title="Lá»‹ch ná»n"
      description="Thiáº¿t láº­p bá»™ khung phÃ¢n cÃ´ng máº·c Ä‘á»‹nh cho tá»«ng vá»‹ trÃ­ theo tá»«ng ca. Má»—i cuá»‘i tuáº§n chá»‰ cáº§n sinh dá»± tháº£o tá»« Ä‘Ã¢y rá»“i chá»‰nh láº¡i tuáº§n cá»¥ thá»ƒ."
      authEnabled={authEnabled}
      user={user}
      message={message}
      error={error}
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SurfaceSection
          eyebrow="Preview"
          title="Xem trÆ°á»›c lá»‹ch ná»n cho tuáº§n káº¿ tiáº¿p"
          description="Báº£ng nÃ y giÃºp báº¡n nhÃ¬n ngay lá»‹ch ná»n khi Ä‘Æ°á»£c Ã¡p vÃ o má»™t tuáº§n tháº­t, theo Ä‘Ãºng quy táº¯c ca lÃ m Ä‘ang báº­t hiá»‡n táº¡i."
        >
          <div className="mb-5 flex flex-wrap gap-2">
            <Pill tone="teal">Preview tuáº§n báº¯t Ä‘áº§u {previewWeekStart}</Pill>
            <Pill tone="slate">{data.templateSchedule.length} dÃ²ng lá»‹ch ná»n</Pill>
          </div>
          <ScheduleBoard board={board} />
        </SurfaceSection>

        <div className="space-y-6">
          <SurfaceSection
            eyebrow="Quy táº¯c váº­n hÃ nh"
            title="Báº­t / táº¯t ca lÃ m theo khoa"
            description="ÄÃ¢y lÃ  nÆ¡i báº¡n chá»‰nh quy táº¯c thá»±c táº¿ cá»§a khoa/phÃ²ng. Khi má»™t ca bá»‹ táº¯t, app sáº½ khÃ´ng sinh ca Ä‘Ã³ cho tuáº§n má»›i."
          >
            <div className="space-y-3">
              {scheduleRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-[22px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {WEEKDAY_LABELS[rule.dayOfWeek]} Â· {SHIFT_LABELS[rule.shift]}
                    </p>
                    <p className="text-slate-500">{rule.label || "Quy táº¯c máº·c Ä‘á»‹nh"}</p>
                  </div>
                  <Pill tone={rule.active ? "emerald" : "amber"}>
                    {rule.active ? "Äang báº­t" : "Äang táº¯t"}
                  </Pill>
                </div>
              ))}
            </div>
            <form action={saveScheduleRuleAction} className="mt-5 grid gap-4 border-t border-slate-200 pt-5">
              <input type="hidden" name="returnTo" value="/template" />
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">NgÃ y trong tuáº§n</span>
                <select
                  name="dayOfWeek"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  defaultValue="1"
                  disabled={!editable}
                >
                  {[1, 2, 3, 4, 5, 6].map((dayOfWeek) => (
                    <option key={dayOfWeek} value={dayOfWeek}>
                      {WEEKDAY_LABELS[dayOfWeek]}
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
                <span className="font-medium">Tráº¡ng thÃ¡i</span>
                <select
                  name="active"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  defaultValue="true"
                  disabled={!editable}
                >
                  <option value="true">Báº­t</option>
                  <option value="false">Táº¯t</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">NhÃ£n hiá»ƒn thá»‹</span>
                <input
                  name="label"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  placeholder="VÃ­ dá»¥: Chiá»u thá»© 7 chá»‰ má»Ÿ khi tÄƒng táº£i"
                  disabled={!editable}
                />
              </label>
              <button
                type="submit"
                disabled={!editable}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                LÆ°u quy táº¯c ca lÃ m
              </button>
            </form>
          </SurfaceSection>

          <SurfaceSection
            eyebrow="Cáº­p nháº­t"
            title="Sá»­a má»™t Ã´ trong lá»‹ch ná»n"
            description="Má»—i Ã´ tÆ°Æ¡ng á»©ng má»™t tá»• há»£p ngÃ y - ca - vá»‹ trÃ­. Khi lÆ°u, app sáº½ dÃ¹ng nhÃ¢n sá»± nÃ y lÃ m máº·c Ä‘á»‹nh cho cÃ¡c tuáº§n má»›i."
          >
            <form action={saveTemplateAssignmentAction} className="grid gap-4">
              <input type="hidden" name="returnTo" value="/template" />
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">NgÃ y trong tuáº§n</span>
                <select
                  name="dayOfWeek"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  defaultValue="1"
                  disabled={!editable}
                >
                  {[1, 2, 3, 4, 5, 6].map((dayOfWeek) => (
                    <option key={dayOfWeek} value={dayOfWeek}>
                      {WEEKDAY_LABELS[dayOfWeek]}
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
                <span className="font-medium">NhÃ¢n sá»± máº·c Ä‘á»‹nh</span>
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
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Ghi chÃº</span>
                <textarea
                  name="note"
                  rows={4}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  placeholder="VÃ­ dá»¥: Æ°u tiÃªn Ä‘iá»u dÆ°á»¡ng Ä‘Ã£ quen vá»‹ trÃ­ nÃ y"
                  disabled={!editable}
                />
              </label>
              <button
                type="submit"
                disabled={!editable}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                LÆ°u lá»‹ch ná»n
              </button>
            </form>
          </SurfaceSection>
        </div>
      </div>
    </AppShell>
  );
}
