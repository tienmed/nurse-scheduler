import { BarChart3, CalendarSearch, Download, RefreshCcwDot } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthRequiredState } from "@/components/auth-required-state";
import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/pill";
import { SurfaceSection } from "@/components/surface-section";
import { formatDate, getMonthKey, getMonthBounds, isOffDay } from "@/lib/date";
import { format, parseISO, addDays, differenceInCalendarDays } from "date-fns";
import { getAppData } from "@/lib/repository";
import {
  calculateMonthlyLeaves,
  calculateMonthlyWorkload,
  calculatePositionRotations,
  buildMonthlyTimesheet,
} from "@/lib/schedule";
import { getUserContext } from "@/lib/session";

interface ReportsPageProps {
  searchParams: Promise<{
    month?: string;
    message?: string;
    error?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { month, message, error } = await searchParams;
  const monthKey = getMonthKey(month);
  const { authEnabled, user } = await getUserContext({ required: false });
  if (authEnabled && !user) {
    return (
      <AppShell
        currentPath="/reports"
        title="Báo cáo tháng"
        description="Thống kê số ngày làm, số lượt nghỉ và phạm vi vị trí đã phụ trách để hỗ trợ cân bằng tải và xoay vòng nhân sự."
        authEnabled={authEnabled}
        user={user}
        message={message}
        error={error}
      >
        <AuthRequiredState returnTo={`/reports?month=${monthKey}`} />
      </AppShell>
    );
  }
  const data = await getAppData();

  const workload = calculateMonthlyWorkload(data.weeklySchedule, monthKey, data.holidays).sort(
    (left, right) => right.shifts - left.shifts,
  );
  const leaves = calculateMonthlyLeaves(data.leaveRequests, monthKey, data.holidays).sort(
    (left, right) => right.days - left.days,
  );
  const rotations = calculatePositionRotations(data.weeklySchedule).slice(0, 18);
  const timesheet = buildMonthlyTimesheet(
    data.weeklySchedule,
    data.leaveRequests,
    data.staff,
    data.positions,
    data.scheduleRules,
    data.positionRules,
    monthKey,
    data.holidays
  );

  const { start, end } = getMonthBounds(monthKey);
  const startDate = parseISO(start);
  const daysCount = differenceInCalendarDays(parseISO(end), startDate) + 1;
  const daysOfWeek = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const daysArray = Array.from({ length: daysCount }).map((_, i) => {
    const d = addDays(startDate, i);
    const dateStr = format(d, "yyyy-MM-dd");
    return {
      dateStr,
      label: format(d, "dd/MM"),
      isOffDay: isOffDay(dateStr, "morning", data.holidays) || isOffDay(dateStr, "afternoon", data.holidays),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      dow: daysOfWeek[d.getDay()],
    };
  });

  return (
    <AppShell
      currentPath="/reports"
      title="Báo cáo tháng"
      description="Thống kê số ngày làm, số lượt nghỉ và phạm vi vị trí đã phụ trách để hỗ trợ cân bằng tải và xoay vòng nhân sự."
      authEnabled={authEnabled}
      user={user}
      message={message}
      error={error}
    >
      <SurfaceSection
        eyebrow="Bộ lọc"
        title="Tháng báo cáo"
        description="Báo cáo này tổng hợp từ toàn bộ lịch tuần đã lưu và danh sách nghỉ phép trong tháng đang chọn."
      >
        <form action="/reports" className="flex flex-col gap-4 md:max-w-md">
          <input
            type="month"
            name="month"
            defaultValue={monthKey}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Xem báo cáo
            </button>
            <a
              href={`/api/export/monthly?month=${monthKey}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Xuất Excel
            </a>
          </div>
        </form>
      </SurfaceSection>

      <SurfaceSection
        eyebrow="Bảng chấm công"
        title="Bảng tổng hợp chi tiết tháng"
        description="Theo dõi trực quan phân ca, làm thêm và nghỉ phép của nhân sự từng ngày."
      >
        {timesheet.length > 0 ? (
          <div className="overflow-x-auto rounded-[24px] border border-slate-200/80 shadow-sm scrollbar-thin scrollbar-thumb-slate-200">
            <table className="min-w-max divide-y divide-slate-200 text-left text-sm text-slate-800">
              <thead className="bg-slate-50 sticky top-0 z-10 text-slate-600">
                <tr>
                  <th rowSpan={3} className="px-4 py-3 font-semibold border-r border-slate-200 sticky left-0 bg-slate-50 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Nhân viên
                  </th>
                  {daysArray.map((day) => (
                    <th key={`${day.dateStr}-dow`} colSpan={2} className={`px-2 py-1 text-center font-medium border-b border-b-slate-200 border-r border-r-slate-200 text-xs text-slate-500 ${day.isOffDay ? "bg-amber-50/50 text-amber-700" : "bg-slate-100/50"}`}>
                      {day.dow}
                    </th>
                  ))}
                  <th rowSpan={3} className="px-4 py-3 font-semibold text-center border-l-2 border-slate-300">
                    Σ Ngày làm
                  </th>
                  <th rowSpan={3} className="px-4 py-3 font-semibold text-center border-l border-slate-200">
                    Σ Phép
                  </th>
                  <th rowSpan={3} className="px-4 py-3 font-semibold text-center border-l border-slate-200">
                    Σ Tăng ca
                  </th>
                </tr>
                <tr>
                  {daysArray.map((day) => (
                    <th key={day.dateStr} colSpan={2} className={`px-2 py-2 text-center font-medium border-r border-slate-200 border-b border-b-slate-200 ${day.isOffDay ? "bg-slate-100" : ""}`}>
                      {day.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {daysArray.map((day) => (
                    <td key={`${day.dateStr}-sub`} colSpan={2} className={`p-0 border-r border-slate-200 ${day.isOffDay ? "bg-slate-100" : ""}`}>
                      <div className="flex text-xs text-slate-400 font-medium w-[48px]">
                        <div className="flex-1 text-center border-r border-slate-200/60 py-1">S</div>
                        <div className="flex-1 text-center py-1">C</div>
                      </div>
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {timesheet.map((row) => (
                  <tr key={row.staffId} className="hover:bg-slate-50 transition-colors h-11">
                    <td className="px-4 py-3 font-medium text-slate-900 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      {row.name}
                    </td>
                    {daysArray.map((day) => {
                      const data = row.days[day.dateStr];
                      const renderCell = (val: "✔" | "P" | "H" | "O" | "T" | null) => {
                        if (!val) return null;
                        if (val === "✔") return <span className="text-teal-600 font-bold">✔</span>;
                        if (val === "P") return <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-[11px] font-bold text-slate-600">P</span>;
                        if (val === "H") return <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-indigo-100 text-[11px] font-bold text-indigo-700">H</span>;
                        if (val === "O") return <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-rose-100 text-[11px] font-bold text-rose-700">O</span>;
                        if (val === "T") return <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-amber-100/80 text-[11px] font-bold text-amber-700">T</span>;
                        return val;
                      };
                      return (
                        <td key={day.dateStr} colSpan={2} className={`p-0 border-r border-slate-200 ${day.isOffDay ? "bg-slate-50/50" : ""}`}>
                          <div className="flex h-full w-full min-w-[48px] items-center text-center">
                            <div className="flex-1 border-r border-slate-200/50 min-h-[36px] h-full flex items-center justify-center">
                              {renderCell(data?.morning)}
                            </div>
                            <div className="flex-1 min-h-[36px] h-full flex items-center justify-center">
                              {renderCell(data?.afternoon)}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center font-bold text-slate-700 bg-slate-50/50 border-l-2 border-slate-300">
                      {row.totalWork > 0 ? row.totalWork / 2 : 0}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-slate-600 border-l border-slate-200 min-w-[80px]">
                      <div className="flex flex-col items-center justify-center text-xs space-y-0.5">
                        {row.totalLeaveP > 0 && <div>P: {row.totalLeaveP / 2}</div>}
                        {row.totalLeaveH > 0 && <div className="text-indigo-600 font-semibold">H: {row.totalLeaveH / 2}</div>}
                        {row.totalLeaveO > 0 && <div className="text-rose-600 font-semibold">O: {row.totalLeaveO / 2}</div>}
                        {(row.totalLeaveP === 0 && row.totalLeaveH === 0 && row.totalLeaveO === 0) && "0"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-amber-600 border-l border-slate-200">
                      {row.totalOvertime > 0 ? row.totalOvertime / 2 : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={RefreshCcwDot}
            title="Chưa có dữ liệu chấm công"
            description="Lịch làm việc hoặc đăng ký nghỉ phép của tháng này hiện đang trống."
            tone="slate"
          />
        )}
      </SurfaceSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceSection
          eyebrow="Khối lượng công việc"
          title="Số ngày làm theo nhân sự"
          description="Tính theo số ngày xuất hiện trên lịch và tổng số ca trong tháng đang chọn."
        >
          {workload.length > 0 ? (
            <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nhân sự</th>
                    <th className="px-4 py-3 font-medium">Ngày làm</th>
                    <th className="px-4 py-3 font-medium">Ca sáng</th>
                    <th className="px-4 py-3 font-medium">Ca chiều</th>
                    <th className="px-4 py-3 font-medium">Tăng ca</th>
                    <th className="px-4 py-3 font-medium">Vị trí</th>
                    <th className="px-4 py-3 font-medium">Tổng ca</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {workload.map((item) => {
                    const person = data.staff.find((staff) => staff.id === item.staffId);
                    return (
                      <tr key={item.staffId}>
                        <td className="px-4 py-3 font-medium text-slate-900">{person?.name ?? item.staffId}</td>
                        <td className="px-4 py-3 text-slate-500">{item.workDays}</td>
                        <td className="px-4 py-3 text-slate-500">{item.morningShifts}</td>
                        <td className="px-4 py-3 text-slate-500">{item.afternoonShifts}</td>
                        <td className="px-4 py-3">
                          <Pill tone={item.overtimeShifts > 0 ? "amber" : "slate"}>{item.overtimeShifts} ca</Pill>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{item.positionsCovered}</td>
                        <td className="px-4 py-3">
                          <Pill tone="teal">{item.shifts} ca</Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={BarChart3}
              title="Chưa có dữ liệu ngày làm trong tháng này"
              description="Khi tuần làm việc được lưu hoặc chốt chính thức, bảng này sẽ tự tổng hợp số ngày và số ca theo từng điều dưỡng."
              tone="slate"
            />
          )}
        </SurfaceSection>

        <SurfaceSection
          eyebrow="Nghỉ phép"
          title="Các ngày nghỉ theo nhân sự"
          description="Tổng hợp từ phiếu nghỉ đã nhập, quy đổi ca nghỉ nửa ngày thành 0.5 ngày."
        >
          {leaves.length > 0 ? (
            <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nhân sự</th>
                    <th className="px-4 py-3 font-medium">Ngày nghỉ</th>
                    <th className="px-4 py-3 font-medium">Phép</th>
                    <th className="px-4 py-3 font-medium">Ốm</th>
                    <th className="px-4 py-3 font-medium">Khác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {leaves.map((item) => {
                    const person = data.staff.find((staff) => staff.id === item.staffId);
                    return (
                      <tr key={item.staffId}>
                        <td className="px-4 py-3 font-medium text-slate-900">{person?.name ?? item.staffId}</td>
                        <td className="px-4 py-3 text-slate-500">{item.days}</td>
                        <td className="px-4 py-3 text-slate-500">{item.phep}</td>
                        <td className="px-4 py-3 text-slate-500">{item.om}</td>
                        <td className="px-4 py-3 text-slate-500">{item.khac}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={CalendarSearch}
              title="Tháng này chưa có phiếu nghỉ"
              description="Khi điều dưỡng xin nghỉ phép hoặc nghỉ ốm, hệ thống sẽ tổng hợp lại ở đây để bạn cân bằng lịch tốt hơn."
              tone="amber"
            />
          )}
        </SurfaceSection>
      </div>

      <SurfaceSection
        eyebrow="Xoay vòng vị trí"
        title="Theo dõi phạm vi vị trí đã phụ trách"
        description="Bảng này giúp biết mỗi nhân sự đã làm ở vị trí nào từ thời điểm nào đến thời điểm nào trong dữ liệu đã lưu."
      >
        {rotations.length > 0 ? (
          <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nhân sự</th>
                  <th className="px-4 py-3 font-medium">Vị trí</th>
                  <th className="px-4 py-3 font-medium">Từ ngày</th>
                  <th className="px-4 py-3 font-medium">Đến ngày</th>
                  <th className="px-4 py-3 font-medium">Số ca</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rotations.map((item) => {
                  const person = data.staff.find((staff) => staff.id === item.staffId);
                  const position = data.positions.find((position) => position.id === item.positionId);
                  return (
                    <tr key={`${item.staffId}-${item.positionId}`}>
                      <td className="px-4 py-3 font-medium text-slate-900">{person?.name ?? item.staffId}</td>
                      <td className="px-4 py-3 text-slate-500">{position?.name ?? item.positionId}</td>
                      <td className="px-4 py-3 text-slate-500">{item.firstDate}</td>
                      <td className="px-4 py-3 text-slate-500">{item.lastDate}</td>
                      <td className="px-4 py-3">
                        <Pill tone="teal">{item.shifts} ca</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={RefreshCcwDot}
            title="Chưa có dữ liệu xoay vòng vị trí"
            description="Sau khi lịch tuần được lưu, hệ thống sẽ theo dõi mỗi điều dưỡng đã phụ trách vị trí nào và trong khoảng thời gian nào."
            tone="teal"
          />
        )}
      </SurfaceSection>
    </AppShell>
  );
}
