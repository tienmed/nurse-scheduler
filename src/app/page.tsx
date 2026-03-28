import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  Database,
  FileSpreadsheet,
  FolderPlus,
  UserRoundCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
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

  const hasStaff = data.staff.length > 0;
  const hasPositions = data.positions.length > 0;
  const hasTemplate = data.templateSchedule.length > 0;
  const hasLeaves = data.leaveRequests.length > 0;
  const hasWeeklySchedule = data.weeklySchedule.length > 0;

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

  const needsSetup = !hasStaff || !hasPositions || !hasTemplate;

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
      <section className="overflow-hidden rounded-[34px] border border-slate-900/8 bg-[linear-gradient(135deg,rgba(2,6,23,0.98)_0%,rgba(15,23,42,0.96)_52%,rgba(13,148,136,0.82)_100%)] p-6 text-white shadow-[0_26px_80px_rgba(15,23,42,0.2)] lg:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
          <div className="space-y-5">
            <div className="space-y-3">
              <Pill tone={isSheetsConfigured() ? "teal" : "amber"}>
                {isSheetsConfigured() ? "Đang kết nối Google Sheets" : "Đang dùng dữ liệu mẫu"}
              </Pill>
              <h3 className="max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
                Điều phối lịch tuần nhanh, rõ và an toàn cho cả desktop lẫn mobile.
              </h3>
              <p className="max-w-2xl text-sm leading-7 text-white/72 md:text-base">
                Từ lịch nền, bạn có thể sinh tuần mới, rà xung đột nghỉ phép, chỉnh ca phát sinh và theo dõi báo cáo tháng mà không phải rời một màn hình làm việc.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/schedule?week=${nextWeekStart}`}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Mở lịch tuần tới
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/template"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/16 bg-white/8 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/12"
              >
                Rà soát lịch nền
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {kpis.map(({ label, value, detail, icon: Icon }) => (
              <section
                key={label}
                className="rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white/76">{label}</p>
                  <Icon className="h-5 w-5 text-teal-300" />
                </div>
                <p className="mt-4 text-4xl font-semibold tracking-tight text-white">{value}</p>
                <p className="mt-3 text-sm leading-6 text-white/64">{detail}</p>
              </section>
            ))}
          </div>
        </div>
      </section>

      {needsSetup ? (
        <EmptyState
          icon={FolderPlus}
          title="Google Sheet của bạn còn trống"
          description="App đã kết nối dữ liệu thật nhưng chưa có đủ thông tin để sinh lịch. Hãy nhập nhân sự, vị trí và lịch nền trước khi điều phối tuần."
          action={
            <div className="flex flex-wrap gap-3">
              <Link
                href="/staff"
                className="inline-flex items-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Thêm nhân sự và vị trí
              </Link>
              <Link
                href="/template"
                className="inline-flex items-center rounded-2xl border border-white/14 bg-white/8 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/12"
              >
                Thiết lập lịch nền
              </Link>
            </div>
          }
          tips={[
            "Bắt đầu với danh sách điều dưỡng đang hoạt động.",
            "Tạo vị trí làm việc như Đo sinh hiệu, ECG, Tiêm truyền.",
            "Bật các ca làm thực tế ở Lịch nền rồi gán người mặc định.",
          ]}
        />
      ) : null}

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
          {nextWeekBoard.length > 0 ? (
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
          ) : (
            <EmptyState
              icon={CalendarRange}
              title="Chưa có bản xem trước cho tuần tới"
              description="Khi lịch nền, vị trí và điều dưỡng đã sẵn sàng, tuần kế tiếp sẽ xuất hiện ở đây để bạn rà soát trước khi chốt."
              tips={[
                "Kiểm tra vị trí đang hoạt động ở trang Lịch nền.",
                "Gán người mặc định cho từng vị trí để sinh lịch nhanh hơn.",
              ]}
              tone="slate"
            />
          )}
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
            {hasLeaves ? (
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
            ) : (
              <EmptyState
                icon={FileSpreadsheet}
                title="Chưa có dữ liệu nghỉ phép"
                description="Khi nhập nghỉ phép, nghỉ ốm hoặc nghỉ khác, hệ thống sẽ dùng dữ liệu này để cảnh báo xung đột trước khi chốt lịch tuần."
                action={
                  <Link
                    href="/staff"
                    className="inline-flex items-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Nhập ca nghỉ
                  </Link>
                }
                tone="amber"
              />
            )}
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
        {hasWeeklySchedule ? (
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
        ) : (
          <EmptyState
            icon={FileSpreadsheet}
            title="Chưa có dữ liệu báo cáo tháng"
            description="Sau khi tuần làm việc được lưu hoặc chốt chính thức, hệ thống sẽ tự tổng hợp ngày làm, lượt nghỉ và phạm vi vị trí ở đây."
            tips={[
              "Sinh lịch tuần từ lịch nền trước khi xem báo cáo.",
              "Chốt lịch tuần để dữ liệu báo cáo ổn định hơn.",
            ]}
            tone="slate"
          />
        )}
      </SurfaceSection>
    </AppShell>
  );
}
