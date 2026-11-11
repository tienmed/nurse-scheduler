import { describe, expect, it } from "vitest";
import { DEFAULT_SCHEDULE_RULES } from "@/lib/constants";
import {
  applyClinicScheduleToPositionRules,
  fetchEffectivePositionRulesForWeek,
  parseScheduleEmbedHtml,
} from "@/lib/clinic-schedule-api";
import {
  buildSmartWeeklyAssignments,
  isLowVolumePosition,
  suggestStaffForSlot,
} from "@/lib/schedule";
import {
  createScheduleConfirmToken,
  verifyScheduleConfirmToken,
} from "@/lib/schedule-confirm-token";
import { buildWeeklyScheduleEmailHtml } from "@/lib/weekly-email-html";
import type {
  LeaveRecord as LeaveRecordType,
  Position as PositionType,
  StaffMember as StaffMemberType,
  TemplateAssignment as TemplateAssignmentType,
  WeeklyAssignment as WeeklyAssignmentType,
} from "@/lib/types";

describe("Smart Weekly Schedule, Confirm Token & Email HTML", () => {
  const staff: StaffMemberType[] = [
    {
      id: "st-hoa",
      name: "Nguyễn Kim Hoa",
      code: "DD01",
      email: "hoa@pnt.edu.vn",
      role: "viewer",
      positionIds: ["pos-dalieu", "pos-mat"],
      active: true,
      prefersOvertime: false,
    },
    {
      id: "st-hanh",
      name: "Trần Ngọc Hạnh",
      code: "DD02",
      email: "hanh@pnt.edu.vn",
      role: "viewer",
      positionIds: ["pos-dalieu", "pos-mat"],
      active: true,
      prefersOvertime: false,
    },
    {
      id: "st-pa",
      name: "Lê Phúc Anh",
      code: "DD20",
      email: "phucanh@pnt.edu.vn",
      role: "viewer",
      positionIds: ["pos-tiepnhan"],
      active: true,
      prefersOvertime: false,
    },
    {
      id: "st-lyna",
      name: "Lưu Đào Marry Lyna",
      code: "DD21",
      email: "lyna@pnt.edu.vn",
      role: "viewer",
      positionIds: ["pos-tiepnhan"],
      active: true,
      prefersOvertime: false,
    },
    {
      id: "st-thuy",
      name: "Trần Thanh Thủy",
      code: "DD11",
      email: "thuy@pnt.edu.vn",
      role: "viewer",
      positionIds: ["pos-tiepnhan", "pos-vitals"],
      active: true,
      prefersOvertime: false,
    },
    {
      id: "st-thinh",
      name: "Nguyễn Phú Thịnh",
      code: "DD10",
      email: "thinh@pnt.edu.vn",
      role: "viewer",
      positionIds: ["pos-ksk"],
      active: true,
      prefersOvertime: false,
    },
    {
      id: "st-tutrang",
      name: "Đặng Lê Tú Trang",
      code: "DD03",
      email: "tutrang@pnt.edu.vn",
      role: "viewer",
      positionIds: ["pos-khnv"],
      active: true,
      prefersOvertime: false,
    },
    {
      id: "st-nghia",
      name: "Đặng Nhân Nghĩa",
      code: "DD04",
      email: "nghiadn.pk@pnt.edu.vn",
      role: "coordinator",
      positionIds: ["pos-khnv"],
      active: true,
      prefersOvertime: false,
    },
    {
      id: "st-bs-tien",
      name: "Trịnh Trung Tiến",
      code: "BS",
      email: "tienmed@gmail.com",
      role: "admin",
      positionIds: [],
      active: true,
      prefersOvertime: false,
    },
  ];

  const positions: PositionType[] = [
    { id: "pos-dalieu", name: "Da liễu - CSD", area: "Tầng 1", quota: 1 },
    { id: "pos-tiepnhan", name: "Tiếp nhận", area: "Sảnh", quota: 2 },
    { id: "pos-ksk", name: "Nhập liệu KSK", area: "KSK", quota: 1 },
    { id: "pos-khnv", name: "Hành chính KHNV", area: "KHNV", quota: 1 },
  ];

  it("ưu tiên kinh nghiệm tích lũy và thói quen 1-2 tuần gần đây khi xếp lịch tuần sau", () => {
    const expPositions: PositionType[] = [
      { id: "pos-noithankinh", name: "Nội thần kinh", area: "Tầng 1", quota: 1 },
      { id: "pos-tiepnhan", name: "Tiếp nhận", area: "Sảnh", quota: 2 },
      { id: "pos-ksk", name: "Nhập liệu KSK", area: "KSK", quota: 1 },
      { id: "pos-khnv", name: "Hành chính KHNV", area: "KHNV", quota: 1 },
    ];

    // Lịch nền cũ ghi Ngọc Hạnh ở Nội thần kinh, nhưng 2 tuần gần đây & lịch sử kinh nghiệm Kim Hoa làm nhiều hơn hẳn
    const template: TemplateAssignmentType[] = [
      { id: "t1", dayOfWeek: 1, shift: "morning", positionId: "pos-noithankinh", staffId: "st-hanh", slotIndex: 0 },
      { id: "t2", dayOfWeek: 1, shift: "morning", positionId: "pos-tiepnhan", staffId: "st-pa", slotIndex: 0 },
      { id: "t3", dayOfWeek: 1, shift: "morning", positionId: "pos-tiepnhan", staffId: "st-lyna", slotIndex: 1 },
      { id: "t4", dayOfWeek: 1, shift: "morning", positionId: "pos-ksk", staffId: "st-thinh", slotIndex: 0 },
      { id: "t5", dayOfWeek: 1, shift: "morning", positionId: "pos-khnv", staffId: "st-tutrang", slotIndex: 0 },
    ];

    // Lịch sử 2 tuần trước (2026-11-02, 2026-11-09) cho thấy Kim Hoa trực liên tục
    const history: WeeklyAssignmentType[] = [
      {
        id: "h1",
        weekStart: "2026-11-02",
        date: "2026-11-02",
        shift: "morning",
        positionId: "pos-noithankinh",
        staffId: "st-hoa",
        source: "manual",
        status: "published",
      },
      {
        id: "h2",
        weekStart: "2026-11-09",
        date: "2026-11-09",
        shift: "morning",
        positionId: "pos-noithankinh",
        staffId: "st-hoa",
        source: "manual",
        status: "published",
      },
      {
        id: "h3",
        weekStart: "2026-11-09",
        date: "2026-11-10",
        shift: "morning",
        positionId: "pos-noithankinh",
        staffId: "st-hoa",
        source: "manual",
        status: "published",
      },
    ];

    const generated = buildSmartWeeklyAssignments({
      templateSchedule: template,
      positions: expPositions,
      staff,
      weeklySchedule: history,
      weekStart: "2026-11-16",
      leaveRequests: [],
      scheduleRules: DEFAULT_SCHEDULE_RULES,
      positionRules: [],
      holidays: [],
      initialStatus: "draft",
    });

    const monMorningNtk = generated.find(
      (g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "pos-noithankinh",
    );
    expect(monMorningNtk?.staffId).toBe("st-hoa");
    expect(monMorningNtk?.status).toBe("draft");
    expect(generated.some((g) => g.staffId === "st-bs-tien")).toBe(false);

    // Kiểm tra suggestStaffForSlot cũng ưu tiên Kim Hoa nhờ kinh nghiệm + thói quen và loại trừ BS/Admin
    const suggestions = suggestStaffForSlot(
      staff,
      expPositions,
      "2026-11-16",
      "morning",
      "pos-noithankinh",
      [],
      [],
      history,
    );
    expect(suggestions[0].staff.id).toBe("st-hoa");
    expect(suggestions.some((s) => s.staff.id === "st-bs-tien")).toBe(false);
  });

  it("tự động điều Thủy hỗ trợ Tiếp nhận khi Lyna nghỉ phép và giữ đúng 2 người/ca", () => {
    const template: TemplateAssignmentType[] = [
      { id: "t1", dayOfWeek: 2, shift: "morning", positionId: "pos-tiepnhan", staffId: "st-pa", slotIndex: 0 },
      { id: "t2", dayOfWeek: 2, shift: "morning", positionId: "pos-tiepnhan", staffId: "st-lyna", slotIndex: 1 },
    ];

    const leaves: LeaveRecordType[] = [
      {
        id: "lv1",
        staffId: "st-lyna",
        date: "2026-11-17",
        shift: "morning",
        reason: "phep",
        status: "approved",
      },
    ];

    const generated = buildSmartWeeklyAssignments({
      templateSchedule: template,
      positions,
      staff,
      weeklySchedule: [],
      weekStart: "2026-11-16",
      leaveRequests: leaves,
      scheduleRules: DEFAULT_SCHEDULE_RULES,
      positionRules: [],
      holidays: [],
      initialStatus: "draft",
    });

    const tueMorningTiepNhan = generated.filter(
      (g) => g.date === "2026-11-17" && g.shift === "morning" && g.positionId === "pos-tiepnhan",
    );
    expect(tueMorningTiepNhan).toHaveLength(2);
    const assignedIds = tueMorningTiepNhan.map((x) => x.staffId);
    expect(assignedIds).toContain("st-pa");
    expect(assignedIds).toContain("st-thuy");
    expect(assignedIds).not.toContain("st-lyna");
  });

  it("tạo và xác thực HMAC token chốt lịch chính xác", () => {
    const secret = "test-secret-key-for-vitest";
    const token = createScheduleConfirmToken("2026-11-16", secret);
    expect(verifyScheduleConfirmToken("2026-11-16", token, secret)).toBe(true);
    expect(verifyScheduleConfirmToken("2026-11-23", token, secret)).toBe(false);
    expect(verifyScheduleConfirmToken("2026-11-16", "invalid", secret)).toBe(false);
  });

  it("render HTML email 2 nửa tuần đúng nút xác nhận, link góp ý và không lộ tên/email người nhận", () => {
    const assignments: WeeklyAssignmentType[] = [
      {
        id: "a1",
        weekStart: "2026-11-16",
        date: "2026-11-16",
        shift: "morning",
        positionId: "pos-dalieu",
        staffId: "st-hoa",
        source: "template",
        status: "draft",
      },
      {
        id: "a2",
        weekStart: "2026-11-16",
        date: "2026-11-16",
        shift: "afternoon",
        positionId: "pos-dalieu",
        staffId: "st-hoa",
        source: "template",
        status: "draft",
      },
    ];

    const leaves: LeaveRecordType[] = [
      {
        id: "lv1",
        staffId: "st-lyna",
        date: "2026-11-17",
        shift: "morning",
        reason: "phep",
        status: "approved",
      },
    ];

    const { subject, html } = buildWeeklyScheduleEmailHtml({
      weekStart: "2026-11-16",
      positions,
      staff,
      assignments,
      leaveRequests: leaves,
      holidays: [],
      baseUrl: "https://nurse-scheduler-flax.vercel.app",
      confirmToken: "a".repeat(64),
    });

    expect(subject).toContain("16/11 - 21/11/2026");
    expect(html).toContain("PHẦN 1: THỨ 2 – THỨ 4");
    expect(html).toContain("PHẦN 2: THỨ 5 – THỨ 7");
    expect(html).toContain("Lyna (phép - S)");
    expect(html).toContain("https://nurse-scheduler-flax.vercel.app/api/schedule/confirm?week=2026-11-16&amp;token=");
    expect(html).toContain("https://nurse-scheduler-flax.vercel.app/room-assignment?week=2026-11-16&amp;openAdjust=1");
    expect(html).toContain("XÁC NHẬN CHỐT LỊCH CHÍNH THỨC");
    // Tuyệt đối không ghi tên/email người nhận Nghĩa hoặc Tiến trong nội dung email
    expect(html.toLowerCase()).not.toContain("nghiadn.pk@pnt.edu.vn");
    expect(html.toLowerCase()).not.toContain("tienmed@gmail.com");
    expect(html).not.toContain("Tiến");
    expect(html).not.toContain("Nghĩa");
  });

  it("đối chiếu schedule-embed: Chăm sóc da theo Da Liễu, CTCH/Cấp cứu mở theo BS, RHM tách riêng & fallback khi trống", () => {
    const sampleHtml = `
      <table>
        <tbody>
          <tr class="morning-row">
            <td><div class="clinic-name">Da Liễu</div></td>
            <td class="schedule-cell"><div class="doctor-name">BS A</div></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td>
          </tr>
          <tr class="afternoon-row">
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td>
          </tr>
          <tr class="morning-row">
            <td><div class="clinic-name">Phòng khám Cơ xương khớp - Y học thể dục thể thao</div></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"><div class="doctor-name">BS B</div></td>
            <td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td>
          </tr>
          <tr class="afternoon-row">
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td>
          </tr>
          <tr class="morning-row">
            <td><div class="clinic-name">Phòng khám Cấp cứu - Lưu bệnh - Tiểu phẫu</div></td>
            <td class="schedule-cell"><div class="doctor-name">BS C</div></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td>
          </tr>
          <tr class="afternoon-row">
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td>
          </tr>
          <tr class="morning-row">
            <td><div class="clinic-name">Phòng khám Răng Hàm Mặt</div></td>
            <td class="schedule-cell"><div class="doctor-name">BS RHM</div></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td>
          </tr>
          <tr class="afternoon-row">
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td><td class="schedule-cell"></td>
          </tr>
        </tbody>
      </table>
    `;

    const parsed = parseScheduleEmbedHtml(sampleHtml);
    expect(parsed.totalActiveDoctorSlots).toBe(4);

    const testPositions: PositionType[] = [
      { id: "position-phong-kham-da-lieu", name: "Phòng khám Da liễu (P2.6)", area: "Tầng 1" },
      { id: "position-phong-cham-soc-da", name: "Phòng Chăm sóc da (P2.4)", area: "Tầng 1" },
      { id: "position-phong-kham-ctch", name: "Phòng khám CTCH (P1.9)", area: "Trệt" },
      { id: "position-phong-cap-cuu", name: "Phòng cấp cứu (P1.7)", area: "Trệt" },
      { id: "position-phong-kham-rhm", name: "Phòng khám RHM (KTC)", area: "Khu KTC" },
    ];

    const syncRes = applyClinicScheduleToPositionRules(testPositions, [], parsed);
    expect(syncRes.synced).toBe(true);
    // Chăm sóc da đi theo Da Liễu (T2 sáng mở, T2 chiều đóng)
    expect(syncRes.forceOpenPositionSlots.has("1-morning-position-phong-cham-soc-da")).toBe(true);
    expect(syncRes.forceOpenPositionSlots.has("1-afternoon-position-phong-cham-soc-da")).toBe(false);
    // CTCH (T3 sáng mở)
    expect(syncRes.forceOpenPositionSlots.has("2-morning-position-phong-kham-ctch")).toBe(true);
    // Cấp cứu thường trực các buổi làm việc (không bị tắt bởi schedule-embed)
    expect(syncRes.effectivePositionRules.some((r) => r.positionId === "position-phong-cap-cuu" && r.active === false)).toBe(false);
    // RHM (KTC) tách riêng -> không bị force open theo Răng Hàm Mặt
    expect(syncRes.forceOpenPositionSlots.has("1-morning-position-phong-kham-rhm")).toBe(false);

    // Fallback khi schedule-embed chưa có ca bác sĩ nào
    const emptyFallback = applyClinicScheduleToPositionRules(testPositions, [], {
      totalActiveDoctorSlots: 0,
      clinicActiveSlots: new Map(),
    });
    expect(emptyFallback.synced).toBe(false);
  });

  it("mặc nhiên phân Mỹ Nhiên cho cả Chăm sóc da (P2.4) và Da liễu (P2.6); chỉ phân người khác khi Nhiên nghỉ phép", () => {
    const dermStaff: StaffMemberType[] = [
      ...staff,
      {
        id: "st-nhien",
        name: "Đoàn Thị Mỹ Nhiên",
        code: "DD06",
        email: "nhien@pnt.edu.vn",
        role: "viewer",
        positionIds: ["position-phong-cham-soc-da", "position-phong-kham-da-lieu"],
        active: true,
        prefersOvertime: true,
      },
    ];

    const dermPositions: PositionType[] = [
      { id: "position-phong-cham-soc-da", name: "Phòng Chăm sóc da (P2.4)", area: "Tầng 1", quota: 1 },
      { id: "position-phong-kham-da-lieu", name: "Phòng khám Da liễu (P2.6)", area: "Tầng 1", quota: 1 },
    ];

    const dermTemplate: TemplateAssignmentType[] = [
      { id: "td1", dayOfWeek: 1, shift: "morning", positionId: "position-phong-cham-soc-da", staffId: "st-hoa", slotIndex: 0 },
      { id: "td2", dayOfWeek: 1, shift: "morning", positionId: "position-phong-kham-da-lieu", staffId: "st-hanh", slotIndex: 0 },
      { id: "td3", dayOfWeek: 2, shift: "morning", positionId: "position-phong-cham-soc-da", staffId: "st-nhien", slotIndex: 0 },
      { id: "td4", dayOfWeek: 2, shift: "morning", positionId: "position-phong-kham-da-lieu", staffId: "st-nhien", slotIndex: 0 },
    ];

    const leaves: LeaveRecordType[] = [
      {
        id: "lv-nhien",
        staffId: "st-nhien",
        date: "2026-11-17", // Thứ 3 nghỉ phép
        shift: "morning",
        reason: "phep",
        status: "approved",
      },
    ];

    const generated = buildSmartWeeklyAssignments({
      templateSchedule: dermTemplate,
      positions: dermPositions,
      staff: dermStaff,
      weeklySchedule: [],
      weekStart: "2026-11-16",
      leaveRequests: leaves,
      scheduleRules: DEFAULT_SCHEDULE_RULES,
      positionRules: [],
      holidays: [],
      initialStatus: "draft",
    });

    // Thứ 2 (không nghỉ): Cả 2 phòng đều là Mỹ Nhiên dù template cũ ghi người khác
    const monCsd = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-cham-soc-da");
    const monDaLieu = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-kham-da-lieu");
    expect(monCsd?.staffId).toBe("st-nhien");
    expect(monDaLieu?.staffId).toBe("st-nhien");

    // Thứ 3 (Nhiên nghỉ phép): Phân điều dưỡng khác và PHẢI đi đồng bộ cùng 1 người cho cả 2 phòng
    const tueCsd = generated.find((g) => g.date === "2026-11-17" && g.shift === "morning" && g.positionId === "position-phong-cham-soc-da");
    const tueDaLieu = generated.find((g) => g.date === "2026-11-17" && g.shift === "morning" && g.positionId === "position-phong-kham-da-lieu");
    expect(tueCsd?.staffId).not.toBe("");
    expect(tueCsd?.staffId).not.toBe("st-nhien");
    expect(tueDaLieu?.staffId).not.toBe("");
    expect(tueDaLieu?.staffId).not.toBe("st-nhien");
    expect(tueCsd?.staffId).toBe(tueDaLieu?.staffId);
  });

  it("Siêu âm thường trực là Bích Thảo (hỗ trợ Lyna khi cần), Chuyên gia thường là Kim Hoa", () => {
    const extraStaff: StaffMemberType[] = [
      ...staff,
      {
        id: "st-thao",
        name: "Nguyễn Thị Bích Thảo",
        code: "DD09",
        email: "thao@pnt.edu.vn",
        role: "viewer",
        positionIds: ["position-phong-sieu-am"],
        active: true,
        prefersOvertime: true,
      },
    ];

    const extraPositions: PositionType[] = [
      { id: "position-phong-sieu-am", name: "Phòng Siêu âm (P1.6)", area: "Trệt", quota: 1 },
      { id: "position-phong-kham-chuyen-gia", name: "Phòng khám Chuyên gia", area: "Tầng 2", quota: 1 },
    ];

    const extraTemplate: TemplateAssignmentType[] = [
      { id: "te1", dayOfWeek: 1, shift: "morning", positionId: "position-phong-sieu-am", staffId: "st-hanh", slotIndex: 0 },
      { id: "te2", dayOfWeek: 1, shift: "morning", positionId: "position-phong-kham-chuyen-gia", staffId: "st-hanh", slotIndex: 0 },
    ];

    const generated = buildSmartWeeklyAssignments({
      templateSchedule: extraTemplate,
      positions: extraPositions,
      staff: extraStaff,
      weeklySchedule: [],
      weekStart: "2026-11-16",
      leaveRequests: [],
      scheduleRules: DEFAULT_SCHEDULE_RULES,
      positionRules: [],
      holidays: [],
      initialStatus: "draft",
    });

    const monSieuAm = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-sieu-am");
    const monChuyenGia = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-kham-chuyen-gia");
    expect(monSieuAm?.staffId).toBe("st-thao");
    expect(monChuyenGia?.staffId).toBe("st-hoa");
  });

  it("tuần sau chưa có lịch bác sĩ trên schedule-embed thì áp lịch mở phòng của tuần trước (tuần này)", async () => {
    const posList: PositionType[] = [
      { id: "position-phong-kham-da-lieu", name: "Phòng khám Da liễu (P2.6)", area: "Tầng 1", quota: 1 },
      { id: "position-phong-cham-soc-da", name: "Phòng Chăm sóc da (P2.4)", area: "Tầng 1", quota: 1 },
    ];

    const currentWeekParsed = parseScheduleEmbedHtml(`
      <table>
        <tbody>
          <tr class="morning-row">
            <td><div class="clinic-name">Da Liễu</div></td>
            <td class="schedule-cell"><div class="doctor-name">BS Da Liễu</div></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td>
          </tr>
          <tr class="afternoon-row">
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td>
            <td class="schedule-cell"></td>
          </tr>
        </tbody>
      </table>
    `);

    const result = await fetchEffectivePositionRulesForWeek("2026-11-16", posList, [], {
      fetcher: async (week) => {
        if (week === "2026-11-16") return { totalActiveDoctorSlots: 0, clinicActiveSlots: new Map() };
        if (week === "2026-11-09") return currentWeekParsed;
        return null;
      },
    });

    expect(result.synced).toBe(false);
    expect(result.fallbackSource).toBe("previous-week");
    expect(result.sourceWeekStart).toBe("2026-11-09");
    expect(result.totalActiveDoctorSlots).toBe(1);
    expect(result.forceOpenPositionSlots.has("1-morning-position-phong-kham-da-lieu")).toBe(true);
    expect(result.forceOpenPositionSlots.has("1-morning-position-phong-cham-soc-da")).toBe(true);
    expect(result.forceOpenPositionSlots.has("1-afternoon-position-phong-kham-da-lieu")).toBe(false);
  });

  it("Thanh Trùng và Phòng khám YHCT (P2.5) mặc nhiên là ĐD Nhân (DD16), khi nghỉ/thay đổi có Điệp hỗ trợ; đồng thời bỏ Phòng khám RHM (KTC)", () => {
    const ttStaff: StaffMemberType[] = [
      ...staff,
      {
        id: "st-nhan",
        name: "Lê Thị Nhân",
        code: "DD16",
        email: "dd16@gmail.com",
        role: "viewer",
        positionIds: ["position-thanh-trung", "position-yhct"],
        active: true,
        prefersOvertime: false,
      },
      {
        id: "st-diep",
        name: "Nguyễn Thị Ngọc Điệp",
        code: "DD07",
        email: "diep@pnt.edu.vn",
        role: "viewer",
        positionIds: ["position-phong-kham-tmh"],
        active: true,
        prefersOvertime: false,
      },
      {
        id: "st-nghia-test",
        name: "Đặng Nhân Nghĩa",
        code: "DD17",
        email: "nghiadn.pk@pnt.edu.vn",
        role: "coordinator",
        positionIds: ["position-khnv", "position-tiep-nhan"],
        active: true,
        prefersOvertime: true,
      },
    ];

    const ttPositions: PositionType[] = [
      { id: "position-thanh-trung", name: "Thanh Trùng", area: "Tầng 1 (cánh P)", quota: 1 },
      { id: "position-yhct", name: "Phòng khám YHCT (P2.5)", area: "Tầng 1 (cánh T)", quota: 1 },
      { id: "position-phong-kham-rhm", name: "Phòng khám RHM (KTC)", area: "Khu KTC", quota: 1 },
    ];

    const ttTemplate: TemplateAssignmentType[] = [
      { id: "tt1", dayOfWeek: 1, shift: "morning", positionId: "position-thanh-trung", staffId: "st-hanh", slotIndex: 0 },
      { id: "tyh1", dayOfWeek: 1, shift: "morning", positionId: "position-yhct", staffId: "st-hanh", slotIndex: 0 },
      { id: "tt2", dayOfWeek: 2, shift: "morning", positionId: "position-thanh-trung", staffId: "st-nhan", slotIndex: 0 },
      { id: "tyh2", dayOfWeek: 2, shift: "morning", positionId: "position-yhct", staffId: "st-nhan", slotIndex: 0 },
      { id: "trhm", dayOfWeek: 1, shift: "morning", positionId: "position-phong-kham-rhm", staffId: "st-diep", slotIndex: 0 },
    ];

    const leaves: LeaveRecordType[] = [
      {
        id: "lv-nhan",
        staffId: "st-nhan",
        date: "2026-11-17",
        shift: "morning",
        reason: "phep",
        status: "approved",
      },
    ];

    const generated = buildSmartWeeklyAssignments({
      templateSchedule: ttTemplate,
      positions: ttPositions,
      staff: ttStaff,
      weeklySchedule: [],
      weekStart: "2026-11-16",
      leaveRequests: leaves,
      scheduleRules: DEFAULT_SCHEDULE_RULES,
      positionRules: [],
      holidays: [],
      initialStatus: "draft",
    });

    const monThanhTrung = generated.find(
      (g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-thanh-trung",
    );
    const monYhct = generated.find(
      (g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-yhct",
    );
    const tueThanhTrung = generated.find(
      (g) => g.date === "2026-11-17" && g.shift === "morning" && g.positionId === "position-thanh-trung",
    );
    const tueYhct = generated.find(
      (g) => g.date === "2026-11-17" && g.shift === "morning" && g.positionId === "position-yhct",
    );
    const rhmGenerated = generated.filter((g) => g.positionId === "position-phong-kham-rhm");

    expect(monThanhTrung?.staffId).toBe("st-nhan");
    expect(monYhct?.staffId).toBe("st-nhan");
    expect(tueThanhTrung?.staffId).toBe("st-diep");
    expect(tueYhct?.staffId).toBe("st-diep");
    expect(rhmGenerated).toHaveLength(0);

    const rendered = buildWeeklyScheduleEmailHtml({
      weekStart: "2026-11-16",
      positions: ttPositions,
      staff: ttStaff,
      assignments: generated,
      leaveRequests: leaves,
      scheduleRules: DEFAULT_SCHEDULE_RULES,
      positionRules: [],
      holidays: [],
      baseUrl: "https://nurse-scheduler-flax.vercel.app",
      confirmToken: "tok",
    });

    expect(rendered.html).toContain("Thanh Trùng");
    expect(rendered.html).not.toContain("Phòng khám RHM (KTC)");
  });

  it("cố định Ngọc Hạnh (Cấp cứu/ECG), Nga (CTCH/Nội 1), Vĩnh (Phụ-Sản/Ngoại/Nội 2) và xoay Tiếp nhận đều giữa Lyna, Phúc Anh, Thủy", () => {
    const rotStaff: StaffMemberType[] = [
      ...staff,
      {
        id: "st-nga",
        name: "Nhữ Thị Phương Nga",
        code: "DD04",
        email: "nga@pnt.edu.vn",
        role: "viewer",
        positionIds: ["position-phong-kham-ctch", "position-phong-kham-noi-1"],
        active: true,
        prefersOvertime: false,
      },
      {
        id: "st-vinh",
        name: "Nguyễn Thị Vĩnh",
        code: "DD05",
        email: "vinh@pnt.edu.vn",
        role: "viewer",
        positionIds: ["position-phong-kham-phu-san", "position-phong-kham-ngoai", "position-phong-kham-noi-2"],
        active: true,
        prefersOvertime: false,
      },
    ];

    const rotPositions: PositionType[] = [
      { id: "pos-tiepnhan", name: "Tiếp nhận", area: "Sảnh", quota: 2 },
      { id: "position-phong-cap-cuu", name: "Phòng cấp cứu (P1.7)", area: "Trệt (cánh P)", quota: 1 },
      { id: "position-phong-o-ecg", name: "Phòng đo ECG (P1.8)", area: "Trệt (cánh P)", quota: 1 },
      { id: "position-phong-kham-ctch", name: "Phòng khám CTCH (P1.9)", area: "Trệt (cánh P)", quota: 1 },
      { id: "position-phong-kham-noi-1", name: "Phòng khám Nội 1 (P.13)", area: "Trệt (cánh P)", quota: 1 },
      { id: "position-phong-kham-phu-san", name: "Phòng khám Phụ - Sản (P1.12)", area: "Trệt (cánh P)", quota: 1 },
      { id: "position-phong-kham-ngoai", name: "Phòng khám Ngoại (P1.11)", area: "Trệt (cánh P)", quota: 1 },
      { id: "position-phong-kham-noi-2", name: "Phòng khám Nội 2 (P1.10)", area: "Trệt (cánh P)", quota: 1 },
    ];

    const generated = buildSmartWeeklyAssignments({
      templateSchedule: [],
      positions: rotPositions,
      staff: rotStaff,
      weeklySchedule: [],
      weekStart: "2026-11-16",
      leaveRequests: [],
      scheduleRules: DEFAULT_SCHEDULE_RULES,
      positionRules: [],
      holidays: [],
      initialStatus: "draft",
    });

    const monCapCuu = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-cap-cuu");
    const monEcg = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-o-ecg");
    const monCtch = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-kham-ctch");
    const monNoi1 = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-kham-noi-1");
    const monPhuSan = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-kham-phu-san");
    const monNgoai = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-kham-ngoai");
    const monNoi2 = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-kham-noi-2");

    expect(monCapCuu?.staffId).toBe("st-hanh");
    expect(monEcg?.staffId).toBe("st-hanh");
    expect(monCtch?.staffId).toBe("st-nga");
    expect(monNoi1?.staffId).toBe("st-nga");
    expect(monPhuSan?.staffId).toBe("st-vinh");
    expect(monNgoai?.staffId).toBe("st-vinh");
    expect(monNoi2?.staffId).toBe("st-vinh");

    // Tiếp nhận cả tuần (10 ca * 2 slot = 20 slot) xoay đều giữa PA, Lyna, Thủy
    const tiepNhanRows = generated.filter((g) => g.positionId === "pos-tiepnhan");
    expect(tiepNhanRows).toHaveLength(20);
    const tnCounts = new Map<string, number>();
    for (const row of tiepNhanRows) {
      expect(["st-pa", "st-lyna", "st-thuy"]).toContain(row.staffId);
      tnCounts.set(row.staffId, (tnCounts.get(row.staffId) ?? 0) + 1);
    }
    expect(tnCounts.get("st-pa")).toBeGreaterThanOrEqual(6);
    expect(tnCounts.get("st-lyna")).toBeGreaterThanOrEqual(6);
    expect(tnCounts.get("st-thuy")).toBeGreaterThanOrEqual(6);
  });

  it("nhóm TTK -> Điệp/Thủy/Ái/Chuyền; Mắt -> Chuyền/Thủy/Ái; TMH -> Điệp/Ái/Thủy/Chuyền; Da liễu dự phòng Nhiên/Ái/Thủy", () => {
    const specStaff: StaffMemberType[] = [
      ...staff,
      {
        id: "st-diep",
        name: "Nguyễn Thị Ngọc Điệp",
        code: "DD07",
        email: "diep@pnt.edu.vn",
        role: "viewer",
        positionIds: ["position-phong-kham-ttk", "position-phong-kham-tmh"],
        active: true,
        prefersOvertime: false,
      },
      {
        id: "st-chuyen",
        name: "Nguyễn Thị Kim Chuyền",
        code: "DD08",
        email: "chuyen@pnt.edu.vn",
        role: "viewer",
        positionIds: ["position-phong-kham-mat"],
        active: true,
        prefersOvertime: false,
      },
      {
        id: "st-lien",
        name: "Nguyễn Ngọc Ái Liên",
        code: "DD12",
        email: "lien@pnt.edu.vn",
        role: "viewer",
        positionIds: ["position-phong-kham-tmh", "position-phong-kham-mat"],
        active: true,
        prefersOvertime: false,
      },
      {
        id: "st-nhien",
        name: "Đoàn Thị Mỹ Nhiên",
        code: "DD06",
        email: "nhien@pnt.edu.vn",
        role: "viewer",
        positionIds: ["position-phong-kham-da-lieu", "position-phong-cham-soc-da"],
        active: true,
        prefersOvertime: false,
      },
    ];

    const specPositions: PositionType[] = [
      { id: "position-phong-kham-ttk", name: "Phòng khám Tâm thần kinh - Tâm lý", area: "Tầng 1 (cánh P)", quota: 1 },
      { id: "position-phong-kham-mat", name: "Phòng khám Mắt (P2.3)", area: "Tầng 1 (cánh T)", quota: 1 },
      { id: "position-phong-kham-tmh", name: "Phòng khám TMH (P2.7)", area: "Tầng 1 (cánh P)", quota: 1 },
      { id: "position-phong-cham-soc-da", name: "Phòng Chăm sóc da (P2.4)", area: "Tầng 1 (cánh T)", quota: 1 },
      { id: "position-phong-kham-da-lieu", name: "Phòng khám Da liễu (P2.6)", area: "Tầng 1 (cánh T)", quota: 1 },
    ];

    const leaves: LeaveRecordType[] = [
      {
        id: "lv-nhien-tue",
        staffId: "st-nhien",
        date: "2026-11-17", // Thứ 3 Nhiên nghỉ phép -> ưu tiên Ái Liên / Thủy đồng bộ CSD & Da liễu
        shift: "morning",
        reason: "phep",
        status: "approved",
      },
    ];

    const generated = buildSmartWeeklyAssignments({
      templateSchedule: [],
      positions: specPositions,
      staff: specStaff,
      weeklySchedule: [],
      weekStart: "2026-11-16",
      leaveRequests: leaves,
      scheduleRules: DEFAULT_SCHEDULE_RULES,
      positionRules: [],
      holidays: [],
      initialStatus: "draft",
    });

    const monTtk = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-kham-ttk");
    const monMat = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-kham-mat");
    const monTmh = generated.find((g) => g.date === "2026-11-16" && g.shift === "morning" && g.positionId === "position-phong-kham-tmh");
    const tueDaLieu = generated.find((g) => g.date === "2026-11-17" && g.shift === "morning" && g.positionId === "position-phong-kham-da-lieu");
    const tueCsd = generated.find((g) => g.date === "2026-11-17" && g.shift === "morning" && g.positionId === "position-phong-cham-soc-da");

    expect(monTtk?.staffId).toBe("st-diep");
    expect(["st-chuyen", "st-thuy", "st-lien"]).toContain(monMat?.staffId);
    expect(["st-diep", "st-lien", "st-thuy", "st-chuyen"]).toContain(monTmh?.staffId);
    expect(tueDaLieu?.staffId).toBe(tueCsd?.staffId);
    expect(tueDaLieu?.staffId).toBe("st-lien");
  });

  it("nhận diện đúng 5 phòng ít bệnh (Ngoại, Chuyên gia, Miễn dịch, Nội TK, Phụ khoa) và gợi ý kiêm nhiệm nhẹ nhàng", () => {
    const lowPos: PositionType[] = [
      { id: "position-phong-kham-ngoai", name: "Phòng khám Ngoại (P1.11)", area: "Trệt", quota: 1 },
      { id: "position-phong-kham-chuyen-gia", name: "Phòng khám Chuyên gia", area: "Tầng 2", quota: 1 },
      { id: "pos-1775185718350-um0fc", name: "Dị ứng - Miễn dịch", area: "Tầng 2", quota: 1 },
      { id: "position-noi-than-kinh", name: "Nội thần kinh (P2.2)", area: "Tầng 1", quota: 1 },
      { id: "position-phong-kham-phu-san", name: "Phòng khám Phụ - Sản (P1.12)", area: "Trệt", quota: 1 },
      { id: "position-phong-kham-noi-1", name: "Phòng khám Nội 1 (P.13)", area: "Trệt", quota: 1 },
    ];

    expect(isLowVolumePosition(lowPos[0])).toBe(true);
    expect(isLowVolumePosition(lowPos[1])).toBe(true);
    expect(isLowVolumePosition(lowPos[2])).toBe(true);
    expect(isLowVolumePosition(lowPos[3])).toBe(true);
    expect(isLowVolumePosition(lowPos[4])).toBe(true);
    expect(isLowVolumePosition(lowPos[5])).toBe(false);

    const existingShift: WeeklyAssignmentType[] = [
      {
        id: "w-cg",
        weekStart: "2026-11-16",
        date: "2026-11-16",
        shift: "morning",
        positionId: "position-phong-kham-chuyen-gia",
        staffId: "st-hoa",
        source: "template",
        status: "draft",
      },
    ];
    const suggestions = suggestStaffForSlot(
      staff,
      lowPos,
      "2026-11-16",
      "morning",
      "pos-1775185718350-um0fc",
      [],
      [],
      existingShift,
    );
    const hoaSuggestion = suggestions.find((s) => s.staff.id === "st-hoa");
    expect(hoaSuggestion?.reasons.some((r) => r.includes("Phòng ít bệnh"))).toBe(true);
  });
});
