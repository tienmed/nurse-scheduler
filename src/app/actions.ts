"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  generateWeekFromTemplate,
  publishWeek,
  upsertLeaveRequest,
  upsertAccessControl,
  upsertPosition,
  upsertScheduleRule,
  upsertPositionRule,
  upsertManyPositionRules,
  upsertStaff,
  upsertTemplateAssignment,
  upsertManyTemplateAssignments,
  applyPrioritizedStaffToTemplate,
  upsertWeeklyAssignment,
  getAppData,
  writeAppDataKeysToSheets,
  invalidateAppDataCache,
  deleteLeaveRequest,
  addLeaveCancellation,
} from "@/lib/repository";
import { canEdit, getUserContext } from "@/lib/session";

function getValue(formData: FormData, key: string) {
  return `${formData.get(key) ?? ""}`.trim();
}

function redirectWithState(returnTo: string, params: Record<string, string>) {
  const url = new URL(returnTo || "/", "http://nurseflow.local");
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  redirect(`${url.pathname}${url.search}`);
}

async function assertEditor() {
  const { user } = await getUserContext({ required: false });
  if (!user) {
    throw new Error("Phiên đăng nhập đã hết hạn hoặc chưa sẵn sàng. Vui lòng đăng nhập lại rồi thử lại.");
  }

  if (!canEdit(user.role)) {
    throw new Error("Tài khoản hiện tại chỉ có quyền xem lịch.");
  }
}

async function assertAdmin() {
  const { user } = await getUserContext({ required: false });
  if (!user) {
    throw new Error("Phiên đăng nhập đã hết hạn hoặc chưa sẵn sàng. Vui lòng đăng nhập lại rồi thử lại.");
  }

  if (user.role !== "admin") {
    throw new Error("Hành động này chỉ dành cho Quản trị viên.");
  }
}

function revalidateWorkspace() {
  ["/", "/schedule", "/template", "/staff", "/leave", "/reports", "/areas"].forEach((path) => {
    revalidatePath(path);
  });
}

export async function saveStaffAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/staff";

  try {
    await assertEditor();
    await upsertStaff({
      id: getValue(formData, "id") || undefined,
      name: getValue(formData, "name"),
      code: getValue(formData, "code"),
      email: getValue(formData, "email"),
      role: (getValue(formData, "role") as "admin" | "coordinator" | "viewer") || "viewer",
      positionIds: formData
        .getAll("positionIds")
        .map((value) => `${value}`.trim())
        .filter(Boolean),
      active: formData.get("active") === "on",
      prefersOvertime: formData.get("prefersOvertime") === "on",
      notes: getValue(formData, "notes"),
    });
    revalidateWorkspace();
    redirectWithState(returnTo, { message: "Đã cập nhật danh sách điều dưỡng." });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể lưu điều dưỡng.",
    });
  }
}

export async function saveAccessControlAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/staff";

  try {
    await assertEditor();
    await upsertAccessControl({
      id: getValue(formData, "id") || undefined,
      email: getValue(formData, "email"),
      role: (getValue(formData, "role") as "admin" | "coordinator" | "viewer") || "viewer",
      displayName: getValue(formData, "displayName"),
    });
    revalidateWorkspace();
    redirectWithState(returnTo, { message: "Đã cập nhật quyền truy cập." });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể lưu quyền truy cập.",
    });
  }
}

export async function savePositionAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/staff";

  try {
    await assertEditor();
    await upsertPosition({
      id: getValue(formData, "id") || undefined,
      name: getValue(formData, "name"),
      area: getValue(formData, "area"),
      description: getValue(formData, "description"),
    });
    revalidateWorkspace();
    redirectWithState(returnTo, { message: "Đã cập nhật danh mục vị trí." });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể lưu vị trí.",
    });
  }
}

export async function saveScheduleRuleAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/template";

  try {
    await assertEditor();
    await upsertScheduleRule({
      id: getValue(formData, "id") || undefined,
      dayOfWeek: Number(getValue(formData, "dayOfWeek")),
      shift: getValue(formData, "shift") as "morning" | "afternoon",
      active: getValue(formData, "active") === "true",
      label: getValue(formData, "label"),
    });
    revalidateWorkspace();
    redirectWithState(returnTo, { message: "Đã cập nhật quy tắc ca làm." });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể lưu quy tắc ca làm.",
    });
  }
}

export async function saveTemplateAssignmentAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/template";

  try {
    await assertEditor();

    const dayOfWeeks = formData.getAll("dayOfWeek").map((v) => Number(v));
    const shifts = formData.getAll("shift") as ("morning" | "afternoon")[];
    const positionIds = formData.getAll("positionId").map((v) => String(v));
    const staffId = getValue(formData, "staffId");
    const note = getValue(formData, "note");

    if (!dayOfWeeks.length || !shifts.length || !positionIds.length) {
      throw new Error("Vui lòng chọn ít nhất 1 ngày, 1 ca và 1 vị trí.");
    }

    const assignmentsPayload = [];
    for (const dayOfWeek of dayOfWeeks) {
      for (const shift of shifts) {
        for (const positionId of positionIds) {
          assignmentsPayload.push({
            dayOfWeek,
            shift,
            positionId,
            staffId,
            note,
          });
        }
      }
    }

    const totalSlots = dayOfWeeks.length * shifts.length;

    await upsertManyTemplateAssignments(assignmentsPayload);
    revalidateWorkspace();
    redirectWithState(returnTo, { message: `Đã cập nhật ${totalSlots} ca × ${positionIds.length} vị trí vào lịch nền.` });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể lưu lịch nền.",
    });
  }
}

export async function saveSingleTemplateAssignmentAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/template";
  try {
    await assertEditor();
    const dayOfWeek = Number(getValue(formData, "dayOfWeek"));
    const shift = getValue(formData, "shift") as "morning" | "afternoon";
    const positionId = getValue(formData, "positionId");
    const staffId = getValue(formData, "staffId");
    const slotIndex = Number(getValue(formData, "slotIndex")) || 0;

    if (process.env.NODE_ENV === "development") {
      console.log(`🚀 [Action] saveSingleTemplateAssignmentAction: staffId="${staffId}", posId="${positionId}", day=${dayOfWeek}, shift=${shift}, slot=${slotIndex}`);
    }

    await upsertTemplateAssignment({
      dayOfWeek,
      shift,
      positionId,
      staffId,
      slotIndex,
    });
    revalidateWorkspace();
    redirectWithState(returnTo, { message: "Đã cập nhật nhân sự trên lịch nền." });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirectWithState(returnTo, { error: error instanceof Error ? error.message : "Lỗi lưu lịch nền." });
  }
}

export async function applyPrioritizedStaffToTemplateAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/template";
  try {
    await assertEditor();
    const assignments = await applyPrioritizedStaffToTemplate();
    revalidateWorkspace();
    redirectWithState(returnTo, { message: `Đã áp dụng thành công ${assignments.length} vị trí phân công mặc định từ thiết lập.` });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirectWithState(returnTo, { error: error instanceof Error ? error.message : "Lỗi áp dụng nhân sự mặc định." });
  }
}

export async function saveWeeklyAssignmentAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/schedule";

  try {
    await assertEditor();
    await upsertWeeklyAssignment({
      id: getValue(formData, "id") || undefined,
      weekStart: getValue(formData, "weekStart"),
      date: getValue(formData, "date"),
      shift: getValue(formData, "shift") as "morning" | "afternoon",
      positionId: getValue(formData, "positionId"),
      staffId: getValue(formData, "staffId"),
      slotIndex: Number(getValue(formData, "slotIndex")) || 0,
      status: getValue(formData, "status") as
        | "draft"
        | "published"
        | "adjusted"
        | "needs-review",
      note: getValue(formData, "note"),
      source: "manual",
    });
    revalidateWorkspace();
    redirectWithState(returnTo, { message: "Đã cập nhật lịch tuần." });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể lưu lịch tuần.",
    });
  }
}

export async function saveLeaveAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/leave";

  try {
    const { user } = await getUserContext({ required: false });
    if (!user) {
      throw new Error("Phiên đăng nhập đã hết hạn hoặc chưa sẵn sàng. Vui lòng đăng nhập lại rồi thử lại.");
    }

    const staffId = getValue(formData, "staffId");
    const fromDate = getValue(formData, "fromDate");
    const toDate = getValue(formData, "toDate") || fromDate;
    const shift = getValue(formData, "shift") as "morning" | "afternoon" | "full-day";
    const reason = getValue(formData, "reason") as "phep" | "om" | "dihoc" | "khac";
    const note = getValue(formData, "note");

    if (!staffId || !fromDate) {
      throw new Error("Vui lòng chọn nhân sự và ngày nghỉ.");
    }

    // Viewer chỉ được đăng ký cho bản thân
    if (!canEdit(user.role)) {
      const data = await getAppData();
      const ownStaff = data.staff.find(
        (s) => s.email.toLowerCase() === user.email.toLowerCase(),
      );
      if (!ownStaff || ownStaff.id !== staffId) {
        throw new Error("Bạn chỉ có quyền đăng ký nghỉ phép cho bản thân.");
      }
    }

    // Tạo danh sách ngày từ fromDate → toDate
    const { addDays, parseISO, format, differenceInCalendarDays } = await import("date-fns");
    const start = parseISO(fromDate);
    const end = parseISO(toDate);
    const dayCount = differenceInCalendarDays(end, start) + 1;

    if (dayCount < 1 || dayCount > 90) {
      throw new Error("Khoảng ngày không hợp lệ (tối đa 90 ngày).");
    }

    // --- Bắt đầu logic Check Quota Nghỉ Phép ---
    const currentData = await getAppData();
    const forceQuota = getValue(formData, "forceQuota") === "true";
    let quotaExceededDate = "";

    for (let i = 0; i < dayCount; i++) {
      const date = format(addDays(start, i), "yyyy-MM-dd");

      const relevantLeaves = currentData.leaveRequests.filter(
        (l) => l.date === date && l.reason !== "dihoc" && l.staffId !== staffId
      );

      let morningCount = 0;
      let afternoonCount = 0;
      for (const l of relevantLeaves) {
        if (l.shift === "full-day") {
          morningCount++; afternoonCount++;
        } else if (l.shift === "morning") {
          morningCount++;
        } else if (l.shift === "afternoon") {
          afternoonCount++;
        }
      }

      const isMorningExceeded = (shift === "full-day" || shift === "morning") && morningCount >= 2;
      const isAfternoonExceeded = (shift === "full-day" || shift === "afternoon") && afternoonCount >= 2;

      if (isMorningExceeded || isAfternoonExceeded) {
        quotaExceededDate = format(parseISO(date), "dd/MM/yyyy");
        break;
      }
    }

    if (quotaExceededDate) {
      if (!canEdit(user.role)) {
        throw new Error(`Ngày ${quotaExceededDate} đã có đủ 2 nhân sự nghỉ. Hệ thống từ chối đăng ký thêm.`);
      } else if (!forceQuota) {
        redirectWithState(returnTo, {
          confirmQuota: "true",
          cfStaffId: staffId,
          cfFromDate: fromDate,
          cfToDate: toDate || "",
          cfShift: shift,
          cfReason: reason,
          cfNote: note,
        });
      }
    }
    // --- Kết thúc logic Check Quota ---

    const duplicateDates: string[] = [];
    for (let i = 0; i < dayCount; i++) {
      const date = format(addDays(start, i), "yyyy-MM-dd");
      const existingLeave = currentData.leaveRequests.find(
        (l) => l.staffId === staffId && l.date === date && (l.shift === shift || l.shift === "full-day")
      );
      if (existingLeave) {
        duplicateDates.push(date);
        continue;
      }
      await upsertLeaveRequest({
        staffId,
        date,
        shift,
        reason,
        note,
      });
    }

    revalidateWorkspace();
    redirectWithState(returnTo, {
      message: dayCount === 1
        ? "Đã cập nhật lịch nghỉ."
        : `Đã tạo ${dayCount} ngày nghỉ (${fromDate} → ${toDate}).`,
      ...(duplicateDates.length > 0 && { warning: `Các ngày đã có lịch nghỉ: ${duplicateDates.join(", ")}` }),
    });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể lưu lịch nghỉ.",
    });
  }
}


export async function generateWeekAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/schedule";

  try {
    await assertAdmin();
    const weekStart = getValue(formData, "weekStart");
    await generateWeekFromTemplate(weekStart);
    revalidateWorkspace();
    redirectWithState(returnTo, { message: "Đã tạo lịch dự thảo từ lịch nền." });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể tạo lịch tuần.",
    });
  }
}

export async function publishWeekAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/schedule";

  try {
    await assertEditor();
    await publishWeek(getValue(formData, "weekStart"));
    revalidateWorkspace();
    redirectWithState(returnTo, { message: "Đã chốt lịch tuần chính thức." });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể chốt lịch tuần.",
    });
  }
}

export async function updatePositionQuota(id: string, quota: number) {
  await assertEditor();
  const data = await getAppData();
  const existing = data.positions.find((p) => p.id === id);
  if (existing) {
    await upsertPosition({ ...existing, quota });
    revalidateWorkspace();
  }
}

export async function updatePositionStaffOrder(id: string, staffOrder: string[]) {
  await assertEditor();
  const data = await getAppData();
  const existing = data.positions.find((p) => p.id === id);
  if (existing) {
    await upsertPosition({ ...existing, staffOrder });
    revalidateWorkspace();
  }
}

export async function updateStaffForPosition(positionId: string, staffIds: string[]) {
  await assertEditor();
  const data = await getAppData();

  // Cập nhật positionIds cho từng staff
  for (const s of data.staff) {
    const hasPosition = s.positionIds.includes(positionId);
    const shouldHave = staffIds.includes(s.id);

    if (shouldHave && !hasPosition) {
      s.positionIds = [...s.positionIds, positionId];
    } else if (!shouldHave && hasPosition) {
      s.positionIds = s.positionIds.filter((pid) => pid !== positionId);
    }
  }

  // Dọn dẹp staffOrder: giữ người cũ đúng thứ tự, nối người mới cuối
  const position = data.positions.find((p) => p.id === positionId);
  if (position) {
    const oldOrder = position.staffOrder || [];
    const keptInOrder = oldOrder.filter((sid) => staffIds.includes(sid));
    const newIds = staffIds.filter((sid) => !keptInOrder.includes(sid));
    position.staffOrder = [...keptInOrder, ...newIds];

    // Persist position update
    const nextPositions = data.positions.filter((p) => p.id !== positionId);
    nextPositions.push(position);
    data.positions = nextPositions;
  }

  await writeAppDataKeysToSheets(data, ["staff", "positions"]);
  invalidateAppDataCache();
  revalidateWorkspace();
}

export async function savePositionRuleAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/template";
  try {
    await assertEditor();
    const positionIds = formData.getAll("positionIds").map(v => String(v));
    const dayOfWeek = Number(getValue(formData, "dayOfWeek"));
    const shift = getValue(formData, "shift") as "morning" | "afternoon";
    const active = getValue(formData, "active") === "true";

    if (positionIds.length === 0) {
      throw new Error("Vui lòng chọn ít nhất một vị trí.");
    }

    for (const positionId of positionIds) {
      await upsertPositionRule({
        positionId,
        dayOfWeek,
        shift,
        active,
      });
    }

    revalidateWorkspace();
    redirectWithState(returnTo, { message: `Đã cập nhật trạng thái cho ${positionIds.length} vị trí.` });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirectWithState(returnTo, { error: error instanceof Error ? error.message : "Lỗi cập nhật vị trí." });
  }
}

export async function savePositionRulesBatchAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/template";
  try {
    await assertEditor();

    // Tìm tất cả các key
    const allSlots = formData.getAll("all_slots").map(s => String(s)); // format: posId|day|shift
    const checkedSlots = new Set(formData.getAll("active_slots").map(s => String(s)));

    const rulesToSave: any[] = [];
    for (const slot of allSlots) {
      const [positionId, dayOfWeekStr, shift] = slot.split("|");
      const dayOfWeek = Number(dayOfWeekStr);
      const active = checkedSlots.has(slot);

      rulesToSave.push({
        positionId,
        dayOfWeek,
        shift: shift as "morning" | "afternoon",
        active,
      });
    }

    if (rulesToSave.length > 0) {
      await upsertManyPositionRules(rulesToSave);
    }

    revalidateWorkspace();
    redirectWithState(returnTo, { message: "Đã cập nhật cấu hình ma trận vị trí." });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirectWithState(returnTo, { error: error instanceof Error ? error.message : "Lỗi lưu cấu hình vị trí." });
  }
}

export async function cancelLeaveAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/leave";

  try {
    const { user } = await getUserContext({ required: false });
    if (!user) {
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }

    const leaveId = getValue(formData, "leaveId");
    if (!leaveId) {
      throw new Error("Không tìm thấy mã đăng ký nghỉ phép.");
    }

    const data = await getAppData();
    const leaveRecord = data.leaveRequests.find((l) => l.id === leaveId);
    if (!leaveRecord) {
      throw new Error("Đăng ký nghỉ phép không tồn tại hoặc đã bị xoá.");
    }

    // Viewer chỉ được huỷ phép của bản thân
    if (!canEdit(user.role)) {
      const ownStaff = data.staff.find(
        (s) => s.email.toLowerCase() === user.email.toLowerCase(),
      );
      if (!ownStaff || ownStaff.id !== leaveRecord.staffId) {
        throw new Error("Bạn chỉ có quyền huỷ nghỉ phép của bản thân.");
      }
    }

    // Xoá leave record
    await deleteLeaveRequest(leaveId);

    // Ghi log huỷ phép
    const now = new Date().toISOString();
    await addLeaveCancellation({
      staffId: leaveRecord.staffId,
      date: leaveRecord.date,
      shift: leaveRecord.shift,
      cancelledAt: now,
    });

    revalidateWorkspace();
    const person = data.staff.find((s) => s.id === leaveRecord.staffId);
    redirectWithState(returnTo, {
      message: `${person?.name ?? "Nhân sự"} đã đăng ký quay lại làm ngày ${leaveRecord.date}.`,
    });
  } catch (error: any) {
    if (error?.message === "NEXT_REDIRECT" || error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể huỷ đăng ký nghỉ phép.",
    });
  }
}
