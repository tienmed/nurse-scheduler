import { BarChart3, CalendarSearch, RefreshCcwDot } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthRequiredState } from "@/components/auth-required-state";
import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/pill";
import { SurfaceSection } from "@/components/surface-section";
import { getMonthKey } from "@/lib/date";
import { getAppData } from "@/lib/repository";
import {
  calculateMonthlyLeaves,
  calculateMonthlyWorkload,
  calculatePositionRotations,
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

  const workload = calculateMonthlyWorkload(data.weeklySchedule, monthKey).sort(
    (left, right) => right.shifts - left.shifts,
  );
  const leaves = calculateMonthlyLeaves(data.leaveRequests, monthKey).sort(
    (left, right) => right.days - left.days,
  );
  const rotations = calculatePositionRotations(data.weeklySchedule).slice(0, 18);

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
        <form action="/reports" className="flex flex-col gap-3 md:max-w-xs">
          <input
            type="month"
            name="month"
            defaultValue={monthKey}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Xem báo cáo
          </button>
        </form>
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
