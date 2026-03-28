"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  generateWeekFromTemplate,
  publishWeek,
  upsertLeaveRequest,
  upsertPosition,
  upsertScheduleRule,
  upsertStaff,
  upsertTemplateAssignment,
  upsertWeeklyAssignment,
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

function revalidateWorkspace() {
  ["/", "/schedule", "/template", "/staff", "/reports"].forEach((path) => {
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
      team: getValue(formData, "team"),
      active: formData.get("active") === "on",
      notes: getValue(formData, "notes"),
    });
    revalidateWorkspace();
    redirectWithState(returnTo, { message: "Đã cập nhật danh sách điều dưỡng." });
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể lưu điều dưỡng.",
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
  } catch (error) {
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
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể lưu quy tắc ca làm.",
    });
  }
}

export async function saveTemplateAssignmentAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/template";

  try {
    await assertEditor();
    await upsertTemplateAssignment({
      id: getValue(formData, "id") || undefined,
      dayOfWeek: Number(getValue(formData, "dayOfWeek")),
      shift: getValue(formData, "shift") as "morning" | "afternoon",
      positionId: getValue(formData, "positionId"),
      staffId: getValue(formData, "staffId"),
      note: getValue(formData, "note"),
    });
    revalidateWorkspace();
    redirectWithState(returnTo, { message: "Đã cập nhật lịch nền." });
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể lưu lịch nền.",
    });
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
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể lưu lịch tuần.",
    });
  }
}

export async function saveLeaveAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/staff";

  try {
    await assertEditor();
    await upsertLeaveRequest({
      id: getValue(formData, "id") || undefined,
      staffId: getValue(formData, "staffId"),
      date: getValue(formData, "date"),
      shift: getValue(formData, "shift") as "morning" | "afternoon" | "full-day",
      reason: getValue(formData, "reason") as "phep" | "om" | "khac",
      note: getValue(formData, "note"),
    });
    revalidateWorkspace();
    redirectWithState(returnTo, { message: "Đã cập nhật lịch nghỉ." });
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể lưu lịch nghỉ.",
    });
  }
}

export async function generateWeekAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/schedule";

  try {
    await assertEditor();
    const weekStart = getValue(formData, "weekStart");
    await generateWeekFromTemplate(weekStart);
    revalidateWorkspace();
    redirectWithState(returnTo, { message: "Đã tạo lịch dự thảo từ lịch nền." });
  } catch (error) {
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
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "Không thể chốt lịch tuần.",
    });
  }
}
