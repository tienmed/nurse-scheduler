import Link from "next/link";
import { FilePlus2, PencilLine, ShieldCheck, Stethoscope, Users, X } from "lucide-react";
import {
  saveAccessControlAction,
  saveLeaveAction,
  savePositionAction,
  saveStaffAction,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { AuthRequiredState } from "@/components/auth-required-state";
import { EmptyState } from "@/components/empty-state";
import { MultiSelectCombobox } from "@/components/multi-select-combobox";
import { Pill } from "@/components/pill";
import { SubmitButton } from "@/components/submit-button";
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
    editStaff?: string;
  }>;
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const { message, error, editStaff } = await searchParams;
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
  const editingMember = data.staff.find((member) => member.id === editStaff);

  const positionOptions = data.positions.map((position) => ({
    value: position.id,
    label: position.name,
    meta: position.area || position.description || undefined,
  }));

  const getPositionNames = (positionIds: string[]) =>
    positionIds
      .map((positionId) => data.positions.find((position) => position.id === positionId)?.name)
      .filter(Boolean) as string[];

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
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SurfaceSection
          eyebrow="Điều dưỡng"
          title="Danh sách nhân sự"
          description="Nguồn dữ liệu để chọn khi lập lịch tuần và tổng hợp báo cáo tháng. Chỉ mở popup khi cần chỉnh để màn hình gọn và dễ rà soát hơn."
        >
          {data.staff.length > 0 ? (
            <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Điều dưỡng</th>
                    <th className="px-4 py-3 font-medium">Mã</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Vị trí việc làm</th>
                    <th className="px-4 py-3 font-medium">Tăng ca</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                    <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {data.staff.map((member) => {
                    const positionNames = getPositionNames(member.positionIds);
                    return (
                      <tr key={member.id} className="align-top">
                        <td className="px-4 py-3 font-medium text-slate-900">{member.name}</td>
                        <td className="px-4 py-3 text-slate-500">{member.code}</td>
                        <td className="px-4 py-3 text-slate-500">{member.email || "-"}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {positionNames.length > 0 ? positionNames.join(", ") : "Chưa chọn"}
                        </td>
                        <td className="px-4 py-3">
                          <Pill tone={member.prefersOvertime ? "teal" : "slate"}>
                            {member.prefersOvertime ? "Sẵn sàng" : "Không"}
                          </Pill>
                        </td>
                        <td className="px-4 py-3">
                          <Pill tone={member.active ? "emerald" : "amber"}>
                            {member.active ? "Sẵn sàng" : "Tạm nghỉ"}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/staff?editStaff=${member.id}`}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                            Sửa
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
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
                "Gắn email và phân quyền ngay từ đây để người dùng có thể đăng nhập đúng quyền.",
              ]}
              tone="teal"
            />
          )}
        </SurfaceSection>

        <SurfaceSection
          eyebrow="Thêm mới"
          title="Cập nhật điều dưỡng"
          description="Thêm điều dưỡng mới với quyền truy cập và nhiều vị trí việc làm để sẵn sàng cho luân chuyển."
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
              <span className="font-medium">Email</span>
              <input
                type="email"
                name="email"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="dieu.duong@benhvien.vn"
                disabled={!editable}
              />
            </label>

            <MultiSelectCombobox
              name="positionIds"
              label="Vị trí việc làm"
              options={positionOptions}
              placeholder="Chọn một hoặc nhiều vị trí để điều động"
              disabled={!editable || data.positions.length === 0}
              emptyText="Chưa có vị trí nào để chọn."
            />
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
            <label className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
              <input type="checkbox" name="prefersOvertime" disabled={!editable} />
              Đăng ký tăng ca (Thứ 7)
            </label>
            <SubmitButton
              disabled={!editable}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              pendingText="Đang lưu..."
            >
              Lưu điều dưỡng
            </SubmitButton>
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
            <SubmitButton
              disabled={!editable}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              pendingText="Đang lưu..."
            >
              Lưu vị trí
            </SubmitButton>
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
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Từ ngày</span>
                  <input
                    type="date"
                    name="fromDate"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                    disabled={!editable}
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Đến ngày</span>
                  <input
                    type="date"
                    name="toDate"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                    disabled={!editable}
                  />
                </label>
              </div>
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
              <SubmitButton
                disabled={!editable || data.staff.length === 0}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                pendingText="Đang ghi nhận..."
              >
                Lưu ca nghỉ
              </SubmitButton>
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



      {editingMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <Link href="/staff" className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" aria-label="Đóng cửa sổ chỉnh sửa" />
          <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_40px_100px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">Chỉnh sửa điều dưỡng</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{editingMember.name}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Cập nhật thông tin cá nhân, quyền và các vị trí có thể luân chuyển của điều dưỡng này.
                </p>
              </div>
              <Link href="/staff" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900">
                <X className="h-4 w-4" />
              </Link>
            </div>
            <div className="max-h-[calc(90vh-100px)] overflow-y-auto px-5 py-5 sm:px-6">
              <form action={saveStaffAction} className="grid gap-5">
                <input type="hidden" name="returnTo" value="/staff" />
                <input type="hidden" name="id" value={editingMember.id} />
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Họ và tên</span>
                    <input name="name" defaultValue={editingMember.name} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500" disabled={!editable} />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Mã điều dưỡng</span>
                    <input name="code" defaultValue={editingMember.code} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500" disabled={!editable} />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Email</span>
                    <input type="email" name="email" defaultValue={editingMember.email} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500" disabled={!editable} />
                  </label>

                </div>

                <MultiSelectCombobox
                  name="positionIds"
                  label="Vị trí việc làm"
                  options={positionOptions}
                  selectedValues={editingMember.positionIds}
                  placeholder="Chọn một hoặc nhiều vị trí để luân chuyển"
                  disabled={!editable || data.positions.length === 0}
                  emptyText="Chưa có vị trí nào để chọn."
                />

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Ghi chú</span>
                  <textarea name="notes" rows={4} defaultValue={editingMember.notes} className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500" disabled={!editable} />
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input type="checkbox" name="active" defaultChecked={editingMember.active} disabled={!editable} />
                  Đang hoạt động
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
                  <input type="checkbox" name="prefersOvertime" defaultChecked={editingMember.prefersOvertime} disabled={!editable} />
                  Đăng ký tăng ca (Thứ 7)
                </label>
                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                  <Link href="/staff" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                    Đóng
                  </Link>
                  <SubmitButton disabled={!editable} className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300" pendingText="Đang lưu...">
                    Lưu thay đổi
                  </SubmitButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}