import { addDays, format, isWithinInterval, parseISO, startOfToday } from "date-fns";
import { vi } from "date-fns/locale";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { saveLeaveAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { AuthRequiredState } from "@/components/auth-required-state";
import { EmptyState } from "@/components/empty-state";
import { LeaveCalendar } from "@/components/leave-calendar";
import { SubmitButton } from "@/components/submit-button";
import { SurfaceSection } from "@/components/surface-section";
import {
    LEAVE_REASON_LABELS,
    LEAVE_SHIFT_LABELS,
} from "@/lib/constants";
import { getAppData } from "@/lib/repository";
import { canEdit, getUserContext } from "@/lib/session";
import { cn } from "@/lib/cn";

interface LeavePageProps {
    searchParams: Promise<{
        message?: string;
        error?: string;
        confirmQuota?: string;
        cfStaffId?: string;
        cfFromDate?: string;
        cfToDate?: string;
        cfShift?: string;
        cfReason?: string;
        cfNote?: string;
    }>;
}

export default async function LeavePage({ searchParams }: LeavePageProps) {
    const { message, error, confirmQuota, cfStaffId, cfFromDate, cfToDate, cfShift, cfReason, cfNote } = await searchParams;
    const { authEnabled, user } = await getUserContext({ required: false });
    if (authEnabled && !user) {
        return (
            <AppShell
                currentPath="/leave"
                title="Nghỉ Phép"
                description="Đăng ký nghỉ phép và xem lịch nghỉ của điều dưỡng."
                authEnabled={authEnabled}
                user={user}
                message={message}
                error={error}
            >
                <AuthRequiredState returnTo="/leave" />
            </AppShell>
        );
    }

    const currentUser = user!;
    const editable = canEdit(currentUser.role);
    const data = await getAppData();

    // Viewer: tìm nhân sự theo email để chỉ đăng ký cho bản thân
    const currentStaff = data.staff.find(
        (s) => s.email.toLowerCase() === currentUser.email.toLowerCase(),
    );

    // Danh sách nhân sự khả dụng cho form
    const availableStaff = editable ? data.staff : currentStaff ? [currentStaff] : [];

    // Serialized data cho calendar
    const calendarStaff = data.staff.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
    }));

    const calendarLeaves = data.leaveRequests.map((l) => ({
        id: l.id,
        staffId: l.staffId,
        date: l.date,
        shift: l.shift,
        reason: l.reason,
        note: l.note,
    }));

    return (
        <AppShell
            currentPath="/leave"
            title="Nghỉ Phép"
            description="Đăng ký nghỉ phép và xem lịch nghỉ của điều dưỡng."
            authEnabled={authEnabled}
            user={currentUser}
            message={message}
            error={error}
        >
            {/* Vùng 1: Form đăng ký nghỉ phép */}
            <SurfaceSection
                eyebrow="Đăng ký"
                title="Nhập ca nghỉ"
                description={
                    editable
                        ? "Bạn có thể đăng ký nghỉ phép cho toàn bộ nhân sự."
                        : currentStaff
                            ? `Bạn chỉ có thể đăng ký cho: ${currentStaff.name}`
                            : "Tài khoản chưa được liên kết với nhân sự nào."
                }
            >
                {availableStaff.length > 0 ? (
                    <form action={saveLeaveAction} className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                        <input type="hidden" name="returnTo" value="/leave" />

                        <div className="grid gap-4">
                            {/* Nhân sự selector - ẩn nếu viewer chỉ có 1 staff */}
                            {editable ? (
                                <label className="space-y-2 text-sm text-slate-700">
                                    <span className="font-medium">Nhân sự</span>
                                    <select
                                        name="staffId"
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                                    >
                                        {availableStaff.map((member) => (
                                            <option key={member.id} value={member.id}>
                                                {member.name} ({member.code})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : (
                                <>
                                    <input type="hidden" name="staffId" value={currentStaff!.id} />
                                    <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                                        <span className="font-medium">Đăng ký cho:</span> {currentStaff!.name} ({currentStaff!.code})
                                    </div>
                                </>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <label className="space-y-2 text-sm text-slate-700">
                                    <span className="font-medium">Từ ngày</span>
                                    <input
                                        type="date"
                                        name="fromDate"
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                                    />
                                </label>
                                <label className="space-y-2 text-sm text-slate-700">
                                    <span className="font-medium">Đến ngày</span>
                                    <input
                                        type="date"
                                        name="toDate"
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            <label className="space-y-2 text-sm text-slate-700">
                                <span className="font-medium">Ca nghỉ</span>
                                <select
                                    name="shift"
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                                    defaultValue="full-day"
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
                                    rows={2}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
                                    placeholder="Ví dụ: nghỉ phép đã duyệt"
                                />
                            </label>
                            <SubmitButton
                                disabled={availableStaff.length === 0}
                                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                pendingText="Đang ghi nhận..."
                            >
                                Lưu ca nghỉ
                            </SubmitButton>
                        </div>
                    </form>
                ) : (
                    <EmptyState
                        icon={FilePlus2}
                        title="Không thể đăng ký"
                        description="Tài khoản của bạn chưa được liên kết với nhân sự nào trong hệ thống. Vui lòng liên hệ quản trị viên."
                        tone="amber"
                    />
                )}
            </SurfaceSection>

            {/* Vùng 2: Danh sách vắng mặt gần đây (7 ngày tới) */}
            <SurfaceSection
                eyebrow="Gần đây"
                title="Danh sách vắng mặt"
                description="Nhân sự vắng mặt trong vòng 7 ngày tới (kể từ hôm nay)."
            >
                {(() => {
                    const today = startOfToday();
                    const next7Days = addDays(today, 7);

                    // Lọc nhân sự vắng mặt trong 7 ngày tới
                    const upcomingAbsences = data.leaveRequests
                        .filter((l) => {
                            const d = parseISO(l.date);
                            return isWithinInterval(d, { start: today, end: next7Days });
                        })
                        .sort((a, b) => a.date.localeCompare(b.date));

                    if (upcomingAbsences.length === 0) {
                        return (
                            <div className="py-2 text-sm text-slate-500 italic">
                                Không có nhân sự vắng mặt trong 7 ngày tới.
                            </div>
                        );
                    }

                    // Nhóm theo ngày
                    const groupedByDate: Record<string, typeof upcomingAbsences> = {};
                    upcomingAbsences.forEach((l) => {
                        if (!groupedByDate[l.date]) groupedByDate[l.date] = [];
                        groupedByDate[l.date].push(l);
                    });

                    const reasonColors = {
                        phep: "bg-teal-500",
                        om: "bg-rose-500",
                        dihoc: "bg-amber-500",
                        khac: "bg-slate-400",
                    };

                    return (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {Object.entries(groupedByDate).map(([date, leaves]) => {
                                const d = parseISO(date);
                                const isDayToday = format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");

                                return (
                                    <div key={date} className="space-y-3">
                                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                            <span className={cn(
                                                "text-xs font-bold uppercase tracking-wider",
                                                isDayToday ? "text-teal-600" : "text-slate-400"
                                            )}>
                                                {format(d, "EEEE, dd/MM", { locale: vi })}
                                            </span>
                                            {isDayToday && <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">HÔM NAY</span>}
                                        </div>
                                        <div className="space-y-2">
                                            {leaves.map((l) => {
                                                const person = data.staff.find((s) => s.id === l.staffId);
                                                const isMorning = l.shift === "morning" || l.shift === "full-day";
                                                const isAfternoon = l.shift === "afternoon" || l.shift === "full-day";
                                                const color = reasonColors[l.reason as keyof typeof reasonColors] || reasonColors.khac;

                                                return (
                                                    <div key={l.id} className="group flex items-center justify-between gap-3 text-sm">
                                                        <div className="flex items-center gap-2 truncate">
                                                            <div className="flex h-1.5 w-10 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/50">
                                                                <div className={cn(
                                                                    "h-full w-1/2 transition-colors",
                                                                    isMorning ? color : "bg-transparent"
                                                                )} />
                                                                <div className={cn(
                                                                    "h-full w-1/2 border-l border-slate-200/30 transition-colors",
                                                                    isAfternoon ? color : "bg-transparent"
                                                                )} />
                                                            </div>
                                                            <span className="truncate font-medium text-slate-700 group-hover:text-slate-900">
                                                                {person?.name ?? l.staffId}
                                                            </span>
                                                        </div>
                                                        <span className="shrink-0 text-[10px] font-semibold text-slate-400 uppercase">
                                                            {l.shift === "full-day" ? "CN" : l.shift === "morning" ? "S" : "C"}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </SurfaceSection>

            {/* Vùng 3: Lịch nghỉ phép */}
            <SurfaceSection
                eyebrow="Lịch"
                title="Lịch nghỉ phép"
                description="Xem tổng quan nghỉ phép theo tuần hoặc tháng. Màu biểu thị ca nghỉ."
            >
                <LeaveCalendar leaveRequests={calendarLeaves} staff={calendarStaff} />
            </SurfaceSection>

            {/* Popup Xác nhận Bypass Check Quota (chỉ Admin/Coordinator) */}
            {confirmQuota === "true" && editable && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
                    <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
                        <div className="bg-amber-50 px-6 py-5 border-b border-amber-100 flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                                <FilePlus2 className="h-5 w-5" />
                            </div>
                            <h2 className="text-xl font-bold text-amber-900">Xác nhận vượt giới hạn</h2>
                        </div>
                        <div className="px-6 py-6">
                            <p className="text-[15px] text-slate-700 mb-8 leading-relaxed">
                                Khoảng thời gian bạn chọn đã có đủ <strong>2 nhân sự</strong> đăng ký nghỉ (không tính đi học).
                                <br /><br />
                                Vì bạn có đặc quyền Quản trị viên/Điều phối, bạn có muốn <strong>bỏ qua cảnh báo</strong> này và ép buộc thêm lịch nghỉ không?
                            </p>
                            <form action={saveLeaveAction} className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                                <input type="hidden" name="forceQuota" value="true" />
                                <input type="hidden" name="staffId" value={cfStaffId} />
                                <input type="hidden" name="fromDate" value={cfFromDate} />
                                <input type="hidden" name="toDate" value={cfToDate} />
                                <input type="hidden" name="shift" value={cfShift} />
                                <input type="hidden" name="reason" value={cfReason} />
                                <input type="hidden" name="note" value={cfNote} />
                                
                                <Link 
                                    href="/leave" 
                                    className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 transition"
                                >
                                    Từ chối
                                </Link>
                                <SubmitButton 
                                    className="inline-flex items-center justify-center rounded-2xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition" 
                                    pendingText="Đang ép lưu..."
                                >
                                    Đồng ý & Lưu
                                </SubmitButton>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </AppShell>
    );
}
