import { DEMO_ACCESS_CONTROL } from "@/lib/constants";
import { isSheetsConfigured } from "@/lib/env";
import { readAppDataFromSheets, writeAppDataKeysToSheets } from "@/lib/google-sheets";
import { mockAppData } from "@/lib/mock-data";
import { buildAssignmentsFromTemplate } from "@/lib/schedule";
import type {
  AppData,
  LeaveRecord,
  Position,
  ScheduleRule,
  StaffMember,
  TemplateAssignment,
  WeeklyAssignment,
} from "@/lib/types";

function cloneData(): AppData {
  return JSON.parse(JSON.stringify(mockAppData)) as AppData;
}

export async function getAppData(): Promise<AppData> {
  if (isSheetsConfigured()) {
    return readAppDataFromSheets();
  }

  const data = cloneData();
  if (data.accessControl.length === 0) {
    data.accessControl = DEMO_ACCESS_CONTROL;
  }
  return data;
}

async function persistData(data: AppData, keys: (keyof AppData)[]) {
  if (!isSheetsConfigured()) {
    throw new Error(
      "Ứng dụng đang ở chế độ demo. Hãy cấu hình Google Sheets để lưu thay đổi.",
    );
  }

  await writeAppDataKeysToSheets(data, keys);
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, "vi"));
}

export async function upsertStaff(input: Omit<StaffMember, "id"> & { id?: string }) {
  const data = await getAppData();
  const entry = {
    id: input.id || `staff-${Date.now()}`,
    ...input,
  };

  const nextItems = data.staff.filter((item) => item.id !== entry.id);
  nextItems.push(entry);
  data.staff = sortByName(nextItems);
  await persistData(data, ["staff"]);
  return entry;
}

export async function upsertPosition(input: Omit<Position, "id"> & { id?: string }) {
  const data = await getAppData();
  const entry = {
    id: input.id || `position-${Date.now()}`,
    ...input,
  };

  const nextItems = data.positions.filter((item) => item.id !== entry.id);
  nextItems.push(entry);
  data.positions = sortByName(nextItems);
  await persistData(data, ["positions"]);
  return entry;
}

export async function upsertScheduleRule(
  input: Omit<ScheduleRule, "id"> & { id?: string },
) {
  const data = await getAppData();
  const existing = data.scheduleRules.find(
    (item) => item.dayOfWeek === input.dayOfWeek && item.shift === input.shift,
  );

  const entry = {
    id: input.id || existing?.id || `slot-${input.dayOfWeek}-${input.shift}`,
    ...input,
  };

  data.scheduleRules = data.scheduleRules.filter((item) => item.id !== entry.id);
  data.scheduleRules.push(entry);
  await persistData(data, ["scheduleRules"]);
  return entry;
}

export async function upsertTemplateAssignment(
  input: Omit<TemplateAssignment, "id"> & { id?: string },
) {
  const data = await getAppData();
  const existing = data.templateSchedule.find(
    (item) =>
      item.dayOfWeek === input.dayOfWeek &&
      item.shift === input.shift &&
      item.positionId === input.positionId,
  );

  const entry = {
    id: input.id || existing?.id || `template-${Date.now()}`,
    ...input,
  };

  data.templateSchedule = data.templateSchedule.filter((item) => item.id !== entry.id);
  data.templateSchedule.push(entry);
  await persistData(data, ["templateSchedule"]);
  return entry;
}

export async function upsertWeeklyAssignment(
  input: Omit<WeeklyAssignment, "id" | "source"> & {
    id?: string;
    source?: WeeklyAssignment["source"];
  },
) {
  const data = await getAppData();
  const existing = data.weeklySchedule.find(
    (item) =>
      item.date === input.date &&
      item.shift === input.shift &&
      item.positionId === input.positionId,
  );

  const entry: WeeklyAssignment = {
    id: input.id || existing?.id || `weekly-${Date.now()}`,
    source: input.source ?? "manual",
    ...input,
  };

  data.weeklySchedule = data.weeklySchedule.filter((item) => item.id !== entry.id);
  data.weeklySchedule.push(entry);
  await persistData(data, ["weeklySchedule"]);
  return entry;
}

export async function upsertLeaveRequest(
  input: Omit<LeaveRecord, "id"> & { id?: string },
) {
  const data = await getAppData();
  const existing = data.leaveRequests.find(
    (item) =>
      item.staffId === input.staffId &&
      item.date === input.date &&
      item.shift === input.shift,
  );

  const entry = {
    id: input.id || existing?.id || `leave-${Date.now()}`,
    ...input,
  };

  data.leaveRequests = data.leaveRequests.filter((item) => item.id !== entry.id);
  data.leaveRequests.push(entry);
  await persistData(data, ["leaveRequests"]);
  return entry;
}

export async function generateWeekFromTemplate(weekStart: string) {
  const data = await getAppData();
  const generated = buildAssignmentsFromTemplate(
    data.templateSchedule,
    weekStart,
    data.leaveRequests,
    data.scheduleRules,
  );

  const remaining = data.weeklySchedule.filter((item) => item.weekStart !== weekStart);
  data.weeklySchedule = [...remaining, ...generated];
  await persistData(data, ["weeklySchedule"]);
  return generated;
}

export async function publishWeek(weekStart: string) {
  const data = await getAppData();
  data.weeklySchedule = data.weeklySchedule.map((item) =>
    item.weekStart === weekStart
      ? { ...item, status: "published" as const }
      : item,
  );

  await persistData(data, ["weeklySchedule"]);
}
