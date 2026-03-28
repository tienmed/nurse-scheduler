import { FilePlus2, ShieldCheck, Stethoscope, Users } from "lucide-react";
import { saveLeaveAction, savePositionAction, saveStaffAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { AuthRequiredState } from "@/components/auth-required-state";
import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/pill";
import { SurfaceSection } from "@/components/surface-section";
import {
  LEAVE_REASON_LABELS,
  LEAVE_SHIFT_LABELS,
  ROLE_LABELS,
} from "@/lib/constants";
import { getAppData } from "@/lib/repository";
import { canEdit, getUserContext } from "@/lib/session";

interface StaffPageProps {
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const { message, error } = await searchParams;
  const { authEnabled, user } = await getUserContext({ required: false });
  if (authEnabled && !user) {
    return (
      <AppShell
        currentPath="/staff"
        title="Nhân sự và nghỉ phép"
        description="Quản lý danh sách điều dưỡng, vị trí làm việc, thông tin nghỉ phép và danh sách email được phép đăng nhập."
        authEnabled={authEnabled}
        user={user}
        message={message}
        error={error}
      >
        <AuthRequiredState returnTo="/staff" />
      </AppShell>
    );
  }
  const currentUser = user!;
  const editable = canEdit(currentUser.role);
  const data = await getAppData();

  return (
    <AppShell
      currentPath="/staff"
      title="Nhân sự và nghỉ phép"
      description="Quản lý danh sách điều dưỡng, vị trí làm việc, thông tin nghỉ phép và danh sách email được phép đăng nhập."
      authEnabled={authEnabled}
      user={currentUser}
      message={message}
      error={error}
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SurfaceSection
          eyebrow="Điều dưỡng"
          title="Danh sách nhân sự"
          description="Nguồn dữ liệu để chọn khi lập lịch tuần và tổng hợp báo cáo tháng."
        >
          {data.staff.length > 0 ? (
            <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Điều dưỡng</th>
                    <th className="px-4 py-3 font-medium">Mã</th>
                    <th className="px-4 py-3 font-medium">Nhóm</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {data.staff.map((member) => (
                    <tr key={member.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{member.name}</td>
                      <td className="px-4 py-3 text-slate-500">{member.code}</td>
                      <td className="px-4 py-3 text-slate-500">{member.team}</td>
                      <td className="px-4 py-3">
                        <Pill tone={member.active ? "emerald" : "amber"}>
                          {member.active ? "Sẵn sàng" : "Tạm nghỉ"}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="Chưa có điều dưỡng nào trong Google Sheet"
              description="Thêm danh sách điều dưỡng trước để có thể gán người ở lịch nền, sinh lịch tuần và theo dõi báo cáo."
              tips={[
                "Nên nhập mã điều dưỡng để dễ lọc khi xuất Excel.",
                "Nhóm hoặc khoa giúp bạn kiểm tra phân bổ nhân lực theo đơn vị.",
              ]}
              tone="teal"
            />
          )}
        </SurfaceSection>

        <SurfaceSection
          eyebrow="Thêm mới"
          title="Cập nhật điều dưỡng"
          description="Thêm hoặc chỉnh thông tin nhân sự để dùng ngay cho lịch nền và lịch tuần."
        >
          <form action={saveStaffAction} className="grid gap-4">
            <input type="hidden" name="returnTo" value="/staff" />
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Họ và tên</span>
              <input
                name="name"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="Nguyễn Thị A"
                disabled={!editable}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Mã điều dưỡng</span>
              <input
                name="code"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="DD09"
                disabled={!editable}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Nhóm hoặc khoa</span>
              <input
                name="team"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="Khám tổng quát"
                disabled={!editable}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Ghi chú</span>
              <textarea
                name="notes"
                rows={3}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="Ví dụ: ưu tiên ca sáng"
                disabled={!editable}
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" name="active" defaultChecked disabled={!editable} />
              Đang hoạt động
            </label>
            <button
              type="submit"
              disabled={!editable}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Lưu điều dưỡng
            </button>
          </form>
        </SurfaceSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SurfaceSection
          eyebrow="Vị trí"
          title="Danh mục vị trí làm việc"
          description="Mỗi vị trí sẽ xuất hiện trong lịch nền, lịch tuần và báo cáo xoay vòng vị trí."
        >
          {data.positions.length > 0 ? (
            <div className="space-y-3">
              {data.positions.map((position) => (
                <div
                  key={position.id}
                  className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{position.name}</p>
                      <p className="text-sm text-slate-500">{position.area}</p>
                    </div>
                    <Pill tone="teal">{position.description ? "Đã có mô tả" : "Chưa ghi chú"}</Pill>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Stethoscope}
              title="Chưa có vị trí làm việc"
              description="Bạn nên thêm đủ vị trí vận hành như Đo sinh hiệu, ECG, Tiêm truyền để lịch nền có thể gán người đúng chỗ."
              tone="amber"
            />
          )}
          <form action={savePositionAction} className="mt-5 grid gap-4 border-t border-slate-200 pt-5">
            <input type="hidden" name="returnTo" value="/staff" />
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Tên vị trí</span>
              <input
                name="name"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="Phòng ECG"
                disabled={!editable}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Khu vực</span>
              <input
                name="area"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="Cận lâm sàng"
                disabled={!editable}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Mô tả</span>
              <textarea
                name="description"
                rows={3}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="Mô tả ngắn về phạm vi vị trí"
                disabled={!editable}
              />
            </label>
            <button
              type="submit"
              disabled={!editable}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              Lưu vị trí
            </button>
          </form>
        </SurfaceSection>

        <SurfaceSection
          eyebrow="Nghỉ phép"
          title="Nhập ca nghỉ"
          description="Thông tin nghỉ phép hoặc nghỉ ốm sẽ được dùng để cảnh báo khi sinh lịch tuần mới từ lịch nền."
        >
          <div className="grid gap-5 lg:grid-cols-[0.96fr_1.04fr]">
            <form action={saveLeaveAction} className="grid gap-4">
              <input type="hidden" name="returnTo" value="/staff" />
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Nhân sự</span>
                <select
                  name="staffId"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  disabled={!editable || data.staff.length === 0}
                >
                  {data.staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Ngày nghỉ</span>
                <input
                  type="date"
                  name="date"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  disabled={!editable}
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Ca nghỉ</span>
                <select
                  name="shift"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  defaultValue="full-day"
                  disabled={!editable}
                >
                  {Object.entries(LEAVE_SHIFT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Lý do</span>
                <select
                  name="reason"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  defaultValue="phep"
                  disabled={!editable}
                >
                  {Object.entries(LEAVE_REASON_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Ghi chú</span>
                <textarea
                  name="note"
                  rows={3}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                  placeholder="Ví dụ: nghỉ phép đã duyệt"
                  disabled={!editable}
                />
              </label>
              <button
                type="submit"
                disabled={!editable || data.staff.length === 0}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Lưu ca nghỉ
              </button>
            </form>

            {data.leaveRequests.length > 0 ? (
              <div className="space-y-3">
                {data.leaveRequests.map((leave) => {
                  const person = data.staff.find((member) => member.id === leave.staffId);
                  return (
                    <div
                      key={leave.id}
                      className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{person?.name ?? leave.staffId}</p>
                          <p className="text-slate-500">{leave.date}</p>
                        </div>
                        <Pill tone="amber">{LEAVE_REASON_LABELS[leave.reason]}</Pill>
                      </div>
                      <p className="mt-2 text-slate-500">{LEAVE_SHIFT_LABELS[leave.shift]}</p>
                      {leave.note ? <p className="mt-2 text-slate-500">{leave.note}</p> : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={FilePlus2}
                title="Chưa có phiếu nghỉ nào"
                description="Khi có điều dưỡng xin nghỉ phép hoặc nghỉ ốm, hãy nhập vào đây để hệ thống tự cảnh báo xung đột khi sinh lịch tuần."
                tone="slate"
              />
            )}
          </div>
        </SurfaceSection>
      </div>

      <SurfaceSection
        eyebrow="Phân quyền"
        title="Danh sách email được quyền truy cập"
        description="Quyền được đọc từ tab `access_control` trong Google Sheets hoặc từ allowlist môi trường."
      >
        {data.accessControl.length > 0 ? (
          <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Hiển thị</th>
                  <th className="px-4 py-3 font-medium">Quyền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {data.accessControl.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{entry.email}</td>
                    <td className="px-4 py-3 text-slate-500">{entry.displayName ?? "-"}</td>
                    <td className="px-4 py-3">
                      <Pill tone="teal">{ROLE_LABELS[entry.role]}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="Chưa có email phân quyền trong Sheet"
            description="Nếu đang bật allowlist trong môi trường thì bạn vẫn có thể đăng nhập. Khi cần quản lý linh hoạt hơn, hãy thêm email vào tab access_control."
            tone="amber"
          />
        )}
      </SurfaceSection>
    </AppShell>
  );
}
