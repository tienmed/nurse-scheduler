import { addDays, format, parseISO } from "date-fns";
import type { Position, PositionRule, ShiftType, WeeklyAssignment } from "@/lib/types";

export const SCHEDULE_EMBED_BASE_URL = "https://phongkhamdaihocypnt.edu.vn/nhansu/schedule-embed";

/**
 * Chuẩn hóa tên phòng để đối chiếu ổn định (bỏ khoảng trắng thừa, viết thường).
 */
export function normalizeClinicName(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ánh xạ từ position.id (và fallback theo tên phòng chuẩn hóa) trong NurseFlow
 * sang tên phòng khám chính xác trên https://phongkhamdaihocypnt.edu.vn/nhansu/schedule-embed.
 *
 * Lưu ý nghiệp vụ:
 * - Phòng Chăm sóc da (P2.4) đi theo lịch phòng Da Liễu.
 * - Nội 1, Nội 2, Ngoại không gộp BHYT Nội / BHYT Ngoại.
 * - Phòng khám RHM (KTC) tách riêng, không liên kết theo schedule-embed.
 * - Siêu âm (P1.6), Phòng cấp cứu (P1.7), Phòng đo ECG (P1.8) thường trực tất cả các ngày/buổi phòng khám có làm việc.
 * - Các vị trí vận hành độc lập (Tiếp nhận, Đo sinh hiệu, KHNV, Thanh Trùng, Nhập liệu KSK) cũng không nằm trong bảng này.
 */
export const POSITION_ID_TO_EMBED_CLINIC: Record<string, string> = {
  "pos-1775185718350-um0fc": "Dị ứng - Miễn dịch lâm sàng",
  "position-noi-than-kinh": "Phòng khám Nội thần kinh",
  "position-noi-tim-mach": "Nội Tim Mạch",
  "position-phong-cham-soc-da": "Da Liễu",
  "position-phong-kham-bsgd": "Phòng khám Bác sĩ Gia đình",
  "position-phong-kham-chuyen-gia": "Phòng khám Chuyên gia",
  "position-phong-kham-ctch": "Phòng khám Cơ xương khớp - Y học thể dục thể thao",
  "position-phong-kham-da-lieu": "Da Liễu",
  "position-phong-kham-mat": "Phòng khám Mắt",
  "position-phong-kham-ngoai": "Phòng khám Ngoại",
  "position-nhi": "Phòng khám Nhi",
  "position-phong-kham-noi-1": "Nội 1",
  "position-phong-kham-noi-2": "Nội 2",
  "position-phong-kham-phu-san": "Phòng khám Sản phụ khoa",
  "position-phong-kham-ttk": "Phòng khám Tâm lý Tâm thần",
  "position-phong-kham-tmh": "Phòng khám Tai Mũi Họng",
  "position-yhct": "Phòng khám Chẩn trị Y học Cổ truyền",
};

const POSITION_NAME_TO_EMBED_CLINIC: Record<string, string> = {
  "dị ứng - miễn dịch": "Dị ứng - Miễn dịch lâm sàng",
  "nội thần kinh (p2.2)": "Phòng khám Nội thần kinh",
  "nội tim mạch (p2.11b)": "Nội Tim Mạch",
  "phòng chăm sóc da (p2.4)": "Da Liễu",
  "phòng khám bsgd (p1.14)": "Phòng khám Bác sĩ Gia đình",
  "phòng khám chuyên gia": "Phòng khám Chuyên gia",
  "phòng khám ctch (p1.9)": "Phòng khám Cơ xương khớp - Y học thể dục thể thao",
  "phòng khám da liễu (p2.6)": "Da Liễu",
  "phòng khám mắt (p2.3)": "Phòng khám Mắt",
  "phòng khám ngoại (p1.11)": "Phòng khám Ngoại",
  "phòng khám nhi (ktc)": "Phòng khám Nhi",
  "phòng khám nội 1 (p.13)": "Nội 1",
  "phòng khám nội 2 (p1.10)": "Nội 2",
  "phòng khám phụ - sản (p1.12)": "Phòng khám Sản phụ khoa",
  "phòng khám tâm thần kinh - tâm lý": "Phòng khám Tâm lý Tâm thần",
  "phòng khám tmh (p2.7)": "Phòng khám Tai Mũi Họng",
  "phòng khám yhct (p2.5)": "Phòng khám Chẩn trị Y học Cổ truyền",
};

export function resolveMappedEmbedClinicName(pos: Position): string | null {
  if (POSITION_ID_TO_EMBED_CLINIC[pos.id]) {
    return POSITION_ID_TO_EMBED_CLINIC[pos.id];
  }
  return POSITION_NAME_TO_EMBED_CLINIC[normalizeClinicName(pos.name)] ?? null;
}

export interface ParsedClinicWeekSchedule {
  totalActiveDoctorSlots: number;
  clinicActiveSlots: Map<string, Set<string>>; // normalizedClinicName -> Set<`${dayOfWeek}_${shift}`>
}

/**
 * Phân tích HTML từ trang /nhansu/schedule-embed để biết từng phòng khám có bác sĩ trực ở ca nào.
 */
export function parseScheduleEmbedHtml(html: string): ParsedClinicWeekSchedule {
  const clinicActiveSlots = new Map<string, Set<string>>();
  let totalActiveDoctorSlots = 0;

  const morningRows = html.match(/<tr class="morning-row"[\s\S]*?<\/tr>/gi) || [];
  const afternoonRows = html.match(/<tr class="afternoon-row"[\s\S]*?<\/tr>/gi) || [];

  morningRows.forEach((mRowHtml, idx) => {
    const aRowHtml = afternoonRows[idx] || "";
    const clinicNameMatch = mRowHtml.match(/<div class="clinic-name">([\s\S]*?)<\/div>/i);
    if (!clinicNameMatch) return;

    const clinicName = clinicNameMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!clinicName) return;

    const normName = normalizeClinicName(clinicName);
    const activeSet = clinicActiveSlots.get(normName) ?? new Set<string>();

    const mCells = mRowHtml.match(/<td class="schedule-cell[\s\S]*?<\/td>/gi) || [];
    const aCells = aRowHtml.match(/<td class="schedule-cell[\s\S]*?<\/td>/gi) || [];

    // 6 cột: Thứ Hai (1) .. Thứ Bảy (6)
    for (let dayIdx = 0; dayIdx < 6; dayIdx++) {
      const dayOfWeek = dayIdx + 1;
      const mCell = mCells[dayIdx] || "";
      const aCell = aCells[dayIdx] || "";

      if (/<div class="doctor-name">/i.test(mCell)) {
        activeSet.add(`${dayOfWeek}_morning`);
        totalActiveDoctorSlots++;
      }
      if (/<div class="doctor-name">/i.test(aCell)) {
        activeSet.add(`${dayOfWeek}_afternoon`);
        totalActiveDoctorSlots++;
      }
    }

    clinicActiveSlots.set(normName, activeSet);
  });

  return {
    totalActiveDoctorSlots,
    clinicActiveSlots,
  };
}

export interface ActiveClinicSyncResult {
  synced: boolean;
  totalActiveDoctorSlots: number;
  effectivePositionRules: PositionRule[];
  forceOpenPositionSlots: Set<string>; // `${dayOfWeek}-${shift}-${positionId}`
  fallbackSource?: "target-week" | "previous-week" | "template";
  sourceWeekStart?: string;
}

/**
 * Suy ra lịch mở phòng từ danh sách phân công đã chốt của tuần trước (offline fallback khi schedule-embed chưa sẵn sàng).
 */
export function applyPreviousAssignmentsToPositionRules(
  positions: Position[],
  positionRules: PositionRule[],
  previousAssignments: WeeklyAssignment[],
  sourceWeekStart: string,
): ActiveClinicSyncResult {
  const forceOpenPositionSlots = new Set<string>();
  const prevOpenSet = new Set<string>();

  for (const a of previousAssignments) {
    if (!a.date || !a.shift || !a.positionId) continue;
    const dow = parseISO(a.date).getDay();
    if (dow < 1 || dow > 5) continue;
    prevOpenSet.add(`${dow}-${a.shift}-${a.positionId}`);
  }

  if (prevOpenSet.size === 0) {
    return {
      synced: false,
      totalActiveDoctorSlots: 0,
      effectivePositionRules: positionRules,
      forceOpenPositionSlots,
      fallbackSource: "template",
    };
  }

  const ruleMap = new Map<string, PositionRule>();
  for (const r of positionRules) {
    ruleMap.set(`${r.dayOfWeek}-${r.shift}-${r.positionId}`, { ...r });
  }

  const shifts: ShiftType[] = ["morning", "afternoon"];
  for (const pos of positions) {
    const mappedClinic = resolveMappedEmbedClinicName(pos);
    if (!mappedClinic) continue;

    for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
      for (const shift of shifts) {
        const key = `${dayOfWeek}-${shift}-${pos.id}`;
        const isOpenLastWeek = prevOpenSet.has(key);
        ruleMap.set(key, {
          id: ruleMap.get(key)?.id || `prev-week-${key}`,
          positionId: pos.id,
          dayOfWeek,
          shift,
          active: isOpenLastWeek,
        });
        if (isOpenLastWeek) {
          forceOpenPositionSlots.add(key);
        }
      }
    }
  }

  return {
    synced: false,
    totalActiveDoctorSlots: 0,
    effectivePositionRules: Array.from(ruleMap.values()),
    forceOpenPositionSlots,
    fallbackSource: "previous-week",
    sourceWeekStart,
  };
}

/**
 * Kết hợp dữ liệu phòng khám hoạt động từ schedule-embed vào positionRules.
 * Nếu parsed === null hoặc totalActiveDoctorSlots === 0 (chưa có lịch bác sĩ tuần đó),
 * giữ nguyên positionRules gốc để không làm trống toàn bộ lịch.
 */
export function applyClinicScheduleToPositionRules(
  positions: Position[],
  positionRules: PositionRule[],
  parsed: ParsedClinicWeekSchedule | null,
): ActiveClinicSyncResult {
  const forceOpenPositionSlots = new Set<string>();

  if (!parsed || parsed.totalActiveDoctorSlots === 0) {
    return {
      synced: false,
      totalActiveDoctorSlots: 0,
      effectivePositionRules: positionRules,
      forceOpenPositionSlots,
      fallbackSource: "template",
    };
  }

  const ruleMap = new Map<string, PositionRule>();
  for (const r of positionRules) {
    ruleMap.set(`${r.dayOfWeek}-${r.shift}-${r.positionId}`, { ...r });
  }

  const shifts: ShiftType[] = ["morning", "afternoon"];

  for (const pos of positions) {
    const mappedClinic = resolveMappedEmbedClinicName(pos);
    if (!mappedClinic) continue; // Vị trí độc lập (Tiếp nhận, KHNV, RHM...) giữ nguyên rule

    const normClinic = normalizeClinicName(mappedClinic);
    const activeSlots = parsed.clinicActiveSlots.get(normClinic);
    if (!activeSlots) continue; // Không tìm thấy tên phòng trong HTML -> giữ nguyên rule

    for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
      for (const shift of shifts) {
        const key = `${dayOfWeek}-${shift}-${pos.id}`;
        const isClinicOpen = activeSlots.has(`${dayOfWeek}_${shift}`);

        ruleMap.set(key, {
          id: ruleMap.get(key)?.id || `clinic-sync-${key}`,
          positionId: pos.id,
          dayOfWeek,
          shift,
          active: isClinicOpen,
        });

        if (isClinicOpen) {
          forceOpenPositionSlots.add(key);
        }
      }
    }
  }

  return {
    synced: true,
    totalActiveDoctorSlots: parsed.totalActiveDoctorSlots,
    effectivePositionRules: Array.from(ruleMap.values()),
    forceOpenPositionSlots,
    fallbackSource: "target-week",
  };
}

async function fetchParsedClinicSchedule(weekStart: string): Promise<ParsedClinicWeekSchedule | null> {
  try {
    const url = `${SCHEDULE_EMBED_BASE_URL}?week_start=${encodeURIComponent(weekStart)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "NurseFlow-Scheduler/1.0",
        Accept: "text/html",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;
    const html = await response.text();
    return parseScheduleEmbedHtml(html);
  } catch (err) {
    console.warn(`[ClinicScheduleAPI] Không thể tải schedule-embed cho tuần ${weekStart}:`, err);
    return null;
  }
}

export interface FetchEffectivePositionRulesOptions {
  /** Danh sách lịch tuần đã lưu (nếu có) dùng làm fallback khi schedule-embed không khả dụng. */
  weeklySchedule?: WeeklyAssignment[];
  /** Cho phép áp lịch mở phòng của tuần ngay trước (tuần này) khi tuần sau chưa có lịch bác sĩ (mặc định true). */
  fallbackToPreviousWeek?: boolean;
  /** Hàm tải lịch bác sĩ tùy chọn phục vụ kiểm thử đơn vị. */
  fetcher?: (weekStart: string) => Promise<ParsedClinicWeekSchedule | null>;
}

/**
 * Tải lịch bác sĩ & phòng khám hoạt động cho tuần weekStart (yyyy-MM-dd) từ nhansu/schedule-embed.
 * Nếu tuần weekStart chưa có lịch bác sĩ, tự động áp dụng lịch mở phòng của tuần trước (weekStart - 7 ngày)
 * trước khi fallback về lịch nền.
 */
export async function fetchEffectivePositionRulesForWeek(
  weekStart: string,
  positions: Position[],
  positionRules: PositionRule[],
  options: FetchEffectivePositionRulesOptions = {},
): Promise<ActiveClinicSyncResult> {
  const { weeklySchedule, fallbackToPreviousWeek = true, fetcher = fetchParsedClinicSchedule } = options;

  const targetParsed = await fetcher(weekStart);
  if (targetParsed && targetParsed.totalActiveDoctorSlots > 0) {
    const syncedResult = applyClinicScheduleToPositionRules(positions, positionRules, targetParsed);
    return {
      ...syncedResult,
      sourceWeekStart: weekStart,
    };
  }

  if (fallbackToPreviousWeek) {
    const prevWeekStart = format(addDays(parseISO(weekStart), -7), "yyyy-MM-dd");
    const prevParsed = await fetcher(prevWeekStart);
    if (prevParsed && prevParsed.totalActiveDoctorSlots > 0) {
      const prevEmbedResult = applyClinicScheduleToPositionRules(positions, positionRules, prevParsed);
      return {
        ...prevEmbedResult,
        synced: false, // Đánh dấu là kế thừa từ tuần trước vì tuần sau chưa có lịch bác sĩ riêng
        fallbackSource: "previous-week",
        sourceWeekStart: prevWeekStart,
      };
    }

    if (weeklySchedule && weeklySchedule.length > 0) {
      const prevAssignments = weeklySchedule.filter((w) => w.weekStart === prevWeekStart);
      if (prevAssignments.length > 0) {
        return applyPreviousAssignmentsToPositionRules(positions, positionRules, prevAssignments, prevWeekStart);
      }
    }
  }

  return applyClinicScheduleToPositionRules(positions, positionRules, null);
}
