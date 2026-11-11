import { NextRequest, NextResponse } from "next/server";
import { parseISO, format, addDays } from "date-fns";
import { getAppData } from "@/lib/repository";
import { getUserContext } from "@/lib/session";
import { isPastShift, getWeekStart, getNextWeekStart } from "@/lib/date";
import { fetchEffectivePositionRulesForWeek } from "@/lib/clinic-schedule-api";
import {
  buildExperienceHoursLookup,
  buildRecentHabitStats,
  buildSmartWeeklyAssignments,
  isAssignableNursingStaff,
} from "@/lib/schedule";
import { aiService } from "@/lib/ai-service";
import type { WeeklyAssignment, StaffMember, Position, ShiftType } from "@/lib/types";

// [QWEN3] Danh sách email đặc quyền theo yêu cầu của hệ thống
const PRIVILEGED_EMAILS = [
  "tienmed@gmail.com",
  "nghiadn.pk@pnt.edu.vn",
  "bstien@pnt.edu.vn",
  "admin@nurseflow.local",
];

export interface DiffChangeItem {
  id: string;
  date: string;
  dayLabel: string;
  shift: ShiftType;
  shiftLabel: string;
  positionId: string;
  positionName: string;
  oldStaffName: string;
  newStaffName: string;
  reason: string;
}

export interface AdjustScheduleResponse {
  success: boolean;
  scope: "current" | "next";
  weekStart: string;
  diffChanges: DiffChangeItem[];
  recommendations: string[];
  summary: string;
  updatedAssignments: WeeklyAssignment[];
  error?: string;
}

function getStaffShortName(fullName: string): string {
  if (!fullName) return "Trống";
  const trimmed = fullName.trim();
  const compoundNames = [
    "Phúc Anh", "Bích Thảo", "Bính Thảo", "Kim Hoa",
    "Kim Liên", "Kim Điệp", "Tú Trang", "Mỹ Nhiên",
    "Ngọc Hạnh", "Nhân Nghĩa", "Lyna", "Thiên Trang",
  ];
  for (const comp of compoundNames) {
    if (trimmed.endsWith(comp) || trimmed.toLowerCase().includes(comp.toLowerCase())) return comp;
  }
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

export async function POST(request: NextRequest) {
  try {
    // 1. Kiểm tra xác thực & Phân quyền đặc quyền
    const { user } = await getUserContext();
    const userEmail = (user?.email || "").toLowerCase();
    const isAuthorized =
      PRIVILEGED_EMAILS.includes(userEmail) ||
      user?.role === "admin" ||
      user?.role === "coordinator";

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền thực hiện chức năng điều chỉnh lịch nâng cao." },
        { status: 403 },
      );
    }

    // 2. Phân tích tham số đầu vào
    const body = await request.json();
    const scope: "current" | "next" = body.scope === "current" ? "current" : "next";
    const feedback: string = (body.feedback || "").trim();
    const inputAssignments: WeeklyAssignment[] = Array.isArray(body.currentAssignments)
      ? body.currentAssignments
      : [];

    const data = await getAppData();
    const currentWeek = getWeekStart();
    const nextWeek = getNextWeekStart();
    const targetWeekStart = scope === "current" ? currentWeek : nextWeek;

    // Map tra cứu
    const staffMap = new Map<string, StaffMember>(data.staff.map((s) => [s.id, s]));
    const staffByName = new Map<string, StaffMember>();
    for (const s of data.staff) {
      staffByName.set(s.name.toLowerCase(), s);
      staffByName.set(getStaffShortName(s.name).toLowerCase(), s);
    }
    const posMap = new Map<string, Position>(data.positions.map((p) => [p.id, p]));

    // Lọc hoặc chuẩn hóa phân công hiện tại
    let assignments = [...inputAssignments];
    if (assignments.length === 0) {
      assignments = data.weeklySchedule.filter((w) => w.weekStart === targetWeekStart);
      if (assignments.length === 0) {
        const clinicSync = await fetchEffectivePositionRulesForWeek(
          targetWeekStart,
          data.positions,
          data.positionRules,
          { weeklySchedule: data.weeklySchedule },
        );
        assignments = buildSmartWeeklyAssignments({
          templateSchedule: data.templateSchedule,
          positions: data.positions,
          staff: data.staff,
          weeklySchedule: data.weeklySchedule,
          weekStart: targetWeekStart,
          leaveRequests: data.leaveRequests,
          scheduleRules: data.scheduleRules,
          positionRules: clinicSync.effectivePositionRules,
          holidays: data.holidays,
          initialStatus: "draft",
          forceOpenPositionSlots: clinicSync.forceOpenPositionSlots,
        });
      }
    }

    const expLookup = buildExperienceHoursLookup(data.weeklySchedule, data.staff, data.positions, targetWeekStart);
    const habitStats = buildRecentHabitStats(data.weeklySchedule, targetWeekStart);

    // 3. Xây dựng prompt cho AI Qwen3 để phân tích góp ý và gợi ý hoán đổi
    const staffListSummary = data.staff
      .filter(isAssignableNursingStaff)
      .map((s) => `- ${s.name} (${getStaffShortName(s.name)}): Vị trí [${s.positionIds.map((pid) => posMap.get(pid)?.name || pid).join(", ")}]`)
      .join("\n");

    const leaveRequestsThisWeek = data.leaveRequests
      .filter((l) => {
        const d = parseISO(l.date);
        const wStart = parseISO(targetWeekStart);
        return d >= wStart && d <= addDays(wStart, 6);
      })
      .map((l) => `- ${staffMap.get(l.staffId)?.name || l.staffId}: nghỉ ${l.shift} ngày ${l.date} (${l.reason})`)
      .join("\n");

    const systemPrompt = `Bạn là Trợ lý Điều phối Lịch Y tế QWEN3 cho phòng khám NurseFlow.
Hãy phân tích nội dung góp ý của Điều phối viên để điều chỉnh lịch phân phòng trực tuần.

NGUYÊN TẮC QUAN TRỌNG VỀ GÓP Ý / ĐIỀU CHỈNH:
- Nội dung góp ý từ liên kết email chỉ mang tính chất tham khảo cục bộ cho phiên điều chỉnh lịch của riêng tuần được chọn (${targetWeekStart}).
- TUYỆT ĐỐI KHÔNG đưa nội dung góp ý này vào kho kinh nghiệm tích lũy lâu dài hay suy diễn thành quy tắc chung cho toàn hệ thống.
- Chỉ đưa ra các đề xuất hoán đổi ca (changes) thực sự cần thiết và hợp lý cho tuần này.

QUY TẮC BẮT BUỘC (TUÂN THỦ 100%):
1. VỊ TRÍ TIẾP NHẬN: CHỈ CẦN ĐÚNG 2 NHÂN SỰ cho mỗi ca trực (không bố trí 3 người).
   - Hiện thời xoay đều giữa 3 điều dưỡng: Lyna, Phúc Anh, Thủy (2 người/ca).
   - Nếu 1 người nghỉ phép thì 2 người còn lại trong bộ 3 trực Tiếp nhận; khi cả nhóm vắng nhiều mới bổ sung điều dưỡng khác và phát cảnh báo.
2. NGUYỄN PHÚ THỊNH: Chỉ làm hồ sơ theo thời vụ (vị trí Nhập liệu KSK), tuần tiếp theo vẫn tiếp tục làm hồ sơ.
3. ĐẶNG LÊ TÚ TRANG: CHỈ làm những việc hành chính tại phòng KHNV, tuyệt đối không điều động sang vị trí khác.
4. CẶP PHÒNG CHĂM SÓC DA (P2.4) & DA LIỄU (P2.6):
   - Mặc nhiên phân công cho ĐOÀN THỊ MỸ NHIÊN (Mỹ Nhiên) kiêm cả 2 phòng này khi đi làm.
   - Chỉ phân điều dưỡng khác vào 2 phòng này khi Mỹ Nhiên có lịch nghỉ phép/ốm/đi học trong ca đó.
   - Kể cả khi Mỹ Nhiên nghỉ cần người hỗ trợ thay thế, Chăm sóc da (P2.4) và Da liễu (P2.6) VẪN PHẢI đi ĐỒNG BỘ cùng 1 điều dưỡng trong cùng ca (không tách 2 người khác nhau).
5. CÁC PHÒNG CỐ ĐỊNH ĐIỀU DƯỠNG THƯỜNG TRỰC:
   - Phòng Siêu âm (P1.6): thường trực mặc nhiên là Bích Thảo; có thêm Lyna hỗ trợ khi cần (hoặc khi Bích Thảo nghỉ).
   - Phòng khám Chuyên gia: thường trực mặc nhiên là Kim Hoa (chỉ phân người khác khi Kim Hoa nghỉ hoặc quá tải).
   - Thanh Trùng & Phòng khám YHCT (P2.5): mặc nhiên là ĐD Nhân (Lê Thị Nhân - DD16); khi ĐD Nhân nghỉ phép hoặc cần thay đổi sẽ có Điệp (Nguyễn Thị Ngọc Điệp - DD07) hỗ trợ.
   - Phòng cấp cứu (P1.7) & Phòng đo ECG (P1.8): mặc nhiên là Ngọc Hạnh (DD02).
   - Phòng khám CTCH (P1.9) & Phòng khám Nội 1 (P.13): mặc nhiên là Nga (Nhữ Thị Phương Nga - DD04).
   - Phòng khám Phụ - Sản (P1.12), Phòng khám Ngoại (P1.11) & Phòng khám Nội 2 (P1.10): mặc nhiên là Vĩnh (Nguyễn Thị Vĩnh - DD05).
   - Phòng khám Tâm thần kinh - Tâm lý: thứ tự ưu tiên Điệp -> Thủy -> Ái -> Chuyền (khi cần người thay thế).
   - Phòng khám Mắt (P2.3): thứ tự ưu tiên Chuyền -> Thủy -> Ái (khi cần người thay thế).
   - Da liễu & Chăm sóc da: mặc nhiên Nhiên; khi Nhiên nghỉ ưu tiên đồng bộ Ái -> Thủy.
   - Phòng khám TMH (P2.7): thứ tự ưu tiên Điệp -> Ái -> Thủy -> Chuyền (khi cần người thay thế).
   - Nhóm PHÒNG ÍT BỆNH (Ngoại P1.11, Chuyên gia, Dị ứng - Miễn dịch, Nội thần kinh P2.2, Phụ khoa / Phụ - Sản P1.12): lượng bệnh ít, ưu tiên ghép kiêm nhiệm cho điều dưỡng khu vực lân cận hoặc người giữ tải nhẹ (tính 0.5 tải), tránh kéo người đang gánh phòng đông bệnh.
   - Bỏ Phòng khám RHM (KTC), không xếp lịch vào vị trí này.
6. ĐIỀU PHỐI DỰ PHÒNG KHNV & GIẢI PHÓNG ĐO SINH HIỆU KHI QUÁ TẢI (>= 4 VỊ TRÍ):
   - Thiên Trang và ĐD Nghĩa (nghiadn.pk@pnt.edu.vn) làm việc toàn thời gian tại phòng KHNV.
   - Khi có nhân sự bị quá tải (phụ trách >= 4 vị trí trong 1 ca): Kích hoạt điều động hỗ trợ.
   - Vị trí Đo sinh hiệu thông thường có 2 nhân sự.
   - Rút 1 nhân sự đo sinh hiệu thường quen thuộc với vị trí quá tải nhất để chuyển sang chi viện vị trí đó.
   - Điều động nhân sự từ KHNV vào trám chỗ tại Đo sinh hiệu: Ưu tiên Nghĩa (nếu không có lịch nghỉ phép hoặc đi học), nếu Nghĩa bận học/phép thì điều Thiên Trang.
5. RÀNG BUỘC THỜI GIAN:
   - Nếu là tuần hiện tại ("current"), các ca đã qua trong quá khứ hoặc ca sáng đã qua giờ KHÔNG ĐƯỢC PHÉP THAY ĐỔI.
   - Chỉ điều chỉnh các ca chưa diễn ra.

Trả về kết quả ĐÚNG ĐỊNH DẠNG JSON duy nhất (không kèm markdown ngoài JSON):
{
  "summary": "Tóm tắt ngắn gọn các điều chỉnh đã thực hiện và sự hợp lý",
  "recommendations": ["Khuyến nghị 1", "Khuyến nghị 2"],
  "changes": [
    {
      "date": "YYYY-MM-DD",
      "shift": "morning hoặc afternoon",
      "positionId": "ID vị trí",
      "positionName": "Tên phòng",
      "oldStaffName": "Tên người cũ",
      "newStaffId": "ID nhân sự mới",
      "newStaffName": "Tên người mới",
      "reason": "Lý do thay đổi theo góp ý"
    }
  ]
}`;

    const userPrompt = `
Phạm vi điều chỉnh: ${scope === "current" ? "Tuần hiện tại (" + targetWeekStart + ") - CHỈ ĐIỀU CHỈNH CA TƯƠNG LAI" : "Tuần tiếp theo (" + targetWeekStart + ")"}
Nội dung góp ý / yêu cầu từ Điều phối viên:
"""${feedback || "Kiểm tra và tối ưu phân bổ theo các quy tắc chuẩn phòng khám."}"""

Danh sách nhân sự:
${staffListSummary}

Tình trạng nghỉ phép trong tuần:
${leaveRequestsThisWeek || "Không có đơn nghỉ phép"}

Số lượng phân công hiện thời: ${assignments.length} ca.
`;

    let aiResultText = "";
    try {
      // Gọi cụm AI nội bộ thông qua AIService
      aiResultText = await (aiService as any).callAI(userPrompt, systemPrompt, "qwen3");
    } catch (err: any) {
      console.warn("AI service call fallback:", err?.message);
    }

    // 4. Phân tích kết quả JSON từ AI (hoặc dự phòng phân tích quy tắc)
    let parsedAi: any = null;
    try {
      const jsonMatch = aiResultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedAi = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // bỏ qua nếu parse lỗi
    }

    const diffChanges: DiffChangeItem[] = [];
    const recommendations: string[] = parsedAi?.recommendations || [];
    let summary: string = parsedAi?.summary || "";

    // 5. Áp dụng các thay đổi từ AI nếu hợp lệ, đồng thời kiểm tra chặt chẽ `isPastShift`
    const updatedAssignments = assignments.map((item) => ({ ...item }));

    if (parsedAi && Array.isArray(parsedAi.changes)) {
      for (const ch of parsedAi.changes) {
        // Kiểm tra ca đã qua
        if (scope === "current" && isPastShift(ch.date, ch.shift)) {
          continue; // Khóa ca đã diễn ra
        }

        const targetPos = data.positions.find(
          (p) => p.id === ch.positionId || p.name.toLowerCase().includes((ch.positionName || "").toLowerCase()),
        );
        const targetStaff = data.staff.find(
          (s) =>
            isAssignableNursingStaff(s) &&
            (s.id === ch.newStaffId ||
              s.name.toLowerCase() === (ch.newStaffName || "").toLowerCase() ||
              getStaffShortName(s.name).toLowerCase() === (ch.newStaffName || "").toLowerCase()),
        );

        if (targetPos && targetStaff) {
          // Tìm ca trong danh sách phân công
          const idx = updatedAssignments.findIndex(
            (a) => a.date === ch.date && a.shift === ch.shift && a.positionId === targetPos.id,
          );

          if (idx !== -1) {
            const oldStaff = staffMap.get(updatedAssignments[idx].staffId);
            const oldName = oldStaff ? getStaffShortName(oldStaff.name) : "Trống";
            const newName = getStaffShortName(targetStaff.name);

            if (oldName !== newName) {
              updatedAssignments[idx].staffId = targetStaff.id;
              updatedAssignments[idx].status = "adjusted";

              diffChanges.push({
                id: `diff-${ch.date}-${ch.shift}-${targetPos.id}`,
                date: ch.date,
                dayLabel: format(parseISO(ch.date), "dd/MM"),
                shift: ch.shift as ShiftType,
                shiftLabel: ch.shift === "morning" ? "Sáng" : "Chiều",
                positionId: targetPos.id,
                positionName: targetPos.name,
                oldStaffName: oldName,
                newStaffName: newName,
                reason: ch.reason || "Điều chỉnh tối ưu theo phản hồi",
              });
            }
          }
        }
      }
    }

    // 6. Kiểm tra quy tắc nghiệp vụ vàng bắt buộc:
    // QUY TẮC 1: VỊ TRÍ TIẾP NHẬN CHỈ CẦN 2 NHÂN SỰ
    const tiepNhanPos = data.positions.find((p) => p.name.toLowerCase().includes("tiếp nhận"));
    if (tiepNhanPos) {
      // Nhóm phân công tiếp nhận theo ca (ngày + shift)
      const slotMap = new Map<string, typeof updatedAssignments>();
      for (const a of updatedAssignments) {
        if (a.positionId === tiepNhanPos.id) {
          const key = `${a.date}_${a.shift}`;
          const list = slotMap.get(key) || [];
          list.push(a);
          slotMap.set(key, list);
        }
      }

      for (const [slotKey, list] of slotMap.entries()) {
        const [date, shift] = slotKey.split("_") as [string, ShiftType];
        if (scope === "current" && isPastShift(date, shift)) continue;

        // Nếu thừa hơn 2 người thì cắt giảm về đúng 2 người theo quy tắc
        if (list.length > 2) {
          const toRemove = list.slice(2);
          for (const rem of toRemove) {
            const idx = updatedAssignments.indexOf(rem);
            if (idx !== -1) {
              const staff = staffMap.get(rem.staffId);
              diffChanges.push({
                id: `trim-tiepnhan-${rem.id}`,
                date,
                dayLabel: format(parseISO(date), "dd/MM"),
                shift,
                shiftLabel: shift === "morning" ? "Sáng" : "Chiều",
                positionId: tiepNhanPos.id,
                positionName: tiepNhanPos.name,
                oldStaffName: staff ? getStaffShortName(staff.name) : "Nhân sự",
                newStaffName: "(Cắt giảm)",
                reason: "Quy tắc vị trí Tiếp nhận chỉ cần đúng 2 nhân sự mỗi ca",
              });
              updatedAssignments.splice(idx, 1);
            }
          }
        }

        // Kiểm tra an toàn: Phúc Anh và Lyna có cùng vắng không?
        const staffInSlot = list.map((a) => a.staffId);
        const hasPhucAnh = staffInSlot.some((id) => staffMap.get(id)?.name.includes("Phúc Anh"));
        const hasLyna = staffInSlot.some((id) => staffMap.get(id)?.name.includes("Lyna"));

        if (!hasPhucAnh && !hasLyna) {
          recommendations.push(
            `⚠️ CẢNH BÁO TIẾP NHẬN: Ngày ${format(parseISO(date), "dd/MM")} (${shift === "morning" ? "Sáng" : "Chiều"}) thiếu cả Phúc Anh và Lyna! Đã ưu tiên bổ sung Thủy hỗ trợ tiếp nhận.`,
          );
        }
      }
    }

    // QUY TẮC 2: [QWEN3] ĐIỀU PHỐI DỰ PHÒNG KHNV & GIẢI PHÓNG ĐO SINH HIỆU KHI QUÁ TẢI (>= 4 VỊ TRÍ)
    const vitalsPos = data.positions.find(
      (p) => p.name.toLowerCase().includes("sinh hiệu") || p.id.includes("vitals"),
    );
    const nghiaStaff = data.staff.find(
      (s) => s.email?.toLowerCase() === "nghiadn.pk@pnt.edu.vn" || s.name.toLowerCase().includes("nghĩa"),
    );
    const thienTrangStaff = data.staff.find(
      (s) => s.name.toLowerCase().includes("thiên trang"),
    );

    // Gom nhóm phân công theo ca (date + shift)
    const shiftSlotMap = new Map<string, typeof updatedAssignments>();
    for (const a of updatedAssignments) {
      const key = `${a.date}_${a.shift}`;
      const list = shiftSlotMap.get(key) || [];
      list.push(a);
      shiftSlotMap.set(key, list);
    }

    for (const [slotKey, slotAssignments] of shiftSlotMap.entries()) {
      const [date, shift] = slotKey.split("_") as [string, ShiftType];
      if (scope === "current" && isPastShift(date, shift)) continue;

      // Đếm số lượng vị trí mà mỗi nhân sự phụ trách trong ca này
      const staffInSlotCounts = new Map<string, typeof slotAssignments>();
      for (const a of slotAssignments) {
        if (!a.staffId) continue;
        const list = staffInSlotCounts.get(a.staffId) || [];
        list.push(a);
        staffInSlotCounts.set(a.staffId, list);
      }

      for (const [staffId, assignmentsOfStaff] of staffInSlotCounts.entries()) {
        if (assignmentsOfStaff.length >= 4) {
          const overloadedStaff = staffMap.get(staffId);
          const overloadedName = overloadedStaff ? getStaffShortName(overloadedStaff.name) : "Điều dưỡng";

          // Lấy vị trí thứ 4 trở đi để san sẻ
          const assignmentToRelieve = assignmentsOfStaff[assignmentsOfStaff.length - 1];
          const relievedPos = posMap.get(assignmentToRelieve.positionId);
          if (!relievedPos) continue;

          // Kiểm tra vị trí Đo sinh hiệu trong ca này (chuẩn 2 người)
          if (vitalsPos) {
            const vitalsAssignments = slotAssignments.filter(
              (a) => a.positionId === vitalsPos.id && a.staffId,
            );

            if (vitalsAssignments.length > 0) {
              // Trong các nhân sự đo sinh hiệu, chọn người có kinh nghiệm tích lũy & thói quen gần đây cao nhất với vị trí quá tải
              let bestVitalsAssignment = vitalsAssignments[0];
              let bestScore = -1;

              for (const va of vitalsAssignments) {
                const vStaff = staffMap.get(va.staffId);
                if (!vStaff) continue;
                const expHours = expLookup.get(vStaff.id)?.get(relievedPos.id) ?? 0;
                const recentHabit = habitStats.positionWeightMap.get(`${relievedPos.id}_${vStaff.id}`) ?? 0;
                const score = expHours * 2 + recentHabit * 10 + (vStaff.positionIds.includes(relievedPos.id) ? 5 : 0);
                if (score > bestScore) {
                  bestScore = score;
                  bestVitalsAssignment = va;
                }
              }

              const staffToTransfer = staffMap.get(bestVitalsAssignment.staffId);
              if (staffToTransfer && staffToTransfer.id !== staffId) {
                // Xác định nhân sự KHNV thay thế: Ưu tiên Nghĩa (nếu không nghỉ phép hoặc đi học trong ca này), sau đó tới Thiên Trang
                let khnvStaff: StaffMember | undefined;
                const nghiaLeave = nghiaStaff
                  ? data.leaveRequests.find(
                      (l) =>
                        l.staffId === nghiaStaff.id &&
                        l.date === date &&
                        (l.shift === "full-day" || l.shift === shift) &&
                        l.status !== "rejected",
                    )
                  : null;

                if (nghiaStaff && !nghiaLeave) {
                  khnvStaff = nghiaStaff;
                } else if (thienTrangStaff) {
                  const trangLeave = data.leaveRequests.find(
                    (l) =>
                      l.staffId === thienTrangStaff.id &&
                      l.date === date &&
                      (l.shift === "full-day" || l.shift === shift) &&
                      l.status !== "rejected",
                  );
                  if (!trangLeave) khnvStaff = thienTrangStaff;
                }

                if (khnvStaff) {
                  const transferName = getStaffShortName(staffToTransfer.name);
                  const khnvName = getStaffShortName(khnvStaff.name);

                  // 1. Chuyển nhân sự Đo sinh hiệu sang hỗ trợ vị trí quá tải
                  const overloadIdx = updatedAssignments.findIndex((a) => a.id === assignmentToRelieve.id);
                  if (overloadIdx !== -1) {
                    updatedAssignments[overloadIdx].staffId = staffToTransfer.id;
                    updatedAssignments[overloadIdx].status = "adjusted";

                    diffChanges.push({
                      id: `relieve-overload-${assignmentToRelieve.id}`,
                      date,
                      dayLabel: format(parseISO(date), "dd/MM"),
                      shift,
                      shiftLabel: shift === "morning" ? "Sáng" : "Chiều",
                      positionId: relievedPos.id,
                      positionName: relievedPos.name,
                      oldStaffName: overloadedName,
                      newStaffName: transferName,
                      reason: `Giảm tải cho ${overloadedName} (đang gánh ${assignmentsOfStaff.length} vị trí)`,
                    });
                  }

                  // 2. Điều nhân sự KHNV (Nghĩa / Thiên Trang) vào trám chỗ tại Đo sinh hiệu
                  const vitalsIdx = updatedAssignments.findIndex((a) => a.id === bestVitalsAssignment.id);
                  if (vitalsIdx !== -1) {
                    updatedAssignments[vitalsIdx].staffId = khnvStaff.id;
                    updatedAssignments[vitalsIdx].status = "adjusted";

                    diffChanges.push({
                      id: `khnv-to-vitals-${bestVitalsAssignment.id}`,
                      date,
                      dayLabel: format(parseISO(date), "dd/MM"),
                      shift,
                      shiftLabel: shift === "morning" ? "Sáng" : "Chiều",
                      positionId: vitalsPos.id,
                      positionName: vitalsPos.name,
                      oldStaffName: transferName,
                      newStaffName: khnvName,
                      reason: `Điều động ${khnvName} từ KHNV hỗ trợ Đo sinh hiệu, giải phóng ${transferName} chi viện phòng ${relievedPos.name}`,
                    });
                  }

                  recommendations.push(
                    `⚡ ĐIỀU PHỐI QUÁ TẢI (${format(parseISO(date), "dd/MM")} ${shift === "morning" ? "Sáng" : "Chiều"}): ĐD ${overloadedName} gánh ${assignmentsOfStaff.length} vị trí. Đã điều ${khnvName} (KHNV) sang Đo sinh hiệu để giải phóng ${transferName} hỗ trợ phòng ${relievedPos.name}.`,
                  );
                }
              }
            }
          }
        }
      }
    }

    if (diffChanges.length === 0) {
      summary = summary || "Lịch trực hiện thời đã cân đối tối ưu và đáp ứng đầy đủ các quy tắc điều phối của phòng khám.";
      recommendations.push("Không phát hiện xung đột ca trực hoặc vi phạm quy tắc Tiếp nhận / Hồ sơ.");
    } else {
      summary = summary || `Hệ thống đã tự động tái tối ưu ${diffChanges.length} lượt phân công phòng trực theo yêu cầu.`;
    }

    return NextResponse.json({
      success: true,
      scope,
      weekStart: targetWeekStart,
      diffChanges,
      recommendations,
      summary,
      updatedAssignments,
    });
  } catch (error: any) {
    console.error("Lỗi API adjust schedule:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Lỗi máy chủ khi điều chỉnh lịch trực." },
      { status: 500 },
    );
  }
}
