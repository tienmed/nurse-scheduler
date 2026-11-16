import { describe, expect, it } from "vitest";
import {
  isIntraWeekDate,
  generateLeaveSubstitutionPlan,
  renderSubstitutionPlanHtml,
} from "@/lib/substitution-logic";
import { ADMIN_APPROVER_EMAIL, NOTIFY_BCC_EMAIL } from "@/lib/email-service";
import type {
  StaffMember,
  Position,
  WeeklyAssignment,
  TemplateAssignment,
  LeaveRecord,
} from "@/lib/types";

describe("[QWEN3] Intra-Week Leave Substitution Plan (substitution-logic.ts)", () => {
  const refDate = new Date("2026-11-16T08:00:00Z"); // Thứ 2, tuần 2026-11-16
  const monDate = "2026-11-16"; // Thứ 2 (trong tuần)
  const tueDate = "2026-11-17"; // Thứ 3 (trong tuần)
  const nextMonDate = "2026-11-23"; // Thứ 2 tuần sau (ngoài tuần)

  const mockStaff: StaffMember[] = [
    {
      id: "st-thao",
      name: "Trần Bích Thảo",
      code: "DD09",
      email: "thao@test.com",
      role: "viewer",
      positionIds: ["pos-sieuam"],
      active: true,
      prefersOvertime: false,
    },
    {
      id: "st-lyna",
      name: "Nguyễn Lyna",
      code: "DD21",
      email: "lyna@test.com",
      role: "viewer",
      positionIds: ["pos-sieuam", "pos-tiepnhan"],
      active: true,
      prefersOvertime: false,
    },
    {
      id: "st-pa",
      name: "Lê Phúc Anh",
      code: "DD20",
      email: "pa@test.com",
      role: "viewer",
      positionIds: ["pos-tiepnhan"],
      active: true,
      prefersOvertime: false,
    },
    {
      id: "st-thuy",
      name: "Đỗ Thị Thu Thủy",
      code: "DD11",
      email: "thuy@test.com",
      role: "viewer",
      positionIds: ["pos-tiepnhan"],
      active: true,
      prefersOvertime: false,
    },
    {
      id: "st-nhien",
      name: "Đoàn Thị Mỹ Nhiên",
      code: "DD06",
      email: "nhien@test.com",
      role: "viewer",
      positionIds: ["pos-dalieu", "pos-csd"],
      active: true,
      prefersOvertime: false,
    },
    {
      id: "st-ailien",
      name: "Trần Ái Liên",
      code: "DD12",
      email: "ailien@test.com",
      role: "viewer",
      positionIds: ["pos-dalieu", "pos-csd"],
      active: true,
      prefersOvertime: false,
    },
  ];

  const mockPositions: Position[] = [
    {
      id: "pos-sieuam",
      name: "Phòng Siêu âm (P1.6)",
      area: "Khu vực 1",
      staffOrder: ["st-thao", "st-lyna"],
    },
    {
      id: "pos-tiepnhan",
      name: "Bàn Tiếp nhận",
      area: "Sảnh",
      staffOrder: ["st-lyna", "st-pa", "st-thuy"],
    },
    {
      id: "pos-dalieu",
      name: "Phòng khám Da liễu (P2.6)",
      area: "Khu vực 2",
      staffOrder: ["st-nhien", "st-ailien"],
    },
  ];

  describe("1. Kiểm tra nhận diện ngày trong tuần (isIntraWeekDate)", () => {
    it("Nhận diện đúng ngày Thứ 2 và Thứ 3 là trong tuần hiện tại", () => {
      expect(isIntraWeekDate(monDate, refDate)).toBe(true);
      expect(isIntraWeekDate(tueDate, refDate)).toBe(true);
    });

    it("Nhận diện ngày tuần sau không thuộc tuần hiện tại", () => {
      expect(isIntraWeekDate(nextMonDate, refDate)).toBe(false);
    });
  });

  describe("2. Kế hoạch thay thế cho ca nghỉ phép đột xuất (generateLeaveSubstitutionPlan)", () => {
    it("Không kích hoạt kế hoạch thay thế khi ca nghỉ rơi vào tuần sau và chưa có lịch tuần", () => {
      const plan = generateLeaveSubstitutionPlan({
        slots: [{ date: nextMonDate, shift: "morning" }],
        targetStaff: mockStaff[0],
        staff: mockStaff,
        positions: mockPositions,
        weeklySchedule: [],
        templateSchedule: [],
        leaveRequests: [],
        referenceDate: refDate,
      });

      expect(plan.hasIntraWeekSlots).toBe(false);
      expect(plan.items.length).toBe(0);
    });

    it("Phát hiện ca trong tuần nhưng nhân sự không có lịch phân công trực", () => {
      const plan = generateLeaveSubstitutionPlan({
        slots: [{ date: monDate, shift: "morning" }],
        targetStaff: mockStaff[0], // Bích Thảo
        staff: mockStaff,
        positions: mockPositions,
        weeklySchedule: [], // Không có lịch
        templateSchedule: [],
        leaveRequests: [],
        referenceDate: refDate,
      });

      expect(plan.hasIntraWeekSlots).toBe(true);
      expect(plan.items.length).toBe(0); // Không bị khuyết vị trí nào
    });

    it("Phát hiện vị trí bị khuyết từ weekly_schedule và đề xuất ứng viên thay thế phù hợp", () => {
      // Giả lập: Bích Thảo được phân công trực Siêu âm sáng Thứ 2
      const weeklySchedule: WeeklyAssignment[] = [
        {
          id: "w1",
          weekStart: "2026-11-16",
          date: monDate,
          shift: "morning",
          positionId: "pos-sieuam",
          staffId: "st-thao",
          source: "manual",
          status: "published",
        },
      ];

      // Bích Thảo xin nghỉ phép đột xuất sáng Thứ 2
      const plan = generateLeaveSubstitutionPlan({
        slots: [{ date: monDate, shift: "morning" }],
        targetStaff: mockStaff[0], // Bích Thảo
        staff: mockStaff,
        positions: mockPositions,
        weeklySchedule,
        leaveRequests: [],
        referenceDate: refDate,
      });

      expect(plan.hasIntraWeekSlots).toBe(true);
      expect(plan.items.length).toBe(1);

      const item = plan.items[0];
      expect(item.positionId).toBe("pos-sieuam");
      expect(item.positionName).toBe("Phòng Siêu âm (P1.6)");
      expect(item.vacatedStaffId).toBe("st-thao");
      expect(item.shift).toBe("morning");

      // Lyna là người hỗ trợ thường trực Siêu âm (matchBackupStaff trong FIXED_ROOM_STAFF_RULES)
      expect(item.candidates.length).toBeGreaterThan(0);
      expect(item.candidates[0].staffId).toBe("st-lyna");
      expect(item.candidates[0].isFree).toBe(true); // Chưa có ca nào trong buổi
      expect(item.candidates[0].reasons.some((r) => r.includes("Siêu âm"))).toBe(true);
    });

    it("Tự động fallback sang template_schedule nếu weekly_schedule chưa được gán", () => {
      // Giả lập lịch nền: Thứ 2 (dayOfWeek=1), Mỹ Nhiên trực Da liễu
      const templateSchedule: TemplateAssignment[] = [
        {
          id: "t1",
          dayOfWeek: 1, // Thứ 2
          shift: "morning",
          positionId: "pos-dalieu",
          staffId: "st-nhien",
        },
      ];

      // Mỹ Nhiên xin nghỉ Thứ 2 sáng
      const plan = generateLeaveSubstitutionPlan({
        slots: [{ date: monDate, shift: "morning" }],
        targetStaff: mockStaff[4], // Mỹ Nhiên
        staff: mockStaff,
        positions: mockPositions,
        weeklySchedule: [],
        templateSchedule,
        leaveRequests: [],
        referenceDate: refDate,
      });

      expect(plan.hasIntraWeekSlots).toBe(true);
      expect(plan.items.length).toBe(1);
      expect(plan.items[0].positionId).toBe("pos-dalieu");
      expect(plan.items[0].vacatedStaffId).toBe("st-nhien");

      // Ứng viên thay thế hàng đầu cho Da liễu khi Nhiên nghỉ là Ái Liên
      expect(plan.items[0].candidates[0].staffId).toBe("st-ailien");
    });

    it("Loại trừ ứng viên đang nghỉ phép hoặc đi học khỏi danh sách gợi ý", () => {
      const weeklySchedule: WeeklyAssignment[] = [
        {
          id: "w1",
          weekStart: "2026-11-16",
          date: monDate,
          shift: "morning",
          positionId: "pos-sieuam",
          staffId: "st-thao",
          source: "manual",
          status: "published",
        },
      ];

      // Giả lập: Lyna cũng có đơn nghỉ phép cùng buổi sáng Thứ 2
      const leaveRequests: LeaveRecord[] = [
        {
          id: "l-lyna",
          staffId: "st-lyna",
          date: monDate,
          shift: "morning",
          reason: "phep",
          status: "approved",
        },
      ];

      const plan = generateLeaveSubstitutionPlan({
        slots: [{ date: monDate, shift: "morning" }],
        targetStaff: mockStaff[0], // Bích Thảo
        staff: mockStaff,
        positions: mockPositions,
        weeklySchedule,
        leaveRequests,
        referenceDate: refDate,
      });

      expect(plan.items.length).toBe(1);
      // Lyna không được xuất hiện trong danh sách gợi ý do bận nghỉ
      expect(plan.items[0].candidates.some((c) => c.staffId === "st-lyna")).toBe(false);
    });

    it("Xử lý đúng ca nghỉ cả ngày (full-day) bằng cách rà soát cả Sáng và Chiều", () => {
      const weeklySchedule: WeeklyAssignment[] = [
        {
          id: "w-morn",
          weekStart: "2026-11-16",
          date: monDate,
          shift: "morning",
          positionId: "pos-sieuam",
          staffId: "st-thao",
          source: "manual",
          status: "published",
        },
        {
          id: "w-after",
          weekStart: "2026-11-16",
          date: monDate,
          shift: "afternoon",
          positionId: "pos-sieuam",
          staffId: "st-thao",
          source: "manual",
          status: "published",
        },
      ];

      const plan = generateLeaveSubstitutionPlan({
        slots: [{ date: monDate, shift: "full-day" }],
        targetStaff: mockStaff[0],
        staff: mockStaff,
        positions: mockPositions,
        weeklySchedule,
        leaveRequests: [],
        referenceDate: refDate,
      });

      expect(plan.items.length).toBe(2);
      expect(plan.items[0].shift).toBe("morning");
      expect(plan.items[1].shift).toBe("afternoon");
    });
  });

  describe("3. Khối giao diện HTML gửi Email (renderSubstitutionPlanHtml)", () => {
    it("Trả về chuỗi rỗng khi không có vị trí bị khuyết trong tuần", () => {
      const html = renderSubstitutionPlanHtml(
        { hasIntraWeekSlots: false, weekStart: "2026-11-16", items: [] },
        "http://localhost:3000"
      );
      expect(html).toBe("");
    });

    it("Render đúng khối giao diện Teal, nút mở phân phòng và không chứa bất kỳ màu tím nào", () => {
      const samplePlan = {
        hasIntraWeekSlots: true,
        weekStart: "2026-11-16",
        items: [
          {
            date: monDate,
            dateLabel: "16/11 (Thứ Hai)",
            shift: "morning" as const,
            shiftLabel: "Sáng",
            positionId: "pos-sieuam",
            positionName: "Phòng Siêu âm (P1.6)",
            vacatedStaffId: "st-thao",
            vacatedStaffName: "Trần Bích Thảo",
            vacatedStaffCode: "DD09",
            candidates: [
              {
                staffId: "st-lyna",
                staffName: "Nguyễn Lyna",
                staffCode: "DD21",
                reasons: ["Hỗ trợ Siêu âm", "Rảnh chưa có ca"],
                score: 1500,
                isFree: true,
              },
            ],
          },
        ],
      };

      const html = renderSubstitutionPlanHtml(samplePlan, "http://localhost:3000");

      expect(html).toContain("Kế hoạch gợi ý thay thế vị trí phép đột xuất (Tuần này)");
      expect(html).toContain("Phòng Siêu âm (P1.6)");
      expect(html).toContain("Nguyễn Lyna");
      expect(html).toContain("Rảnh ca");
      expect(html).toContain("room-assignment?week=2026-11-16&openAdjust=1");

      // [P0-UI-01] Purple Ban: Tuyệt đối không chứa bất kỳ mã màu tím nào
      expect(html.toLowerCase()).not.toContain("#7e22ce");
      expect(html.toLowerCase()).not.toContain("#a855f7");
      expect(html.toLowerCase()).not.toContain("#9333ea");
      expect(html.toLowerCase()).not.toContain("#c084fc");
      expect(html.toLowerCase()).not.toContain("purple");
      expect(html.toLowerCase()).not.toContain("fuchsia");
      expect(html.toLowerCase()).not.toContain("violet");
    });
  });

  describe("4. Cấu hình người nhận Quản lý và ĐD Nghĩa", () => {
    it("Xác nhận đúng email Quản lý và ĐD Nghĩa theo chuẩn", () => {
      expect(ADMIN_APPROVER_EMAIL).toBe("tienmed@gmail.com");
      expect(NOTIFY_BCC_EMAIL).toBe("nghiadn.pk@pnt.edu.vn");
    });
  });
});
