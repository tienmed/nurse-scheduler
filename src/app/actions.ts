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
  const { user } = await getUserContext();
  if (!canEdit(user.role)) {
    throw new Error("TÃ i khoáº£n hiá»‡n táº¡i chá»‰ cÃ³ quyá»n xem lá»‹ch.");
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
    redirectWithState(returnTo, { message: "ÄÃ£ cáº­p nháº­t danh sÃ¡ch Ä‘iá»u dÆ°á»¡ng." });
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "KhÃ´ng thá»ƒ lÆ°u Ä‘iá»u dÆ°á»¡ng.",
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
    redirectWithState(returnTo, { message: "ÄÃ£ cáº­p nháº­t danh má»¥c vá»‹ trÃ­." });
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "KhÃ´ng thá»ƒ lÆ°u vá»‹ trÃ­.",
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
    redirectWithState(returnTo, { message: "ÄÃ£ cáº­p nháº­t quy táº¯c ca lÃ m." });
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "KhÃ´ng thá»ƒ lÆ°u quy táº¯c ca lÃ m.",
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
    redirectWithState(returnTo, { message: "ÄÃ£ cáº­p nháº­t lá»‹ch ná»n." });
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "KhÃ´ng thá»ƒ lÆ°u lá»‹ch ná»n.",
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
    redirectWithState(returnTo, { message: "ÄÃ£ cáº­p nháº­t lá»‹ch tuáº§n." });
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "KhÃ´ng thá»ƒ lÆ°u lá»‹ch tuáº§n.",
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
    redirectWithState(returnTo, { message: "ÄÃ£ cáº­p nháº­t lá»‹ch nghá»‰." });
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "KhÃ´ng thá»ƒ lÆ°u lá»‹ch nghá»‰.",
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
    redirectWithState(returnTo, { message: "ÄÃ£ táº¡o lá»‹ch dá»± tháº£o tá»« lá»‹ch ná»n." });
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "KhÃ´ng thá»ƒ táº¡o lá»‹ch tuáº§n.",
    });
  }
}

export async function publishWeekAction(formData: FormData) {
  const returnTo = getValue(formData, "returnTo") || "/schedule";

  try {
    await assertEditor();
    await publishWeek(getValue(formData, "weekStart"));
    revalidateWorkspace();
    redirectWithState(returnTo, { message: "ÄÃ£ chá»‘t lá»‹ch tuáº§n chÃ­nh thá»©c." });
  } catch (error) {
    redirectWithState(returnTo, {
      error: error instanceof Error ? error.message : "KhÃ´ng thá»ƒ chá»‘t lá»‹ch tuáº§n.",
    });
  }
}
