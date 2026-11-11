import { addDays, format, parseISO } from "date-fns";
import { SATURDAY_OT_POSITION_ID, WEEKDAY_LABELS } from "@/lib/constants";
import { isExcludedSchedulePosition } from "@/lib/schedule";
import type {
  Holiday,
  LeaveRecord,
  Position,
  PositionRule,
  ScheduleRule,
  StaffMember,
  WeeklyAssignment,
} from "@/lib/types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getEmailStaffShortName(fullName: string): string {
  if (!fullName) return "";
  const trimmed = fullName.trim();
  if (trimmed.toLowerCase().includes("lyna")) return "Lyna";

  const compoundNames = [
    "Phúc Anh",
    "Bích Thảo",
    "Bính Thảo",
    "Kim Hoa",
    "Kim Liên",
    "Kim Điệp",
    "Tú Trang",
    "Mỹ Nhiên",
    "Ngọc Hạnh",
    "Nhân Nghĩa",
    "Thiên Trang",
    "Thúy Hằng",
  ];
  for (const comp of compoundNames) {
    if (trimmed.endsWith(comp)) return comp;
  }
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

function getEmailLeaveReasonShort(reason?: string, note?: string): string {
  const r = (reason || "").toLowerCase().trim();
  if (r === "om" || r.includes("ốm")) return "ốm";
  if (r === "dihoc" || r.includes("học")) return "học";
  if (r === "phep" || r.includes("phép")) return "phép";
  if (note && note.trim()) return note.trim().slice(0, 10);
  return "khác";
}

function getEmailAreaStyle(pos: Position): { bg: string; order: number } {
  const area = (pos.area || "").toLowerCase();
  const name = pos.name.toLowerCase();

  if (area.includes("tầng 1")) return { bg: "#fef9c3", order: 1 };
  if (area.includes("trệt") || area.includes("tầng trệt")) return { bg: "#dbeafe", order: 2 };
  if (area.includes("tầng 2") || area.includes("chuyên gia")) return { bg: "#ffedd5", order: 3 };
  if (area.includes("sảnh") || area.includes("tiếp nhận")) return { bg: "#fce7f3", order: 4 };
  if (
    area.includes("ksk") ||
    area.includes("khám sức khỏe") ||
    area.includes("khnv") ||
    area.includes("thanh trùng")
  ) {
    return { bg: "#dcfce7", order: 5 };
  }

  if (
    name.includes("da liễu") ||
    name.includes("chăm sóc da") ||
    name.includes("csd") ||
    name.includes("mắt") ||
    name.includes("tmh") ||
    name.includes("tâm lý") ||
    name.includes("thần kinh") ||
    name.includes("tim mạch") ||
    name.includes("yhct")
  ) {
    return { bg: "#fef9c3", order: 1 };
  }
  if (name.includes("chuyên gia") || name.includes("miễn dịch")) return { bg: "#ffedd5", order: 3 };
  if (name.includes("tiếp nhận")) return { bg: "#fce7f3", order: 4 };
  if (name.includes("nhập liệu") || name.includes("ksk") || name.includes("khnv") || name.includes("thanh trùng")) {
    return { bg: "#dcfce7", order: 5 };
  }
  return { bg: "#dbeafe", order: 2 };
}

export interface WeeklyScheduleEmailInput {
  weekStart: string;
  positions: Position[];
  staff: StaffMember[];
  assignments: WeeklyAssignment[];
  leaveRequests: LeaveRecord[];
  scheduleRules?: ScheduleRule[];
  positionRules?: PositionRule[];
  holidays?: Holiday[];
  baseUrl: string;
  confirmToken: string;
  clinicSyncInfo?: {
    synced: boolean;
    totalActiveDoctorSlots: number;
    fallbackSource?: "target-week" | "previous-week" | "template";
    sourceWeekStart?: string;
  };
}

interface DayDescriptor {
  date: string;
  dayOfWeek: number;
  dateLabel: string;
  weekdayLabel: string;
  hasAfternoon: boolean;
  isHoliday: boolean;
}

/**
 * Tạo HTML email dự thảo lịch phân phòng tuần sau với 2 bảng nửa tuần (Thứ 2–Thứ 4 & Thứ 5–Thứ 7),
 * giữ nguyên tô màu nhóm phòng, dòng Phép, nút Xác nhận 1 chạm và Link góp ý điều chỉnh.
 * Tuyệt đối không ghi tên hoặc email người nhận trong nội dung email.
 */
export function buildWeeklyScheduleEmailHtml(input: WeeklyScheduleEmailInput): {
  subject: string;
  html: string;
  stats: {
    positionCount: number;
    emptySlotCount: number;
    overloadCount: number;
    leaveCount: number;
    isPublished: boolean;
  };
} {
  const {
    weekStart,
    positions,
    staff,
    assignments,
    leaveRequests,
    holidays = [],
    baseUrl,
    confirmToken,
    clinicSyncInfo,
  } = input;

  const startDate = parseISO(weekStart);
  const endDate = addDays(startDate, 5); // Thứ 7
  const rangeDisplay = `${format(startDate, "dd/MM/yyyy")} – ${format(endDate, "dd/MM/yyyy")}`;
  const shortRange = `${format(startDate, "dd/MM")} - ${format(endDate, "dd/MM/yyyy")}`;

  const staffMap = new Map(staff.map((s) => [s.id, s]));
  const holidayMap = new Map(holidays.map((h) => [h.date, h.name]));

  const days: DayDescriptor[] = Array.from({ length: 6 }, (_, idx) => {
    const d = addDays(startDate, idx);
    const dateStr = format(d, "yyyy-MM-dd");
    const dayOfWeek = d.getDay(); // 1..6
    return {
      date: dateStr,
      dayOfWeek,
      dateLabel: format(d, "dd/MM"),
      weekdayLabel: WEEKDAY_LABELS[dayOfWeek] || "",
      hasAfternoon: dayOfWeek !== 6, // Thứ 7 chỉ có ca sáng
      isHoliday: holidayMap.has(dateStr),
    };
  });

  // Lọc và sắp xếp vị trí theo khu vực (loại trừ SAT_OT và Phòng khám RHM (KTC))
  const sortedPositions = [...positions]
    .filter((p) => p.id !== SATURDAY_OT_POSITION_ID && !isExcludedSchedulePosition(p))
    .sort((a, b) => {
      const ga = getEmailAreaStyle(a);
      const gb = getEmailAreaStyle(b);
      if (ga.order !== gb.order) return ga.order - gb.order;
      return a.name.localeCompare(b.name, "vi");
    });

  // Lookup phân công theo `${positionId}_${date}_${shift}`
  const assignmentLookup = new Map<string, string[]>();
  const shiftStaffLoad = new Map<string, number>();
  let emptySlotCount = 0;

  for (const item of assignments) {
    if (item.weekStart !== weekStart) continue;
    if (!item.staffId) {
      emptySlotCount++;
      continue;
    }
    const staffObj = staffMap.get(item.staffId);
    if (!staffObj) continue;

    const key = `${item.positionId}_${item.date}_${item.shift}`;
    const list = assignmentLookup.get(key) ?? [];
    list.push(getEmailStaffShortName(staffObj.name));
    assignmentLookup.set(key, list);

    const loadKey = `${item.date}_${item.shift}_${item.staffId}`;
    shiftStaffLoad.set(loadKey, (shiftStaffLoad.get(loadKey) ?? 0) + 1);
  }

  let overloadCount = 0;
  for (const count of shiftStaffLoad.values()) {
    if (count >= 4) overloadCount++;
  }

  const weekDatesSet = new Set(days.map((d) => d.date));
  const weekLeaves = leaveRequests.filter(
    (l) => weekDatesSet.has(l.date) && (l.status === "approved" || !l.status),
  );

  const weekEntries = assignments.filter((a) => a.weekStart === weekStart);
  const isPublished =
    weekEntries.length > 0 && weekEntries.every((a) => a.status === "published");

  const renderHalfWeekTable = (title: string, subsetDays: DayDescriptor[]) => {
    const satCount = subsetDays.filter((d) => !d.hasAfternoon).length;
    const fullDayCount = subsetDays.length - satCount;
    const satWidth = 22;
    const remainingWidth = 76 - satCount * satWidth;
    const fullDayWidthPct = fullDayCount > 0 ? (remainingWidth / fullDayCount).toFixed(1) : "25.3";

    const dayHeaderCells = subsetDays
      .map((d) => {
        const colSpanAttr = d.hasAfternoon ? 'colspan="2"' : "";
        const widthPct = d.hasAfternoon ? `${fullDayWidthPct}%` : `${satWidth}%`;
        const holidayTag = d.isHoliday
          ? `<div style="font-size:9px;color:#b91c1c;font-weight:700;">(Nghỉ lễ)</div>`
          : "";
        return `
          <th ${colSpanAttr} style="width:${widthPct};padding:5px 4px;border:1px solid #64748b;text-align:center;font-weight:700;vertical-align:middle;">
            ${escapeHtml(d.dateLabel)}<br>
            <span style="font-weight:600;color:#475569;">${escapeHtml(d.weekdayLabel)}</span>
            ${holidayTag}
          </th>
        `;
      })
      .join("");

    const shiftHeaderCells = subsetDays
      .map((d) => {
        if (!d.hasAfternoon) {
          return `<th style="padding:4px 2px;border:1px solid #64748b;text-align:center;font-weight:600;">Sáng (OT)</th>`;
        }
        return `
          <th style="padding:4px 2px;border:1px solid #64748b;text-align:center;font-weight:600;">Sáng</th>
          <th style="padding:4px 2px;border:1px solid #64748b;text-align:center;font-weight:600;">Chiều</th>
        `;
      })
      .join("");

    const bodyRows = sortedPositions
      .map((pos) => {
        const areaColor = getEmailAreaStyle(pos).bg;
        const dayCells = subsetDays
          .map((d) => {
            if (d.isHoliday) {
              const span = d.hasAfternoon ? 'colspan="2"' : "";
              return `<td ${span} style="padding:5px 4px;border:1px solid #64748b;text-align:center;color:#94a3b8;font-style:italic;">Nghỉ lễ</td>`;
            }

            if (!d.hasAfternoon) {
              const otStaff =
                assignmentLookup.get(`${pos.id}_${d.date}_morning`) ??
                (pos.name.toLowerCase().includes("tăng ca")
                  ? assignmentLookup.get(`${SATURDAY_OT_POSITION_ID}_${d.date}_morning`) ?? []
                  : []);
              const text = otStaff.length > 0 ? escapeHtml(otStaff.join(", ")) : "—";
              return `<td style="padding:5px 4px;border:1px solid #64748b;text-align:center;color:${otStaff.length > 0 ? "#0f172a" : "#94a3b8"};">${text}</td>`;
            }

            const mStaff = assignmentLookup.get(`${pos.id}_${d.date}_morning`) ?? [];
            const aStaff = assignmentLookup.get(`${pos.id}_${d.date}_afternoon`) ?? [];
            const mText = mStaff.join(", ");
            const aText = aStaff.join(", ");

            if (mText === aText) {
              const display = mText ? escapeHtml(mText) : "—";
              return `<td colspan="2" style="padding:5px 4px;border:1px solid #64748b;text-align:center;color:${mText ? "#0f172a" : "#94a3b8"};">${display}</td>`;
            }

            return `
              <td style="padding:5px 4px;border:1px solid #64748b;text-align:center;color:${mText ? "#0f172a" : "#94a3b8"};">${mText ? escapeHtml(mText) : "—"}</td>
              <td style="padding:5px 4px;border:1px solid #64748b;text-align:center;color:${aText ? "#0f172a" : "#94a3b8"};">${aText ? escapeHtml(aText) : "—"}</td>
            `;
          })
          .join("");

        return `
          <tr style="background-color:${areaColor};">
            <td style="padding:5px 6px;border:1px solid #64748b;font-weight:600;color:#0f172a;">${escapeHtml(pos.name)}</td>
            ${dayCells}
          </tr>
        `;
      })
      .join("");

    // Dòng Tăng ca Thứ 7 (nếu có dữ liệu SAT_OT cho nửa cuối tuần)
    const satDay = subsetDays.find((d) => d.dayOfWeek === 6);
    let satOtRow = "";
    if (satDay) {
      const satOtStaff = assignmentLookup.get(`${SATURDAY_OT_POSITION_ID}_${satDay.date}_morning`) ?? [];
      if (satOtStaff.length > 0) {
        const emptyBefore = subsetDays
          .filter((d) => d.dayOfWeek !== 6)
          .map((d) => `<td ${d.hasAfternoon ? 'colspan="2"' : ""} style="padding:5px 4px;border:1px solid #64748b;text-align:center;color:#94a3b8;">—</td>`)
          .join("");
        satOtRow = `
          <tr style="background-color:#f0fdfa;">
            <td style="padding:5px 6px;border:1px solid #64748b;font-weight:700;color:#0f766e;">Tăng ca Thứ 7</td>
            ${emptyBefore}
            <td style="padding:5px 4px;border:1px solid #64748b;text-align:center;font-weight:600;color:#0f766e;">${escapeHtml(satOtStaff.join(", "))}</td>
          </tr>
        `;
      }
    }

    // Dòng Phép cuối bảng
    const leaveCells = subsetDays
      .map((d) => {
        const dayLeaves = weekLeaves.filter((l) => l.date === d.date);
        const labels = dayLeaves
          .map((l) => {
            const s = staffMap.get(l.staffId);
            if (!s) return "";
            const shortName = getEmailStaffShortName(s.name);
            const reason = getEmailLeaveReasonShort(l.reason, l.note);
            const shiftTag = l.shift === "morning" ? " - S" : l.shift === "afternoon" ? " - C" : "";
            return `${shortName} (${reason}${shiftTag})`;
          })
          .filter(Boolean);

        const uniqueLabels = Array.from(new Set(labels));
        const span = d.hasAfternoon ? 'colspan="2"' : "";
        const display = uniqueLabels.length > 0 ? escapeHtml(uniqueLabels.join(", ")) : "—";
        return `<td ${span} style="padding:5px 4px;border:1px solid #64748b;text-align:center;font-weight:600;">${display}</td>`;
      })
      .join("");

    return `
      <div style="margin-bottom:6px;font-size:13px;font-weight:700;color:#0f766e;">
        ${escapeHtml(title)}
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:16px;font-size:11px;border:1px solid #475569;">
        <thead>
          <tr style="background-color:#f1f5f9;color:#0f172a;">
            <th rowspan="2" style="width:24%;padding:6px 6px;border:1px solid #64748b;text-align:left;font-weight:700;background-color:#e2e8f0;">Phòng / Vị trí</th>
            ${dayHeaderCells}
          </tr>
          <tr style="background-color:#ffffff;color:#334155;font-size:10px;">
            ${shiftHeaderCells}
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
          ${satOtRow}
          <tr style="background-color:#fff1f2;color:#9f1239;">
            <td style="padding:5px 6px;border:1px solid #64748b;font-weight:700;">Phép</td>
            ${leaveCells}
          </tr>
        </tbody>
      </table>
    `;
  };

  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  const confirmUrl = `${cleanBaseUrl}/api/schedule/confirm?week=${encodeURIComponent(weekStart)}&token=${encodeURIComponent(confirmToken)}`;
  const adjustUrl = `${cleanBaseUrl}/room-assignment?week=${encodeURIComponent(weekStart)}&openAdjust=1`;

  const statusBadge = isPublished
    ? `<td style="background-color:#dcfce7;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;color:#166534;">✅ Đã chốt chính thức</td>`
    : `<td style="background-color:#fef3c7;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;color:#92400e;">⏳ Dự thảo chờ xác nhận</td>`;

  const warningText =
    emptySlotCount === 0 && overloadCount === 0
      ? `<span style="color:#059669;font-weight:600;">Đầy đủ nhân sự · Không có ca quá tải (&ge; 4 vị trí)</span>`
      : `<span style="color:#b45309;font-weight:600;">${emptySlotCount > 0 ? `Còn ${emptySlotCount} ô trống cần rà soát` : ""}${emptySlotCount > 0 && overloadCount > 0 ? " · " : ""}${overloadCount > 0 ? `${overloadCount} lượt kiêm &ge; 4 vị trí` : ""}</span>`;

  const firstHalf = days.slice(0, 3); // T2 - T4
  const secondHalf = days.slice(3, 6); // T5 - T7

  const part1Html = renderHalfWeekTable(
    `📌 PHẦN 1: THỨ 2 – THỨ 4 (${firstHalf[0].dateLabel} – ${firstHalf[2].dateLabel})`,
    firstHalf,
  );
  const part2Html = renderHalfWeekTable(
    `📌 PHẦN 2: THỨ 5 – THỨ 7 (${secondHalf[0].dateLabel} – ${secondHalf[2].dateLabel})`,
    secondHalf,
  );

  const subject = `[NurseFlow] Dự thảo lịch phân phòng tuần sau (${shortRange})`;

  const clinicSyncLine = clinicSyncInfo
    ? clinicSyncInfo.synced
      ? `&bull; Đối chiếu lịch bác sĩ (<code>schedule-embed</code>): <span style="color:#0f766e;font-weight:600;">Đã đồng bộ (${clinicSyncInfo.totalActiveDoctorSlots} ca khám mở phòng)</span><br>`
      : clinicSyncInfo.fallbackSource === "previous-week"
        ? `&bull; Đối chiếu lịch bác sĩ (<code>schedule-embed</code>): <span style="color:#0369a1;font-weight:600;">Tuần mới chưa có lịch bác sĩ, áp dụng lịch mở phòng theo tuần hiện tại${clinicSyncInfo.sourceWeekStart ? ` (${format(parseISO(clinicSyncInfo.sourceWeekStart), "dd/MM")}${clinicSyncInfo.totalActiveDoctorSlots > 0 ? ` · ${clinicSyncInfo.totalActiveDoctorSlots} ca khám` : ""})` : ""}</span><br>`
        : `&bull; Đối chiếu lịch bác sĩ: <span style="color:#64748b;">Chưa có lịch bác sĩ tuần mới trên hệ thống, tạm xếp theo lịch nền &amp; kinh nghiệm</span><br>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(subject)}</title>
  <style>
    body, table, td, th, p, a, div, span {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td, th {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
  </style>
</head>
<body style="margin:0;padding:16px 8px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:720px;margin:0 auto;background-color:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #cbd5e1;box-shadow:0 4px 16px rgba(15,23,42,0.06);">
    <!-- Header -->
    <tr>
      <td style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%);padding:20px 18px;color:#ffffff;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#ccfbf1;margin-bottom:6px;">
          NURSEFLOW &bull; LỊCH PHÂN PHÒNG TUẦN MỚI
        </div>
        <h1 style="margin:0 0 8px 0;font-size:19px;font-weight:700;line-height:1.35;color:#ffffff;">
          Dự Thảo Lịch Phân Công Tuần Sau
        </h1>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="background-color:rgba(255,255,255,0.18);padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;color:#ffffff;">
              📅 Từ Thứ 2 (${escapeHtml(rangeDisplay)})
            </td>
            <td style="width:8px;"></td>
            ${statusBadge}
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:18px 14px 14px 14px;">
        <!-- Tóm tắt nhanh -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:14px;">
          <tr>
            <td style="padding:10px 12px;font-size:12px;line-height:1.6;color:#334155;">
              <strong style="color:#0f172a;">Tóm tắt lịch tuần sau (phân bổ theo kinh nghiệm tích lũy &amp; thói quen 1–2 tuần gần đây):</strong><br>
              &bull; Tổng số vị trí/phòng: <strong>${sortedPositions.length}</strong><br>
              ${clinicSyncLine}
              &bull; Nhân sự nghỉ phép/đi học đã duyệt: <strong>${weekLeaves.length} lượt</strong> (đã trừ khỏi lịch trực và ghi tại dòng Phép)<br>
              &bull; Trạng thái kiểm tra: ${warningText}
            </td>
          </tr>
        </table>

        ${part1Html}
        ${part2Html}

        <!-- Khối hành động -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
          <tr>
            <td style="padding:16px 14px;text-align:center;">
              <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:6px;">
                Phản hồi hoặc Xác nhận lịch tuần sau
              </div>
              <div style="font-size:12px;color:#475569;margin-bottom:14px;line-height:1.5;">
                Nếu bảng phân công đã phù hợp, vui lòng bấm nút xác nhận để chốt lịch chính thức trên hệ thống. Nếu cần điều chỉnh vị trí/ca trực, sử dụng liên kết góp ý trực tuyến.
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                <tr>
                  <td align="center" style="padding-bottom:10px;">
                    <a href="${escapeHtml(confirmUrl)}" target="_blank" style="display:inline-block;width:100%;max-width:360px;box-sizing:border-box;background-color:#0d9488;color:#ffffff;text-decoration:none;padding:13px 18px;border-radius:10px;font-size:14px;font-weight:700;text-align:center;">
                      ✅ XÁC NHẬN CHỐT LỊCH CHÍNH THỨC
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(adjustUrl)}" target="_blank" style="display:inline-block;width:100%;max-width:360px;box-sizing:border-box;background-color:#ffffff;color:#0f766e;text-decoration:none;padding:11px 18px;border-radius:10px;font-size:13px;font-weight:700;text-align:center;border:1px solid #99f6e4;">
                      ✏️ Góp ý / Điều chỉnh lịch tuần sau &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer (Tuyệt đối không ghi tên/email người nhận) -->
    <tr>
      <td style="background-color:#f8fafc;padding:14px 16px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0 0 4px 0;font-size:12px;color:#64748b;font-weight:600;">
          NurseFlow &bull; Hệ thống điều phối lịch trực tự động
        </p>
        <p style="margin:0;font-size:11px;color:#94a3b8;font-style:italic;">
          Email được gửi tự động vào sáng Chủ Nhật hằng tuần. Vui lòng sử dụng các liên kết thao tác ở trên khi cần phản hồi.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject,
    html,
    stats: {
      positionCount: sortedPositions.length,
      emptySlotCount,
      overloadCount,
      leaveCount: weekLeaves.length,
      isPublished,
    },
  };
}
