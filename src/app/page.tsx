import Link from "next/link";
import { ArrowRight, CalendarRange, Database, FileSpreadsheet, UserRoundCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/pill";
import { SurfaceSection } from "@/components/surface-section";
import { LEAVE_REASON_LABELS, LEAVE_SHIFT_LABELS } from "@/lib/constants";
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
  const pendingConflicts = nextWeekView.filter((item) => item.status === "needs-review");

  const kpis = [
    {
      label: "Điều dưỡng đang hoạt động",
      value: `${data.staff.filter((item) => item.active).length}`,
      detail: "Nhân sự sẵn sàng để xếp lịch trong tuần tới.",
      icon: UserRoundCheck,
    },
    {
      label: "Vị trí vận hành",
      value: `${data.positions.length}`,
      detail: "Danh mục vị trí có thể gán trong lịch nền và lịch tuần.",
      icon: CalendarRange,
    },
    {
      label: "Ca của tuần tới",
      value: `${nextWeekView.length}`,
      detail: nextWeekAssignments.length
        ? "Tuần tới đã có dữ liệu lưu chính thức hoặc dự thảo."
        : "Đang xem bản xem trước sinh từ lịch nền.",
      icon: FileSpreadsheet,
    },
    {
      label: "Nguồn dữ liệu",
      value: isSheetsConfigured() ? "Live" : "Demo",
      detail: isSheetsConfigured()
        ? "Đọc và ghi trực tiếp trên Google Sheets."
        : "Chưa nối dữ liệu thật, đang dùng dữ liệu mẫu.",
      icon: Database,
    },
  ];

  return (
    <AppShell
      currentPath="/"
      title="Tổng quan vận hành"
      description="Theo dõi nhanh tuần đang chạy, tuần kế tiếp, tình trạng nghỉ phép và khối lượng công việc trong tháng."
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
          eyebrow="Tuần kế tiếp"
          title="Lịch chờ rà soát cuối tuần"
          description="Nếu tuần sau chưa có dữ liệu chính thức, hệ thống sẽ hiển thị bản xem trước từ lịch nền để bạn kiểm tra và chỉnh lại trước khi chốt."
          action={
            <Link
              href={`/schedule?week=${nextWeekStart}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Mở lịch tuần tới
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Pill tone={nextWeekAssignments.length > 0 ? "teal" : "amber"}>
                {nextWeekAssignments.length > 0 ? "Đã có dữ liệu tuần tới" : "Đang xem trước từ lịch nền"}
              </Pill>
              <Pill tone={pendingConflicts.length > 0 ? "rose" : "emerald"}>
                {pendingConflicts.length > 0
                  ? `${pendingConflicts.length} vị trí cần rà soát nghỉ phép`
                  : "Không có xung đột nghỉ phép"}
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
                    <Pill tone="slate">{slot.entries.length} vị trí</Pill>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {slot.entries.slice(0, 4).map((entry) => (
                      <div
                        key={`${slot.date}-${slot.shift}-${entry.position.id}`}
                        className="rounded-2xl border border-white bg-white px-3 py-3 text-sm"
                      >
                        <p className="font-medium text-slate-900">{entry.position.name}</p>
                        <p className="mt-1 text-slate-500">
                          {entry.person?.name ?? "Chưa phân công"}
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
            eyebrow="Rà soát nhanh"
            title="Những điểm cần nhìn ngay"
            description="Tóm tắt các cảnh báo quan trọng để biết tuần nào cần điều chỉnh thêm trước khi chốt lịch."
          >
            <div className="space-y-4">
              <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-semibold text-rose-700">Xung đột nghỉ phép</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-rose-950">
                  {pendingConflicts.length}
                </p>
                <p className="mt-2 text-sm leading-6 text-rose-700">
                  Đây là các ca đang trùng với thông tin nghỉ đã nhập và nên đổi người trước khi submit.
                </p>
              </div>
              <div className="rounded-[24px] border border-teal-200 bg-teal-50 p-4">
                <p className="text-sm font-semibold text-teal-700">Khối lượng tháng này</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-teal-950">
                  {monthlyWorkload.reduce((sum, item) => sum + item.shifts, 0)} ca
                </p>
                <p className="mt-2 text-sm leading-6 text-teal-700">
                  Tổng số ca đã phân công trong tháng để hỗ trợ cân bằng tải giữa các điều dưỡng.
                </p>
              </div>
            </div>
          </SurfaceSection>

          <SurfaceSection
            eyebrow="Nghỉ phép"
            title="Danh sách nghỉ gần nhất"
            description="Theo dõi nhanh các ca nghỉ đã nhập để tránh trùng lịch khi sinh tuần mới từ lịch nền."
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
                      <Pill tone="amber">{LEAVE_REASON_LABELS[leave.reason]}</Pill>
                      <Pill tone="slate">{LEAVE_SHIFT_LABELS[leave.shift]}</Pill>
                    </div>
                  </div>
                );
              })}
            </div>
          </SurfaceSection>
        </div>
      </div>

      <SurfaceSection
        eyebrow="Phân tích tháng"
        title="Chỉ số tháng hiện tại"
        description="Bản tóm tắt để nhìn nhanh nhân sự có nhiều ca và các trường hợp nghỉ trong tháng trước khi vào báo cáo chi tiết."
        action={
          <Link
            href={`/reports?month=${currentMonth}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Mở báo cáo tháng
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-950">Nhân sự có nhiều ca nhất</p>
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
                        <p className="text-slate-500">{item.workDays} ngày làm</p>
                      </div>
                      <Pill tone="teal">{item.shifts} ca</Pill>
                    </div>
                  );
                })}
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-950">Nhân sự có nghỉ trong tháng</p>
            <div className="mt-4 space-y-3">
              {monthlyLeaves.slice(0, 5).map((item) => {
                const person = data.staff.find((staff) => staff.id === item.staffId);
                return (
                  <div key={item.staffId} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{person?.name ?? item.staffId}</p>
                      <p className="text-slate-500">{item.days} ngày nghỉ quy đổi</p>
                    </div>
                    <Pill tone="amber">{item.phep + item.om + item.khac} lượt</Pill>
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
