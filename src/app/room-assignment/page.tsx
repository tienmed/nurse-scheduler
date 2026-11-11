import { format, parseISO, addDays, subDays } from "date-fns";
import { PortalHeader } from "@/components/room-assignment/portal-header";
import { AccessDeniedView } from "@/components/room-assignment/access-denied-view";
import { RoomAssignmentManager } from "@/components/room-assignment/room-assignment-manager";
import { getWeekStartFromInput } from "@/lib/date";
import { fetchEffectivePositionRulesForWeek } from "@/lib/clinic-schedule-api";
import { getAppData, getEffectiveLeaveRequests } from "@/lib/repository";
import {
  buildSmartWeeklyAssignments,
  getWeeklyAssignments,
} from "@/lib/schedule";
import { canEdit, getUserContext } from "@/lib/session";

interface RoomAssignmentPageProps {
  searchParams: Promise<{
    week?: string;
    openAdjust?: string;
    message?: string;
    error?: string;
  }>;
}

// [QWEN3] Web Portal Phân Phòng Theo Ca - Hoạt động độc lập, bắt buộc đăng nhập Admin / Coordinator
export default async function RoomAssignmentPage({
  searchParams,
}: RoomAssignmentPageProps) {
  const { week, openAdjust } = await searchParams;
  const weekStart = getWeekStartFromInput(week);
  const currentWeekStart = getWeekStartFromInput();

  // 1. Bắt buộc đăng nhập: Nếu chưa đăng nhập, tự động chuyển hướng sang /sign-in kèm callbackUrl bảo toàn tham số
  const cbParams = new URLSearchParams();
  if (week) cbParams.set("week", week);
  if (openAdjust) cbParams.set("openAdjust", openAdjust);
  const cbQs = cbParams.toString();
  const currentPathWithParams = cbQs ? `/room-assignment?${cbQs}` : "/room-assignment";

  const { user } = await getUserContext({
    required: true,
    callbackUrl: currentPathWithParams,
  });

  // 2. Kiểm tra phân quyền: Chỉ tài khoản Admin hoặc Coordinator mới được truy cập
  const isAuthorized =
    user &&
    (user.role === "admin" ||
      user.role === "coordinator" ||
      user.email.toLowerCase() === "admin@nurseflow.local");

  if (!isAuthorized) {
    return <AccessDeniedView user={user} />;
  }

  // 3. Tải dữ liệu từ hệ thống (Google Sheets)
  const data = await getAppData();
  const editable = canEdit(user.role) || user.email.toLowerCase() === "admin@nurseflow.local";

  // [QWEN3] Phân quyền đặc quyền chức năng điều chỉnh lịch nâng cao trước khi xuất Excel
  const PRIVILEGED_ADJUST_EMAILS = [
    "tienmed@gmail.com",
    "nghiadn.pk@pnt.edu.vn",
    "bstien@pnt.edu.vn",
    "admin@nurseflow.local",
  ];
  const canSmartAdjust = Boolean(
    user && (
      PRIVILEGED_ADJUST_EMAILS.includes(user.email.toLowerCase()) ||
      user.role === "admin" ||
      user.role === "coordinator"
    )
  );

  // Lấy phân công tuần (ưu tiên lịch đã lưu, nếu chưa có sẽ tự động xếp theo lịch phòng khám hoạt động + kinh nghiệm + thói quen 1-2 tuần)
  const actualAssignments = getWeeklyAssignments(data.weeklySchedule, weekStart);
  const effectiveLeaves = getEffectiveLeaveRequests(data);
  const clinicSync =
    actualAssignments.length === 0
      ? await fetchEffectivePositionRulesForWeek(
          weekStart,
          data.positions,
          data.positionRules,
          { weeklySchedule: data.weeklySchedule },
        )
      : null;

  const displayedAssignments =
    actualAssignments.length > 0
      ? actualAssignments
      : buildSmartWeeklyAssignments({
          templateSchedule: data.templateSchedule,
          positions: data.positions,
          staff: data.staff,
          weeklySchedule: data.weeklySchedule,
          weekStart,
          leaveRequests: effectiveLeaves,
          scheduleRules: data.scheduleRules,
          positionRules: clinicSync?.effectivePositionRules ?? data.positionRules,
          holidays: data.holidays,
          initialStatus: "draft",
          forceOpenPositionSlots: clinicSync?.forceOpenPositionSlots,
        });

  const prevWeek = format(subDays(parseISO(weekStart), 7), "yyyy-MM-dd");
  const nextWeek = format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd");
  const isCurrentWeek = weekStart === currentWeekStart;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col">
      {/* HEADER ĐỘC LẬP CHO CỔNG PHÂN PHÒNG */}
      <PortalHeader
        user={user}
        weekStart={weekStart}
        prevWeek={prevWeek}
        nextWeek={nextWeek}
        currentWeekStart={currentWeekStart}
        isCurrentWeek={isCurrentWeek}
        hasOfficialSchedule={actualAssignments.length > 0}
      />

      {/* NỘI DUNG MA TRẬN KÉO THẢ PHÒNG THEO CA - TOÀN MÀN HÌNH */}
      <main className="flex-1 w-full max-w-[1850px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <RoomAssignmentManager
          weekStart={weekStart}
          positions={data.positions}
          staff={data.staff}
          leaveRequests={data.leaveRequests}
          scheduleRules={data.scheduleRules}
          holidays={data.holidays}
          templateSchedule={data.templateSchedule}
          positionRules={clinicSync?.effectivePositionRules ?? data.positionRules}
          initialAssignments={displayedAssignments}
          editable={editable}
          canSmartAdjust={canSmartAdjust}
          initialOpenAdjust={openAdjust === "1" && canSmartAdjust}
        />
      </main>
    </div>
  );
}
