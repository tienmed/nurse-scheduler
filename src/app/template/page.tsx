import Link from "next/link";
import { Settings2, Users } from "lucide-react";
import { applyPrioritizedStaffToTemplateAction, saveScheduleRuleAction, saveTemplateAssignmentAction, savePositionRuleAction, savePositionRulesBatchAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { AuthRequiredState } from "@/components/auth-required-state";
import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/pill";
import { ScheduleBoard } from "@/components/schedule-board";
import { PositionMatrix } from "@/components/position-matrix";
import { SubmitButton } from "@/components/submit-button";
import { SurfaceSection } from "@/components/surface-section";
import { TemplateAssignmentForm } from "@/components/template-assignment-form";
import { DEFAULT_SCHEDULE_RULES, SHIFT_LABELS, WEEKDAY_LABELS } from "@/lib/constants";
import { getNextWeekStart } from "@/lib/date";
import { getAppData } from "@/lib/repository";
import { buildAssignmentsFromTemplate, getDefaultDayAndShift, getWeekBoard } from "@/lib/schedule";
import { canEdit, getUserContext } from "@/lib/session";
import { addDays, format, parseISO } from "date-fns";

interface TemplatePageProps {
  searchParams: Promise<{
    message?: string;
    error?: string;
    day?: string;
    shift?: "morning" | "afternoon";
  }>;
}

export default async function TemplatePage({ searchParams }: TemplatePageProps) {
  const { message, error, day: dayParam, shift: shiftParam } = await searchParams;
  const { authEnabled, user } = await getUserContext({ required: false });
  if (authEnabled && !user) {
    return (
      <AppShell
        currentPath="/template"
        title="Lịch nền"
        description="Thiết lập khung phân công mặc định cho từng vị trí theo từng ca để làm điểm xuất phát khi lập lịch tuần mới."
        authEnabled={authEnabled}
        user={user}
        message={message}
        error={error}
      >
        <AuthRequiredState returnTo="/template" />
      </AppShell>
    );
  }
  const currentUser = user!;
  const data = await getAppData();
  const editable = canEdit(currentUser.role);
  const previewWeekStart = getNextWeekStart();
  const scheduleRules = data.scheduleRules.length > 0 ? data.scheduleRules : DEFAULT_SCHEDULE_RULES;
  const activeStaff = data.staff.filter((member) => member.active);

  const previewAssignments = buildAssignmentsFromTemplate(
    data.templateSchedule,
    data.positions,
    previewWeekStart,
    data.leaveRequests,
    scheduleRules,
    data.positionRules,
  );
  const board = getWeekBoard(
    previewAssignments,
    data.positions,
    data.staff,
    data.leaveRequests,
    previewWeekStart,
    scheduleRules,
    data.positionRules,
  );

  const activeRules = scheduleRules.filter((r) => r.active);
  const defaults = getDefaultDayAndShift(previewWeekStart);
  const selectedDay = dayParam ? Number(dayParam) : defaults.day;
  const selectedShift: "morning" | "afternoon" =
    shiftParam === "morning" || shiftParam === "afternoon" ? shiftParam : defaults.shift;

  const filteredBoard = board.filter(
    (slot) => slot.dayOfWeek === selectedDay && slot.shift === selectedShift,
  );

  const slotTabs = activeRules.map((rule) => {
    const isActive = rule.dayOfWeek === selectedDay && rule.shift === selectedShift;
    return {
      dayOfWeek: rule.dayOfWeek,
      shift: rule.shift,
      label: `${rule.shift === "morning" ? "S" : "C"} ${WEEKDAY_LABELS[rule.dayOfWeek].replace("Thứ ", "T")}`,
      href: `/template?day=${rule.dayOfWeek}&shift=${rule.shift}`,
      isActive,
    };
  });

  const readyForTemplate = data.positions.length > 0 && activeStaff.length > 0;
  const weekdayOptions = [1, 2, 3, 4, 5, 6];
  const shiftOptions = Object.entries(SHIFT_LABELS) as Array<[
    "morning" | "afternoon",
    string,
  ]>;

  const positionOptions = data.positions.map((position) => ({
    value: position.id,
    label: position.name,
    meta: position.area || position.description || undefined,
  }));

  return (
    <AppShell
      currentPath="/template"
      title="Lịch nền"
      description="Thiết lập khung phân công mặc định cho từng vị trí theo từng ca để làm điểm xuất phát khi lập lịch tuần mới."
      authEnabled={authEnabled}
      user={currentUser}
      message={message}
      error={error}
    >
      <div className="space-y-6">
        {/* Ma trận vị trí - Full Width vì nó rất rộng */}
        <SurfaceSection
          eyebrow="Tùy chỉnh vị trí"
          title="Ma trận Đóng/Mở vị trí"
          description="Tích chọn (check) để Mở vị trí, bỏ chọn để Đóng vị trí. Hệ thống sẽ không xếp lịch cho các vị trí bị đóng."
        >
          <PositionMatrix 
            positions={data.positions}
            scheduleRules={scheduleRules}
            positionRules={data.positionRules}
            editable={editable}
          />
        </SurfaceSection>

        {/* Xem trước - Full Width theo yêu cầu người dùng */}
        <SurfaceSection
          eyebrow="Xem trước"
          title="Lịch nền của tuần kế tiếp"
          description="Bảng này cho bạn thấy lịch nền sẽ hiển thị ra sao khi áp vào một tuần thật theo đúng cấu hình ca làm hiện tại."
          action={
            editable ? (
              <form action={applyPrioritizedStaffToTemplateAction}>
                <input type="hidden" name="returnTo" value={`/template?day=${selectedDay}&shift=${selectedShift}`} />
                <SubmitButton
                  variant="outline"
                  pendingText="Đang áp dụng..."
                >
                  <Users className="h-4 w-4" />
                  Áp dụng nhân sự ưu tiên
                </SubmitButton>
              </form>
            ) : null
          }
        >
          <div className="mb-5 flex flex-wrap gap-2">
            <Pill tone="teal">Tuần xem trước bắt đầu {previewWeekStart}</Pill>
            <Pill tone="slate">{data.templateSchedule.length} dòng lịch nền</Pill>
          </div>

          <div className="mb-5 -mx-1 flex flex-wrap gap-1.5">
            {slotTabs.map((tab) => (
              <Link
                key={`${tab.dayOfWeek}-${tab.shift}`}
                href={tab.href}
                className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  tab.isActive
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
            emptyTitle="Lịch nền vẫn chưa có dữ liệu để xem trước"
            emptyDescription="Hãy thêm vị trí, nhân sự và gán người mặc định cho từng vị trí để xem được bản nháp của tuần tới."
            editable={editable}
            mode="template"
            staff={activeStaff}
            leaveRequests={data.leaveRequests}
            workload={[]}
            weeklySchedule={[]}
            weekStart={previewWeekStart}
          />
        </SurfaceSection>

        <div className="grid gap-6 xl:grid-cols-2">
          {/* Quy tắc vận hành */}
          <SurfaceSection
            eyebrow="Quy tắc vận hành"
            title="Bật hoặc tắt ca làm"
            description="Dùng phần này để mô tả thực tế của khoa hoặc phòng. Khi một ca bị tắt, hệ thống sẽ không sinh ca đó trong tuần mới."
          >
            <div className="space-y-3">
              {scheduleRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-[22px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {WEEKDAY_LABELS[rule.dayOfWeek]} · {SHIFT_LABELS[rule.shift]}
                    </p>
                    <p className="text-slate-500">{rule.label || "Quy tắc mặc định"}</p>
                  </div>
                  <Pill tone={rule.active ? "emerald" : "amber"}>
                    {rule.active ? "Đang bật" : "Đang tắt"}
                  </Pill>
                </div>
              ))}
            </div>
            <form action={saveScheduleRuleAction} className="mt-5 grid gap-4 border-t border-slate-200 pt-5">
              <input type="hidden" name="returnTo" value="/template" />
              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Ngày trong tuần</span>
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
              </div>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Trạng thái</span>
                <select
                  name="active"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  defaultValue="true"
                  disabled={!editable}
                >
                  <option value="true">Bật</option>
                  <option value="false">Tắt</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Nhãn hiển thị</span>
                <input
                  name="label"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  placeholder="Ví dụ: chiều thứ 7 chỉ mở khi tăng tải"
                  disabled={!editable}
                />
              </label>
              <SubmitButton
                variant="outline"
                disabled={!editable}
              >
                Lưu quy tắc ca làm
              </SubmitButton>
            </form>
          </SurfaceSection>

          {/* Cập nhật lịch nền */}
          <SurfaceSection
            eyebrow="Cập nhật"
            title="Gán người mặc định"
            description="Số ca = Ngày × Buổi. Mỗi ca sẽ gán nhân sự mặc định vào tất cả vị trí đã chọn."
          >
            {readyForTemplate ? (
              <TemplateAssignmentForm
                action={saveTemplateAssignmentAction}
                weekdayOptions={weekdayOptions}
                shiftOptions={shiftOptions}
                positionOptions={positionOptions}
                activeStaff={activeStaff.map((m) => ({ id: m.id, name: m.name }))}
                templateSchedule={data.templateSchedule}
                editable={editable}
              />
            ) : (
              <EmptyState
                icon={Users}
                title="Chưa đủ dữ liệu để gán lịch nền"
                description="Bạn cần ít nhất một vị trí làm việc và một điều dưỡng đang hoạt động trước khi thiết lập phân công mặc định."
                action={
                  <Link
                    href="/staff"
                    className="inline-flex items-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Mở trang nhân sự
                  </Link>
                }
                tips={[
                  "Thêm vị trí như Đo sinh hiệu, ECG, Tiêm truyền.",
                  "Chỉ những điều dưỡng đang hoạt động mới hiện trong danh sách gán.",
                ]}
                tone="teal"
              />
            )}
          </SurfaceSection>
        </div>
      </div>

      {!readyForTemplate ? (
        <EmptyState
          icon={Settings2}
          title="Lịch nền sẽ mạnh nhất khi có đủ dữ liệu gốc"
          description="Sau khi có nhân sự và vị trí, bạn chỉ cần chỉnh một lần lịch nền rồi dùng nó để sinh các tuần sau, giúp điều phối nhanh hơn nhiều."
          action={
            <Link
              href="/staff"
              className="inline-flex items-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Thêm dữ liệu gốc
            </Link>
          }
          tips={[
            "Nhập nhân sự ở trang Nhân sự.",
            "Bật các ca thực tế rồi mới gán người mặc định.",
            "Preview tuần tới sẽ tự đầy lên khi dữ liệu đủ.",
          ]}
        />
      ) : null}
    </AppShell>
  );
}
