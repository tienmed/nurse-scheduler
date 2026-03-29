import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  FileSpreadsheet,
  FolderPlus,
  Siren,
  UserRoundCheck,
} from "lucide-react";
import { addDays, parseISO, startOfToday, compareAsc } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { AuthRequiredState } from "@/components/auth-required-state";
import { ConflictList } from "@/components/conflict-list";
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
  const { authEnabled, user } = await getUserContext({ required: false });
  if (authEnabled && !user) {
    return (
      <AppShell
        currentPath="/"
        title="Tổng quan vận hành"
        description="Theo dõi nhanh tuần đang chạy, dự báo nhân sự và cảnh báo rủi ro vắng mặt."
        authEnabled={authEnabled}
        user={user}
        message={message}
        error={error}
      >
        <AuthRequiredState returnTo="/" />
      </AppShell>
    );
  }
  const data = await getAppData();
  const currentMonth = getMonthKey();
  const nextWeekStart = getNextWeekStart();

  const hasStaff = data.staff.length > 0;
  const hasPositions = data.positions.length > 0;
  const hasTemplate = data.templateSchedule.length > 0;
  const hasWeeklySchedule = data.weeklySchedule.length > 0;

  const nextWeekAssignments = getWeeklyAssignments(data.weeklySchedule, nextWeekStart);
  const nextWeekView =
    nextWeekAssignments.length > 0
      ? nextWeekAssignments
      : buildAssignmentsFromTemplate(
          data.templateSchedule,
          data.positions,
          nextWeekStart,
          data.leaveRequests,
          data.scheduleRules,
          data.positionRules,
        );

  const monthlyWorkload = calculateMonthlyWorkload(data.weeklySchedule, currentMonth);
  const monthlyLeaves = calculateMonthlyLeaves(data.leaveRequests, currentMonth);
  const pendingConflicts = nextWeekView.filter((item) => item.status === "needs-review");

  // Dữ liệu nghỉ phép 7 ngày tới
  const today = startOfToday();
  const next7Days = addDays(today, 7);

  const upcomingLeaves = data.leaveRequests
    .filter((leave) => {
      const leaveDate = parseISO(leave.date);
      return leaveDate >= today && leaveDate <= next7Days;
    })
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));

  // Báo động rủi ro nhân sự (>1 vàng, >3 đỏ)
  const groupedLeaves = new Map<string, typeof upcomingLeaves>();
  for (const leave of upcomingLeaves) {
    const key = `${leave.date}-${leave.shift}`;
    if (!groupedLeaves.has(key)) {
      groupedLeaves.set(key, []);
    }
    groupedLeaves.get(key)!.push(leave);
  }

  const criticalShortages = Array.from(groupedLeaves.entries())
    .map(([, leaves]) => ({
       date: leaves[0].date,
       shift: leaves[0].shift,
       count: leaves.length,
       leaves
    }))
    .filter(g => g.count > 1) // Chỉ lấy các nhóm có từ 2 người trở lên
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return compareAsc(parseISO(a.date), parseISO(b.date));
    }); // Nhiều người nghỉ nhất xếp trên

  const kpis = [
    {
      label: "Điều dưỡng đang hoạt động",
      value: `${data.staff.filter((item) => item.active).length}`,
      detail: "Nhân sự sẵn sàng để xếp lịch trong tuần tới.",
      icon: UserRoundCheck,
    },
    {
      label: "Ca của tuần tới",
      value: `${nextWeekView.length}`,
      detail: nextWeekAssignments.length
        ? "Tuần tới đã có dữ liệu lưu chính thức hoặc dự thảo."
        : "Đang xem bản xem trước sinh từ lịch nền.",
      icon: FileSpreadsheet,
    },
  ];

  const needsSetup = !hasStaff || !hasPositions || !hasTemplate;

  return (
    <AppShell
      currentPath="/"
      title="Tổng quan vận hành"
      description="Giám sát dự báo khủng hoảng nhân sự, kế hoạch nghỉ phép và báo cáo lưu lượng."
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
                Cảnh báo sớm. Điều phối kịp thời.
              </h3>
              <p className="max-w-2xl text-sm leading-7 text-white/72 md:text-base">
                Theo dõi sát sao lượng nhân sự vắng mặt, tự động đối chiếu lịch nền để phát hiện vùng lõm nhân sự, từ đó có giải pháp tăng ca bù đắp ngay lập tức.
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

      {/* RỦI RO LÕM NHÂN SỰ & XUNG ĐỘT */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceSection
          eyebrow="Phòng ngừa"
          title="Cảnh báo vỡ ca (7 ngày tới)"
          description="Hệ thống quyét và phát hiện lượng nhân sự nghỉ tập trung tại cùng 1 ca làm kéo theo rủi ro sập dây chuyền."
        >
          {criticalShortages.length > 0 ? (
            <div className="space-y-4">
              {criticalShortages.slice(0, 4).map((shortage, idx) => {
                const isRedAlert = shortage.count > 3;
                const Icon = isRedAlert ? Siren : AlertTriangle;
                return (
                  <div
                    key={`${shortage.date}-${shortage.shift}-${idx}`}
                    className={`rounded-[24px] border border-transparent p-5 text-sm transition-all ${
                      isRedAlert
                        ? "bg-rose-50 border-rose-200/60 shadow-[0_12px_40px_rgba(225,29,72,0.06)]"
                        : "bg-amber-50 border-amber-200/60 shadow-[0_12px_40px_rgba(217,119,6,0.04)]"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          isRedAlert ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <p
                            className={`font-bold ${
                              isRedAlert ? "text-rose-950" : "text-amber-950"
                            }`}
                          >
                            Cảnh báo: Có {shortage.count} người cùng nghỉ vào ca {LEAVE_SHIFT_LABELS[shortage.shift]} ngày {shortage.date}
                          </p>
                          <p
                            className={`mt-1 line-clamp-2 text-xs leading-5 ${
                              isRedAlert ? "text-rose-700 font-medium" : "text-amber-700"
                            }`}
                          >
                            {isRedAlert
                              ? "Mức độ Báo Động: Nguy cơ cao trống vị trí trực và chậm luân chuyển bệnh nhân. Cần lập tức bố trí người làm bù hoặc kêu gọi Tăng ca."
                              : "Mức độ Chú Ý: Vắng từ 2 người trở lên trong cùng 1 ca có thể gây áp lực lên các đội nhóm khác."}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {shortage.leaves.map((l) => {
                            const pName = data.staff.find(s => s.id === l.staffId)?.name || l.staffId;
                            return (
                              <span key={l.id} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${isRedAlert ? "bg-white text-rose-800 border-rose-100" : "bg-white text-amber-800 border-amber-100"} border shadow-sm`}>
                                {pName}
                                <span className={isRedAlert ? "text-rose-400" : "text-amber-500 font-normal"}>({LEAVE_REASON_LABELS[l.reason]})</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={UserRoundCheck}
              title="Nhân sự an toàn"
              description="Không phát hiện ca làm nào trong tuần tới có từ 2 nhân sự trở lên cùng vắng mặt."
              tone="teal"
            />
          )}
        </SurfaceSection>

        <SurfaceSection
          eyebrow="Xung đột"
          title="Trùng lịch Nghỉ & Trực tuần tới"
          description="Chỉ ra đích danh những vị trí đang được xếp cho người đang trong thời gian nghỉ phép."
        >
          {pendingConflicts.length > 0 ? (
            <ConflictList
              conflicts={pendingConflicts}
              staff={data.staff}
              positions={data.positions}
              leaveRequests={data.leaveRequests}
              workload={monthlyWorkload}
              weeklySchedule={data.weeklySchedule}
              weekStart={nextWeekStart}
            />
          ) : (
            <EmptyState
              icon={CalendarRange}
              title="Không trùng lặp lịch"
              description="Hệ thống đã rà soát bản dự thảo tuần tới và không tìm thấy mâu thuẫn giữa Phiếu nghỉ phép và Cấu hình Lịch nền."
              tone="slate"
            />
          )}
        </SurfaceSection>
      </div>

      {/* DANH SÁCH NGHỈ PHÉP SẮP TỚI & RECENT REVIEW */}
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] mt-6">
        <SurfaceSection
          eyebrow="Gần đây"
          title="Danh sách vắng mặt (7 ngày tới)"
          description="Dòng thời gian các ca đăng ký nghỉ sắp diễn ra trong tuần tới, được xếp theo thứ tự ưu tiên sát ngày nhất."
        >
          {upcomingLeaves.length > 0 ? (
            <div className="space-y-3">
              {upcomingLeaves.slice(0, 8).map((leave) => {
                const person = data.staff.find((item) => item.id === leave.staffId);
                return (
                  <div
                    key={leave.id}
                    className="flex flex-col gap-3 rounded-[22px] border border-slate-200/80 bg-slate-50/75 px-4 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 shadow-sm text-xl font-bold">
                        {leave.date.slice(8,10)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{person?.name ?? leave.staffId}</p>
                        <p className="text-sm font-medium text-slate-500">{leave.date}</p>
                      </div>
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
              icon={UserRoundCheck}
              title="Tuần tới đi làm đầy đủ"
              description="Không có bất kỳ nhân sự nào xin nghỉ trong biên độ 7 ngày tiếp theo."
              tone="teal"
            />
          )}
        </SurfaceSection>

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
                <p className="text-sm font-semibold text-slate-950">Nhân sự nghỉ nhiều trong tháng</p>
                <div className="mt-4 space-y-3">
                  {monthlyLeaves
                    .sort((a,b) => (b.phep + b.om + b.khac) - (a.phep + a.om + a.khac))
                    .slice(0, 5).map((item) => {
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
              title="Chưa có báo cáo tháng"
              description="Hệ thống sẽ tổng hợp khi có dữ liệu chính thức của tuần làm việc."
              tone="slate"
            />
          )}
        </SurfaceSection>
      </div>
    </AppShell>
  );
}
