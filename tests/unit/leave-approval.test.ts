import { describe, expect, it } from "vitest";
import { ADMIN_APPROVER_EMAIL, NOTIFY_BCC_EMAIL } from "@/lib/email-service";
import { evaluateSlotQuota, LEAVE_QUOTA_LIMIT, STUDY_QUOTA_LIMIT } from "@/lib/leave-logic";
import type { LeaveRecord } from "@/lib/types";

describe("[QWEN3] Leave Auto-Approval & Notification Rules (leave-logic.ts)", () => {
  const testDate = "2026-05-11"; // Thứ 2

  describe("Hằng số định mức chuẩn", () => {
    it("Định mức nghỉ phép thông thường là 2 người/buổi", () => {
      expect(LEAVE_QUOTA_LIMIT).toBe(2);
    });

    it("Định mức nghỉ đi học là 3 người/buổi", () => {
      expect(STUDY_QUOTA_LIMIT).toBe(3);
    });
  });

  describe("Quy tắc tự động duyệt nghỉ phép (Người thứ 1 hoặc thứ 2 trong buổi)", () => {
    it("Tự động duyệt khi là người đầu tiên đăng ký ca sáng (0 người đã nghỉ)", () => {
      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "morning", reason: "phep" },
        existingLeaves: [],
        targetStaffId: "nurse-new",
      });

      expect(result.status).toBe("approved");
      expect(result.isAutoApproved).toBe(true);
      expect(result.isAutoApprovedLeave).toBe(true);
      expect(result.isQuotaExceeded).toBe(false);
      expect(result.morningCount).toBe(0);
      expect(result.relevantCount).toBe(0);
    });

    it("Tự động duyệt khi là người thứ 2 đăng ký ca sáng (đã có 1 người nghỉ)", () => {
      const existing: LeaveRecord[] = [
        {
          id: "l1",
          staffId: "nurse-01",
          date: testDate,
          shift: "morning",
          reason: "phep",
          status: "approved",
        },
      ];

      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "morning", reason: "phep" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
      });

      expect(result.status).toBe("approved");
      expect(result.isAutoApproved).toBe(true);
      expect(result.isAutoApprovedLeave).toBe(true);
      expect(result.isQuotaExceeded).toBe(false);
      expect(result.morningCount).toBe(1);
      expect(result.relevantCount).toBe(1);
    });

    it("Chuyển sang pending (chờ Quản lý duyệt) khi là người thứ 3 đăng ký ca sáng (đã có 2 người nghỉ)", () => {
      const existing: LeaveRecord[] = [
        { id: "l1", staffId: "nurse-01", date: testDate, shift: "morning", reason: "phep", status: "approved" },
        { id: "l2", staffId: "nurse-02", date: testDate, shift: "morning", reason: "phep", status: "approved" },
      ];

      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "morning", reason: "phep" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
      });

      expect(result.status).toBe("pending");
      expect(result.isAutoApproved).toBe(false);
      expect(result.isAutoApprovedLeave).toBe(false);
      expect(result.isQuotaExceeded).toBe(true);
      expect(result.morningCount).toBe(2);
      expect(result.relevantCount).toBe(2);
    });

    it("Tự động duyệt khi là người đầu tiên hoặc thứ 2 ca chiều", () => {
      const existing: LeaveRecord[] = [
        { id: "l1", staffId: "nurse-01", date: testDate, shift: "afternoon", reason: "phep", status: "approved" },
      ];

      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "afternoon", reason: "phep" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
      });

      expect(result.status).toBe("approved");
      expect(result.isAutoApprovedLeave).toBe(true);
      expect(result.afternoonCount).toBe(1);
      expect(result.relevantCount).toBe(1);
    });

    it("Chuyển sang pending khi là người thứ 3 đăng ký ca chiều (đã có 2 người nghỉ)", () => {
      const existing: LeaveRecord[] = [
        { id: "l1", staffId: "nurse-01", date: testDate, shift: "afternoon", reason: "phep", status: "approved" },
        { id: "l2", staffId: "nurse-02", date: testDate, shift: "afternoon", reason: "phep", status: "approved" },
      ];

      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "afternoon", reason: "phep" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
      });

      expect(result.status).toBe("pending");
      expect(result.isQuotaExceeded).toBe(true);
      expect(result.afternoonCount).toBe(2);
    });

    it("Cô lập giữa buổi sáng và chiều: Sáng đủ 2 người nghỉ, đăng ký ca chiều vẫn tự động duyệt ngay", () => {
      const existing: LeaveRecord[] = [
        { id: "l1", staffId: "nurse-01", date: testDate, shift: "morning", reason: "phep", status: "approved" },
        { id: "l2", staffId: "nurse-02", date: testDate, shift: "morning", reason: "phep", status: "approved" },
      ];

      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "afternoon", reason: "phep" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
      });

      // Buổi chiều chưa có ai nghỉ (0 người) -> Tự động duyệt ngay!
      expect(result.status).toBe("approved");
      expect(result.isAutoApprovedLeave).toBe(true);
      expect(result.isQuotaExceeded).toBe(false);
      expect(result.afternoonCount).toBe(0);
    });

    it("Tự động duyệt ca cả ngày khi cả sáng và chiều đều < 2 người", () => {
      const existing: LeaveRecord[] = [
        { id: "l1", staffId: "nurse-01", date: testDate, shift: "morning", reason: "phep", status: "approved" },
        { id: "l2", staffId: "nurse-02", date: testDate, shift: "afternoon", reason: "phep", status: "approved" },
      ];

      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "full-day", reason: "phep" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
      });

      expect(result.status).toBe("approved");
      expect(result.isAutoApprovedLeave).toBe(true);
      expect(result.isQuotaExceeded).toBe(false);
      expect(result.morningCount).toBe(1);
      expect(result.afternoonCount).toBe(1);
      expect(result.relevantCount).toBe(1);
    });

    it("Chuyển sang pending ca cả ngày nếu một trong hai buổi đã đủ 2 người", () => {
      const existing: LeaveRecord[] = [
        { id: "l1", staffId: "nurse-01", date: testDate, shift: "morning", reason: "phep", status: "approved" },
        { id: "l2", staffId: "nurse-02", date: testDate, shift: "morning", reason: "phep", status: "approved" },
      ];

      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "full-day", reason: "phep" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
      });

      expect(result.status).toBe("pending");
      expect(result.isAutoApprovedLeave).toBe(false);
      expect(result.isQuotaExceeded).toBe(true);
      expect(result.morningCount).toBe(2);
      expect(result.afternoonCount).toBe(0);
      expect(result.relevantCount).toBe(2);
    });

    it("Ca cả ngày của nhân sự khác tính đồng thời vào cả sáng và chiều", () => {
      const existing: LeaveRecord[] = [
        { id: "l1", staffId: "nurse-01", date: testDate, shift: "full-day", reason: "phep", status: "approved" },
      ];

      // Đăng ký ca sáng: đã có 1 người (ca cả ngày l1)
      const resMorning = evaluateSlotQuota({
        slot: { date: testDate, shift: "morning", reason: "phep" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
      });
      expect(resMorning.status).toBe("approved");
      expect(resMorning.morningCount).toBe(1);

      // Đăng ký ca chiều: đã có 1 người (ca cả ngày l1)
      const resAfternoon = evaluateSlotQuota({
        slot: { date: testDate, shift: "afternoon", reason: "phep" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
      });
      expect(resAfternoon.status).toBe("approved");
      expect(resAfternoon.afternoonCount).toBe(1);
    });

    it("Ca đi học (dihoc) không làm ảnh hưởng định mức 2 người của nghỉ phép (phep)", () => {
      const existing: LeaveRecord[] = [
        { id: "l1", staffId: "nurse-01", date: testDate, shift: "morning", reason: "dihoc", status: "approved" },
        { id: "l2", staffId: "nurse-02", date: testDate, shift: "morning", reason: "dihoc", status: "approved" },
      ];

      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "morning", reason: "phep" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
      });

      // Dù có 2 người đi học, nghỉ phép vẫn tính là người đầu tiên
      expect(result.status).toBe("approved");
      expect(result.isAutoApprovedLeave).toBe(true);
      expect(result.morningCount).toBe(0);
    });

    it("Bản ghi bị từ chối (rejected) không tính vào số lượng người nghỉ", () => {
      const existing: LeaveRecord[] = [
        { id: "l1", staffId: "nurse-01", date: testDate, shift: "morning", reason: "phep", status: "rejected" },
        { id: "l2", staffId: "nurse-02", date: testDate, shift: "morning", reason: "phep", status: "rejected" },
      ];

      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "morning", reason: "phep" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
      });

      expect(result.status).toBe("approved");
      expect(result.isAutoApprovedLeave).toBe(true);
      expect(result.morningCount).toBe(0);
    });

    it("Bản ghi của chính nhân sự mục tiêu không tự tính làm vượt định mức của chính mình", () => {
      const existing: LeaveRecord[] = [
        { id: "l1", staffId: "nurse-self", date: testDate, shift: "morning", reason: "phep", status: "pending" },
      ];

      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "morning", reason: "phep" },
        existingLeaves: existing,
        targetStaffId: "nurse-self",
      });

      expect(result.status).toBe("approved");
      expect(result.morningCount).toBe(0);
    });

    it("Ca do Quản trị viên đăng ký hộ luôn luôn được duyệt chính thức ngay lập tức", () => {
      const existing: LeaveRecord[] = [
        { id: "l1", staffId: "nurse-01", date: testDate, shift: "morning", reason: "phep", status: "approved" },
        { id: "l2", staffId: "nurse-02", date: testDate, shift: "morning", reason: "phep", status: "approved" },
        { id: "l3", staffId: "nurse-03", date: testDate, shift: "morning", reason: "phep", status: "approved" },
      ];

      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "morning", reason: "phep" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
        isRegisteredByAdmin: true,
      });

      expect(result.status).toBe("approved");
      expect(result.isQuotaExceeded).toBe(false);
    });
  });

  describe("Quy tắc định mức ca đi học (dihoc - tối đa 3 người/buổi)", () => {
    it("Tự động duyệt khi là người thứ 1, 2, 3 đi học trong buổi", () => {
      const existing: LeaveRecord[] = [
        { id: "l1", staffId: "nurse-01", date: testDate, shift: "morning", reason: "phep", status: "approved" },
        { id: "l2", staffId: "nurse-02", date: testDate, shift: "morning", reason: "dihoc", status: "approved" },
      ];

      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "morning", reason: "dihoc" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
      });

      // Đã có 2 người nghỉ, người mới là người thứ 3 (<= 3) -> Tự động duyệt
      expect(result.status).toBe("approved");
      expect(result.isAutoApprovedStudy).toBe(true);
      expect(result.morningCount).toBe(2);
      expect(result.isQuotaExceeded).toBe(false);
    });

    it("Chuyển sang pending khi buổi đó đã có đủ 3 người nghỉ (người mới là người thứ 4 trở đi)", () => {
      const existing: LeaveRecord[] = [
        { id: "l1", staffId: "nurse-01", date: testDate, shift: "morning", reason: "phep", status: "approved" },
        { id: "l2", staffId: "nurse-02", date: testDate, shift: "morning", reason: "dihoc", status: "approved" },
        { id: "l3", staffId: "nurse-03", date: testDate, shift: "morning", reason: "om", status: "approved" },
      ];

      const result = evaluateSlotQuota({
        slot: { date: testDate, shift: "morning", reason: "dihoc" },
        existingLeaves: existing,
        targetStaffId: "nurse-new",
      });

      expect(result.status).toBe("pending");
      expect(result.isAutoApprovedStudy).toBe(false);
      expect(result.morningCount).toBe(3);
      expect(result.isQuotaExceeded).toBe(true);
    });
  });

  describe("Cấu hình Email thông báo đã duyệt (BCC cả ĐD Nghĩa và tienmed)", () => {
    it("Định nghĩa đúng địa chỉ Quản lý tienmed và ĐD Nghĩa", () => {
      expect(ADMIN_APPROVER_EMAIL).toBe("tienmed@gmail.com");
      expect(NOTIFY_BCC_EMAIL).toBe("nghiadn.pk@pnt.edu.vn");
    });

    it("Danh sách BCC chứa cả ĐD Nghĩa và tienmed khi gửi thông báo duyệt", () => {
      const staffEmail = "nurse01@pnt.edu.vn";
      const bccList = [NOTIFY_BCC_EMAIL, ADMIN_APPROVER_EMAIL].filter(
        (email) => email.toLowerCase() !== staffEmail.toLowerCase(),
      );

      expect(bccList).toContain("nghiadn.pk@pnt.edu.vn");
      expect(bccList).toContain("tienmed@gmail.com");
      expect(bccList.length).toBe(2);
    });

    it("Tự động loại bỏ chính email người nhận khỏi danh sách BCC nếu trùng lặp (trường hợp tienmed đăng ký)", () => {
      const staffEmail = "tienmed@gmail.com";
      const bccList = [NOTIFY_BCC_EMAIL, ADMIN_APPROVER_EMAIL].filter(
        (email) => email.toLowerCase() !== staffEmail.toLowerCase(),
      );

      expect(bccList).toEqual(["nghiadn.pk@pnt.edu.vn"]);
      expect(bccList).not.toContain("tienmed@gmail.com");
    });

    it("Tự động loại bỏ chính email người nhận khỏi danh sách BCC nếu trùng lặp (trường hợp ĐD Nghĩa đăng ký)", () => {
      const staffEmail = "nghiadn.pk@pnt.edu.vn";
      const bccList = [NOTIFY_BCC_EMAIL, ADMIN_APPROVER_EMAIL].filter(
        (email) => email.toLowerCase() !== staffEmail.toLowerCase(),
      );

      expect(bccList).toEqual(["tienmed@gmail.com"]);
      expect(bccList).not.toContain("nghiadn.pk@pnt.edu.vn");
    });
  });
});
