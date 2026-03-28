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
import { ASSIGNMENT_STATUS_LABELS, SHIFT_LABELS, WEEKDAY_LABELS } from "@/lib/constants";
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
        <ScheduleBoard board={board} />
      </SurfaceSection>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SurfaceSection
          eyebrow="Điều chỉnh đột xuất"
          title="Cập nhật một ca cụ thể"
          description="Dùng khi cần đổi người cho tuần đang vận hành hoặc tuần đã submit. Dữ liệu sẽ ghi đè lên vị trí, ngày và ca tương ứng."
        >
          <form action={saveWeeklyAssignmentAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="weekStart" value={weekStart} />
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Ngày làm</span>
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
                {data.staff.filter((member) => member.active).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
              <span className="font-medium">Trạng thái</span>
              <select
                name="status"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                defaultValue="adjusted"
                disabled={!editable}
              >
                {Object.entries(ASSIGNMENT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
              <span className="font-medium">Ghi chú</span>
              <textarea
                name="note"
                rows={4}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="Ví dụ: đổi trực do nghỉ ốm đột xuất"
                disabled={!editable}
              />
            </label>
            <button
              type="submit"
              disabled={!editable}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Lưu điều chỉnh
            </button>
          </form>
        </SurfaceSection>

        <SurfaceSection
          eyebrow="Khung ca làm"
          title="Quy tắc đang áp dụng"
          description="Trang Lịch nền cho phép bật hoặc tắt từng ca. Bảng này giúp bạn nhìn nhanh tuần đang sinh theo cấu hình nào."
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
                <Pill tone="slate">{data.positions.length} vị trí</Pill>
              </div>
            ))}
          </div>
        </SurfaceSection>
      </div>
    </AppShell>
  );
}
