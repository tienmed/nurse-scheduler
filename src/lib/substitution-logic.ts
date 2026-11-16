import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { getWeekStart } from "./date";
import { suggestStaffForSlot } from "./schedule";
import { SHIFT_LABELS } from "./constants";
import type {
  StaffMember,
  Position,
  WeeklyAssignment,
  TemplateAssignment,
  LeaveRecord,
  LeaveShift,
  ShiftType,
} from "./types";

export interface SubstituteCandidate {
  staffId: string;
  staffName: string;
  staffCode: string;
  reasons: string[];
  score: number;
  isFree: boolean;
}

export interface VacatedPositionItem {
  date: string;
  dateLabel: string;
  shift: ShiftType;
  shiftLabel: string;
  positionId: string;
  positionName: string;
  vacatedStaffId: string;
  vacatedStaffName: string;
  vacatedStaffCode: string;
  candidates: SubstituteCandidate[];
}

export interface LeaveSubstitutionPlan {
  hasIntraWeekSlots: boolean;
  weekStart: string;
  items: VacatedPositionItem[];
}

/**
 * Kiểm tra xem ngày có thuộc tuần hiện tại (hoặc tuần tham chiếu) hay không.
 * Tuần làm việc từ Thứ 2 đến Thứ 7.
 */
export function isIntraWeekDate(dateStr: string, referenceDate: Date = new Date()): boolean {
  try {
    const slotWeekStart = getWeekStart(parseISO(dateStr));
    const refWeekStart = getWeekStart(referenceDate);
    return slotWeekStart === refWeekStart;
  } catch {
    return false;
  }
}

/**
 * Tạo kế hoạch gợi ý nhân sự thay thế cho các vị trí bị khuyết do nghỉ phép trong tuần.
 * - Tự động đối chiếu với weekly_schedule (lịch tuần đã chốt/dự thảo) hoặc template_schedule (lịch nền)
 * - Tận dụng suggestStaffForSlot để xếp hạng ứng viên theo chuyên môn, thứ tự ưu tiên phòng và tính sẵn sàng
 */
export function generateLeaveSubstitutionPlan(params: {
  slots: { date: string; shift: LeaveShift }[];
  targetStaff: StaffMember;
  staff: StaffMember[];
  positions: Position[];
  weeklySchedule: WeeklyAssignment[];
  templateSchedule?: TemplateAssignment[];
  leaveRequests: LeaveRecord[];
  referenceDate?: Date;
}): LeaveSubstitutionPlan {
  const {
    slots,
    targetStaff,
    staff,
    positions,
    weeklySchedule,
    templateSchedule = [],
    leaveRequests,
    referenceDate = new Date(),
  } = params;

  const currentWeekStart = getWeekStart(referenceDate);
  const posMap = new Map(positions.map((p) => [p.id, p]));

  const items: VacatedPositionItem[] = [];
  let hasIntraWeekSlots = false;

  for (const slot of slots) {
    // Kiểm tra xem slot có rơi vào tuần hiện tại hoặc tuần đã có lịch phân công
    const isCurrentWeek = isIntraWeekDate(slot.date, referenceDate);
    const hasWeeklyScheduleForDate = weeklySchedule.some((a) => a.date === slot.date);

    if (!isCurrentWeek && !hasWeeklyScheduleForDate) {
      continue;
    }

    hasIntraWeekSlots = true;

    const shiftsToInspect: ShiftType[] =
      slot.shift === "full-day" ? ["morning", "afternoon"] : [slot.shift];

    for (const shift of shiftsToInspect) {
      // 1. Tìm vị trí nhân sự đang đảm nhiệm trên weeklySchedule
      let assignedPositions = weeklySchedule.filter(
        (a) => a.date === slot.date && a.shift === shift && a.staffId === targetStaff.id,
      );

      // 2. Nếu trên weeklySchedule chưa có thì tra cứu trên templateSchedule (lịch nền)
      if (assignedPositions.length === 0 && templateSchedule.length > 0) {
        try {
          const dow = parseISO(slot.date).getDay();
          const templateMatches = templateSchedule.filter(
            (t) => t.dayOfWeek === dow && t.shift === shift && t.staffId === targetStaff.id,
          );
          if (templateMatches.length > 0) {
            assignedPositions = templateMatches.map((t) => ({
              id: `tmpl-${t.id}`,
              weekStart: currentWeekStart,
              date: slot.date,
              shift: t.shift,
              positionId: t.positionId,
              staffId: t.staffId,
              source: "template" as const,
              status: "draft" as const,
            }));
          }
        } catch {
          // Bỏ qua lỗi parse
        }
      }

      // Khử trùng lặp theo positionId
      const uniquePosIds = Array.from(new Set(assignedPositions.map((a) => a.positionId)));

      for (const posId of uniquePosIds) {
        const targetPos = posMap.get(posId);
        const positionName = targetPos?.name || posId;

        // Tính toán gợi ý nhân sự thay thế
        const rawSuggestions = suggestStaffForSlot(
          staff,
          positions,
          slot.date,
          shift,
          posId,
          leaveRequests,
          [],
          weeklySchedule,
        );

        // Loại trừ chính nhân sự đang xin nghỉ phép
        const validSuggestions = rawSuggestions.filter((s) => s.staff.id !== targetStaff.id);

        const topCandidates: SubstituteCandidate[] = validSuggestions.slice(0, 3).map((s) => ({
          staffId: s.staff.id,
          staffName: s.staff.name,
          staffCode: s.staff.code,
          reasons: s.reasons,
          score: s.score,
          isFree: s.reasons.includes("Rảnh chưa có ca"),
        }));

        let dateLabel = slot.date;
        try {
          dateLabel = format(parseISO(slot.date), "dd/MM (EEEE)", { locale: vi });
        } catch {}

        items.push({
          date: slot.date,
          dateLabel,
          shift,
          shiftLabel: SHIFT_LABELS[shift] || shift,
          positionId: posId,
          positionName,
          vacatedStaffId: targetStaff.id,
          vacatedStaffName: targetStaff.name,
          vacatedStaffCode: targetStaff.code,
          candidates: topCandidates,
        });
      }
    }
  }

  return {
    hasIntraWeekSlots,
    weekStart: currentWeekStart,
    items,
  };
}

/**
 * Tạo khối HTML hiển thị kế hoạch gợi ý thay thế vị trí cho Email gửi ĐD Nghĩa và Quản lý Tiến.
 * Thiết kế giao diện y tế chuẩn (Zero Purple, dùng tone Teal/Slate), tương thích 100% Mobile & Desktop.
 */
export function renderSubstitutionPlanHtml(plan: LeaveSubstitutionPlan, baseUrl: string): string {
  if (!plan.hasIntraWeekSlots || plan.items.length === 0) {
    return "";
  }

  const adjustUrl = `${baseUrl}/room-assignment?week=${plan.weekStart}&openAdjust=1`;

  const itemsHtml = plan.items
    .map((item) => {
      const shiftBg = item.shift === "morning" ? "#f59e0b" : "#2563eb";
      const shiftCode = item.shift === "morning" ? "S" : "C";

      const candidatesRows = item.candidates
        .map((cand, idx) => {
          const rank = idx + 1;
          const statusBadge = cand.isFree
            ? `<span style="background-color:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;border:1px solid #bbf7d0;">Rảnh ca</span>`
            : `<span style="background-color:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;border:1px solid #fde68a;">Kiêm nhiệm</span>`;

          const reasonsSummary = cand.reasons.slice(0, 2).join(" · ");

          return `
            <tr style="border-bottom:1px solid #e2e8f0;${idx % 2 === 1 ? "background-color:#f8fafc;" : ""}">
              <td style="padding:6px 8px;font-weight:bold;color:#0f766e;font-size:11px;text-align:center;width:24px;">
                #${rank}
              </td>
              <td style="padding:6px 8px;font-weight:bold;color:#1e293b;font-size:12px;">
                ${cand.staffName} <span style="font-size:10px;color:#64748b;font-weight:normal;">(${cand.staffCode})</span>
              </td>
              <td style="padding:6px 8px;text-align:center;white-space:nowrap;width:70px;">
                ${statusBadge}
              </td>
              <td style="padding:6px 8px;font-size:11px;color:#475569;">
                ${reasonsSummary || "Sẵn sàng hỗ trợ"}
              </td>
            </tr>
          `;
        })
        .join("");

      return `
        <div style="margin-bottom:12px;border:1px solid #ccfbf1;border-radius:8px;overflow:hidden;background-color:#ffffff;">
          <!-- Tiêu đề vị trí bị khuyết -->
          <div style="background-color:#f0fdfa;padding:8px 10px;border-bottom:1px solid #ccfbf1;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span style="background-color:${shiftBg};color:#ffffff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:900;margin-right:6px;">
                ${shiftCode} · ${item.shiftLabel}
              </span>
              <strong style="font-size:12px;color:#0f172a;">${item.dateLabel}</strong>
            </div>
            <div style="font-size:11px;color:#0f766e;font-weight:bold;">
              🏥 ${item.positionName}
            </div>
          </div>

          <!-- Bảng ứng viên thay thế -->
          <table role="presentation" style="width:100%;border-collapse:collapse;font-size:11px;text-align:left;">
            <thead>
              <tr style="background-color:#f8fafc;color:#64748b;border-bottom:1px solid #e2e8f0;font-size:10px;text-transform:uppercase;">
                <th style="padding:5px 8px;text-align:center;">#</th>
                <th style="padding:5px 8px;">Nhân sự gợi ý</th>
                <th style="padding:5px 8px;text-align:center;">Trạng thái</th>
                <th style="padding:5px 8px;">Lý do / Kinh nghiệm</th>
              </tr>
            </thead>
            <tbody>
              ${candidatesRows || `<tr><td colspan="4" style="padding:8px;text-align:center;color:#94a3b8;">Chưa tìm thấy ứng viên phù hợp trong ca</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    })
    .join("");

  return `
    <div style="margin-top:20px;border:1px solid #0d9488;border-radius:12px;overflow:hidden;background:#ffffff;box-shadow:0 2px 8px rgba(13,148,136,0.08);">
      <!-- Header khối Kế hoạch điều chỉnh -->
      <table role="presentation" style="width:100%;border-collapse:collapse;background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%);color:#ffffff;">
        <tr>
          <td style="padding:10px 14px;text-align:left;">
            <div style="font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;opacity:0.9;">
              Dành riêng cho ĐD Nghĩa & Quản lý
            </div>
            <div style="font-size:14px;font-weight:bold;margin-top:2px;">
              🔄 Kế hoạch gợi ý thay thế vị trí phép đột xuất (Tuần này)
            </div>
          </td>
        </tr>
      </table>

      <!-- Nội dung chi tiết các vị trí bị khuyết -->
      <div style="padding:12px 14px;background-color:#fafafa;">
        <p style="margin:0 0 10px 0;font-size:12px;color:#475569;line-height:1.5;">
          Đơn nghỉ phép này phát sinh các vị trí đang được phân công trong tuần. Dưới đây là danh sách đề xuất nhân sự thay thế phù hợp dựa trên thói quen, chuyên môn và tình trạng rảnh ca để tham khảo:
        </p>

        ${itemsHtml}

        <!-- Nút mở phân phòng để điều chỉnh -->
        <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:10px;">
          <tr>
            <td align="center">
              <a href="${adjustUrl}" target="_blank" style="display:block;width:100%;max-width:360px;box-sizing:border-box;background-color:#0f766e;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:12px;font-weight:bold;text-align:center;box-shadow:0 2px 6px rgba(15,118,110,0.2);">
                ⚡ MỞ BẢNG PHÂN PHÒNG ĐỂ ĐIỀU CHỈNH LỊCH →
              </a>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;
}
