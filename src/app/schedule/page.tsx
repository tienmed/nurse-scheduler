import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Download,
  RefreshCcw,
  SendHorizontal,
  Users,
} from "lucide-react";
import {
  generateWeekAction,
  publishWeekAction,
  saveWeeklyAssignmentAction,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/pill";
import { ScheduleBoard } from "@/components/schedule-board";
import { SurfaceSection } from "@/components/surface-section";
import {
  ASSIGNMENT_STATUS_LABELS,
  SHIFT_LABELS,
  WEEKDAY_LABELS,
} from "@/lib/constants";
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
  const activeStaff = data.staff.filter((member) => member.active);
  const readyForScheduling = activeStaff.length > 0 && data.positions.length > 0 && activeRules.length > 0;
  const quickStatuses = ["draft", "adjusted", "published", "needs-review"] as const;

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
      <SurfaceSection
        eyebrow="Điều phối tuần"
        title={`Tuần bắt đầu ${formatDate(weekStart)}`}
        description="Nếu tuần này chưa có dữ liệu chính thức, hệ thống sẽ hiển thị bản xem trước sinh từ lịch nền theo quy tắc ca làm hiện tại."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/api/export/weekly?week=${weekStart}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <Download className="h-4 w-4" />
              Xuất Excel
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
                    Sinh lại từ lịch nền
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
                    Chốt lịch tuần
                  </button>
                </form>
              </>
            ) : null}
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
        </div>
        <ScheduleBoard
          board={board}
          emptyTitle="Tuần này chưa có ca nào để điều phối"
          emptyDescription="Bạn cần ít nhất một vị trí, một điều dưỡng đang hoạt động và một ca làm đang bật để tạo lịch tuần."
        />
      </SurfaceSection>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SurfaceSection
          eyebrow="Điều chỉnh đột xuất"
          title="Cập nhật một ca thật nhanh"
          description="Form này ưu tiên thao tác nhanh: chạm để chọn ngày, ca và trạng thái; chỉ giữ dropdown cho vị trí và nhân sự."
        >
          {readyForScheduling ? (
            <form action={saveWeeklyAssignmentAction} className="space-y-5">
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="weekStart" value={weekStart} />

              <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-5">
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold text-slate-900">Chọn ngày</legend>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {dayOptions.map((day, index) => {
                        const id = `date-${day.date}`;
                        return (
                          <label key={day.date} htmlFor={id} className="cursor-pointer">
                            <input
                              id={id}
                              type="radio"
                              name="date"
                              value={day.date}
                              defaultChecked={index === 0}
                              className="peer sr-only"
                              disabled={!editable}
                            />
                            <span className="flex rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition peer-checked:border-slate-950 peer-checked:bg-slate-950 peer-checked:text-white peer-disabled:cursor-not-allowed peer-disabled:bg-slate-100">
                              {WEEKDAY_LABELS[day.weekday]} · {day.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold text-slate-900">Chọn ca</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(SHIFT_LABELS).map(([value, label], index) => {
                        const id = `shift-${value}`;
                        return (
                          <label key={value} htmlFor={id} className="cursor-pointer">
                            <input
                              id={id}
                              type="radio"
                              name="shift"
                              value={value}
                              defaultChecked={index === 0}
                              className="peer sr-only"
                              disabled={!editable}
                            />
                            <span className="flex rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition peer-checked:border-slate-950 peer-checked:bg-slate-950 peer-checked:text-white peer-disabled:cursor-not-allowed peer-disabled:bg-slate-100">
                              {label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold text-slate-900">Trạng thái</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {quickStatuses.map((status, index) => {
                        const id = `status-${status}`;
                        return (
                          <label key={status} htmlFor={id} className="cursor-pointer">
                            <input
                              id={id}
                              type="radio"
                              name="status"
                              value={status}
                              defaultChecked={status === "adjusted" || (index === 0 && false)}
                              className="peer sr-only"
                              disabled={!editable}
                            />
                            <span className="flex rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition peer-checked:border-teal-600 peer-checked:bg-teal-600 peer-checked:text-white peer-disabled:cursor-not-allowed peer-disabled:bg-slate-100">
                              {ASSIGNMENT_STATUS_LABELS[status]}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>

                <div className="space-y-4 rounded-[28px] border border-slate-200/80 bg-slate-50/85 p-4">
                  <div className="grid gap-4">
                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Vị trí</span>
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
                      <span className="font-medium">Nhân sự</span>
                      <select
                        name="staffId"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                        disabled={!editable}
                      >
                        {activeStaff.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Ghi chú nhanh</span>
                      <textarea
                        name="note"
                        rows={4}
                        className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                        placeholder="Ví dụ: đổi trực do nghỉ ốm đột xuất"
                        disabled={!editable}
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      Ưu tiên dùng khi đổi người trong tuần đang vận hành.
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      Nếu ca chưa chốt, bạn có thể để trạng thái là Dự thảo.
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={!editable}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Lưu điều chỉnh
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <EmptyState
              icon={Users}
              title="Chưa đủ dữ liệu để điều chỉnh tuần"
              description="Bạn cần ít nhất một điều dưỡng đang hoạt động, một vị trí làm việc và một ca đang bật trong lịch nền để dùng form điều phối nhanh."
              action={
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/staff"
                    className="inline-flex items-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Thêm nhân sự hoặc vị trí
                  </Link>
                  <Link
                    href="/template"
                    className="inline-flex items-center rounded-2xl border border-white/14 bg-white/8 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/12"
                  >
                    Bật ca ở lịch nền
                  </Link>
                </div>
              }
              tone="teal"
            />
          )}
        </SurfaceSection>

        <SurfaceSection
          eyebrow="Khung ca làm"
          title="Quy tắc đang áp dụng"
          description="Trang Lịch nền cho phép bật hoặc tắt từng ca. Bảng này giúp bạn nhìn nhanh tuần đang sinh theo cấu hình nào."
        >
          {activeRules.length > 0 ? (
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
                  <Pill tone="slate">{data.positions.length} vị trí</Pill>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="Chưa bật ca làm nào"
              description="Bật ít nhất một ca trong trang Lịch nền để hệ thống có thể sinh lịch và cho phép điều chỉnh tuần."
              action={
                <Link
                  href="/template"
                  className="inline-flex items-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Mở lịch nền
                </Link>
              }
              tone="amber"
            />
          )}
        </SurfaceSection>
      </div>
    </AppShell>
  );
}
