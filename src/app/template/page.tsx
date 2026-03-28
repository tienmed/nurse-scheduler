import Link from "next/link";
import { Settings2, Users } from "lucide-react";
import { saveScheduleRuleAction, saveTemplateAssignmentAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/pill";
import { ScheduleBoard } from "@/components/schedule-board";
import { SurfaceSection } from "@/components/surface-section";
import { DEFAULT_SCHEDULE_RULES, SHIFT_LABELS, WEEKDAY_LABELS } from "@/lib/constants";
import { getNextWeekStart } from "@/lib/date";
import { getAppData } from "@/lib/repository";
import { buildAssignmentsFromTemplate, getWeekBoard } from "@/lib/schedule";
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
  const activeStaff = data.staff.filter((member) => member.active);

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

  const readyForTemplate = data.positions.length > 0 && activeStaff.length > 0;

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
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SurfaceSection
          eyebrow="Xem trước"
          title="Lịch nền của tuần kế tiếp"
          description="Bảng này cho bạn thấy lịch nền sẽ hiển thị ra sao khi áp vào một tuần thật theo đúng cấu hình ca làm hiện tại."
        >
          <div className="mb-5 flex flex-wrap gap-2">
            <Pill tone="teal">Tuần xem trước bắt đầu {previewWeekStart}</Pill>
            <Pill tone="slate">{data.templateSchedule.length} dòng lịch nền</Pill>
          </div>
          <ScheduleBoard
            board={board}
            emptyTitle="Lịch nền vẫn chưa có dữ liệu để xem trước"
            emptyDescription="Hãy thêm vị trí, nhân sự và gán người mặc định cho từng vị trí để xem được bản nháp của tuần tới."
          />
        </SurfaceSection>

        <div className="space-y-6">
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
              <button
                type="submit"
                disabled={!editable}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                Lưu quy tắc ca làm
              </button>
            </form>
          </SurfaceSection>

          <SurfaceSection
            eyebrow="Cập nhật"
            title="Sửa một ô trong lịch nền"
            description="Mỗi ô tương ứng với tổ hợp ngày, ca và vị trí. Dữ liệu lưu ở đây sẽ được dùng làm mặc định khi tạo tuần mới."
          >
            {readyForTemplate ? (
              <form action={saveTemplateAssignmentAction} className="grid gap-4">
                <input type="hidden" name="returnTo" value="/template" />
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
                  <span className="font-medium">Nhân sự mặc định</span>
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
                  <span className="font-medium">Ghi chú</span>
                  <textarea
                    name="note"
                    rows={4}
                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                    placeholder="Ví dụ: ưu tiên điều dưỡng đã quen vị trí này"
                    disabled={!editable}
                  />
                </label>
                <button
                  type="submit"
                  disabled={!editable}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Lưu lịch nền
                </button>
              </form>
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
