import { subDays, parseISO, isAfter, startOfToday } from "date-fns";
import { DEMO_ACCESS_CONTROL, SATURDAY_OT_POSITION_ID } from "@/lib/constants";
import { isSheetsConfigured } from "@/lib/env";
import {
  getCachedAppData,
  invalidateAppDataCache,
  writeAppDataKeysToSheets,
} from "@/lib/google-sheets";
import { MOCK_DATA } from "@/lib/mock-data";
import { buildAssignmentsFromTemplate } from "@/lib/schedule";
import { isPastShift } from "@/lib/date";
import type {
  AccessControlEntry,
  AppData,
  LeaveCancellation,
  PositionRule,
  LeaveRecord,
  Position,
  ScheduleRule,
  StaffMember,
  TemplateAssignment,
  WeeklyAssignment,
} from "@/lib/types";

import { generateId } from "@/lib/id";
import { cookies } from "next/headers";

async function getHorizonDays(): Promise<number> {
  try {
    const cookieStore = await cookies();
    const horizon = cookieStore.get("nh-data-horizon")?.value;
    if (horizon && horizon !== "all") {
      return parseInt(horizon, 10);
    }
  } catch {
    // ignore
  }
  return 60; // Mac dinh la 60 ngay de toi uu hieu nang
}

function cloneData(): AppData {
  return JSON.parse(JSON.stringify(MOCK_DATA)) as AppData;
}

export async function getAppData(): Promise<AppData> {
  let data: AppData;
  const horizonDays = await getHorizonDays();

  if (isSheetsConfigured()) {
    data = await getCachedAppData();
  } else {
    data = cloneData();
    if (data.accessControl.length === 0) {
      data.accessControl = DEMO_ACCESS_CONTROL;
    }
  }

  // Ap dung bo loc thoi gian neu co cau hinh chan troi du lieu (Horizon)
  if (horizonDays > 0) {
    const cutoffDate = subDays(startOfToday(), horizonDays);

    const filterByDate = (items: any[]) =>
      items.filter((item) => {
        if (!item.date) return true;
        try {
          const itemDate = parseISO(item.date);
          // Kiem tra tinh hop le cua ngay (tranh du lieu rac)
          if (isNaN(itemDate.getTime())) {
            return false;
          }
          return isAfter(itemDate, cutoffDate);
        } catch {
          return false; // Neu loi parse thi coi nhu cu va loc bo
        }
      });

    const originalCounts = {
      weekly: data.weeklySchedule.length,
      leaves: data.leaveRequests.length,
      cancels: data.leaveCancellations.length,
    };

    data.weeklySchedule = filterByDate(data.weeklySchedule);
    data.leaveRequests = filterByDate(data.leaveRequests);
    data.leaveCancellations = filterByDate(data.leaveCancellations);

    if (process.env.NODE_ENV === "development") {
      console.log(`🧹 [Horizon Filter] Da loc du lieu > ${horizonDays} ngay:`);
      console.log(`   - Lich tuan: ${originalCounts.weekly} -> ${data.weeklySchedule.length}`);
      console.log(`   - Nghi phep: ${originalCounts.leaves} -> ${data.leaveRequests.length}`);
    }
  }

  // Dam bao cac truong moi luon ton tai
  if (!data.positionRules) data.positionRules = [];
  if (!data.leaveCancellations) data.leaveCancellations = [];
  if (!data.holidays) data.holidays = [];

  return data;
}

/**
 * Write Lock mechanism to prevent race conditions when writing to Google Sheets.
 * Ensures only one write operation happens at a time in this process.
 */
let writePromise: Promise<void> = Promise.resolve();

async function persistData(data: AppData, keys: (keyof AppData)[]) {
  if (!isSheetsConfigured()) {
    throw new Error(
      "Ung dung dang o che do demo. Hay cau hinh Google Sheets de luu thay doi.",
    );
  }

  // Su dung hang doi Promise de tuan tu hoa viec ghi
  const currentWrite = writePromise.then(async () => {
    try {
      await writeAppDataKeysToSheets(data, keys);
      invalidateAppDataCache();
    } catch (error) {
      console.error("🚨 [Repository] Error persisting data:", error);
      throw error;
    }
  });

  writePromise = currentWrite.catch(() => {});
  return currentWrite;
}

export { writeAppDataKeysToSheets, invalidateAppDataCache };

export function getEffectiveLeaveRequests(data: AppData): LeaveRecord[] {
  if (data.leaveCancellations.length === 0) {
    return data.leaveRequests;
  }

  const fullDayCancelSet = new Set(
    data.leaveCancellations
      .filter((c) => c.shift === "full-day")
      .map((c) => `${c.staffId}-${c.date}`),
  );
  const shiftCancelSet = new Set(
    data.leaveCancellations.map((c) => `${c.staffId}-${c.date}-${c.shift}`),
  );

  const effective: LeaveRecord[] = [];
  data.leaveRequests.forEach((leave) => {
    const dayKey = `${leave.staffId}-${leave.date}`;
    if (fullDayCancelSet.has(dayKey)) return;

    if (leave.shift === "full-day") {
      const cancelMorning = shiftCancelSet.has(`${dayKey}-morning`);
      const cancelAfternoon = shiftCancelSet.has(`${dayKey}-afternoon`);

      if (cancelMorning && cancelAfternoon) return;
      if (cancelMorning) {
        effective.push({ ...leave, shift: "afternoon" });
        return;
      }
      if (cancelAfternoon) {
        effective.push({ ...leave, shift: "morning" });
        return;
      }
      effective.push(leave);
      return;
    }

    if (shiftCancelSet.has(`${dayKey}-${leave.shift}`)) return;
    effective.push(leave);
  });

  return effective;
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, "vi"));
}

export async function upsertStaff(input: Omit<StaffMember, "id"> & { id?: string }) {
  const data = await getAppData();
  const existing = input.id ? data.staff.find((item) => item.id === input.id) : undefined;
  const entry = {
    ...input,
    id: input.id || generateId("staff"),
  };

  const nextItems = data.staff.filter((item) => item.id !== entry.id);
  nextItems.push(entry);
  data.staff = sortByName(nextItems);

  const normalizedEmail = entry.email.trim().toLowerCase();
  const previousEmail = existing?.email?.trim().toLowerCase();

  const keysToPersist: (keyof AppData)[] = ["staff"];

  // Neu Email thay doi, don dep Access Control cu
  if (previousEmail && previousEmail !== normalizedEmail) {
    data.accessControl = data.accessControl.filter(
      (item) => item.email.toLowerCase() !== previousEmail,
    );
    keysToPersist.push("accessControl");
  }

  // Cap nhat Access Control moi
  if (normalizedEmail) {
    const accessEntry = {
      id: `access-${entry.id}`,
      email: normalizedEmail,
      role: entry.role,
      displayName: entry.name,
    };
    data.accessControl = data.accessControl.filter(
      (item) => item.email.toLowerCase() !== normalizedEmail,
    );
    data.accessControl.push(accessEntry);
    if (!keysToPersist.includes("accessControl")) keysToPersist.push("accessControl");
  }

  // --- LOGIC DONG BO KHI AN (Soft Delete) ---
  if (!entry.active) {
    // 1. Don dep khoi Lich nen (templateSchedule)
    const originalTemplateCount = data.templateSchedule.length;
    data.templateSchedule = data.templateSchedule.filter(ts => ts.staffId !== entry.id);
    if (data.templateSchedule.length !== originalTemplateCount) {
      if (!keysToPersist.includes("templateSchedule")) keysToPersist.push("templateSchedule");
    }

    // 2. Don dep khoi Thu tu uu tien (staffOrder) trong cac Positions
    let posChanged = false;
    data.positions.forEach(p => {
      if (p.staffOrder && p.staffOrder.includes(entry.id)) {
        p.staffOrder = p.staffOrder.filter(sid => sid !== entry.id);
        posChanged = true;
      }
    });
    if (posChanged) {
      if (!keysToPersist.includes("positions")) keysToPersist.push("positions");
    }

    // 3. Don dep khoi Lich tuan (weeklySchedule) cho cac ca chua dien ra
    const todayStr = format(startOfToday(), "yyyy-MM-dd");
    const originalWeeklyCount = data.weeklySchedule.length;
    data.weeklySchedule = data.weeklySchedule.filter(ws => {
      if (ws.staffId !== entry.id) return true;
      // Giu lai cac ca trong qua khu de bao toan lich su, chi xoa ca tuong lai
      return ws.date < todayStr;
    });
    if (data.weeklySchedule.length !== originalWeeklyCount) {
      if (!keysToPersist.includes("weeklySchedule")) keysToPersist.push("weeklySchedule");
    }
  }

  await persistData(data, keysToPersist);
  return entry;
}

export async function upsertAccessControl(
  input: Omit<AccessControlEntry, "id"> & { id?: string },
) {
  const data = await getAppData();
  const normalizedEmail = input.email.trim().toLowerCase();
  const entry = {
    ...input,
    id: input.id || generateId("access"),
    email: normalizedEmail,
    role: input.role,
    displayName: input.displayName,
  };

  data.accessControl = data.accessControl.filter(
    (item) => item.id !== entry.id && item.email.toLowerCase() !== normalizedEmail,
  );
  data.accessControl.push(entry);
  await persistData(data, ["accessControl"]);
  return entry;
}

export async function upsertPosition(input: Omit<Position, "id"> & { id?: string }) {
  const data = await getAppData();
  const entry = {
    ...input,
    id: input.id || generateId("pos"),
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
    ...input,
    id: input.id || existing?.id || generateId("slot"),
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
      item.positionId === input.positionId &&
      (item.slotIndex || 0) === (input.slotIndex || 0),
  );

  const entry = {
    ...input,
    id: input.id || existing?.id || generateId("template"),
  };

  if (process.env.NODE_ENV === "development") {
    console.log(`📦 [Repository] upsertTemplateAssignment: ${existing ? 'Cap nhat' : 'Them moi'} entry ID="${entry.id}", staffId="${entry.staffId}"`);
  }

  data.templateSchedule = [
    ...data.templateSchedule.filter((item) => item.id !== entry.id),
    entry,
  ];

  const keysToSave: (keyof typeof data)[] = ["templateSchedule"];

  if (entry.staffId) {
    let staffUpdated = false;
    let posUpdated = false;

    // 1. Cap nhat staff.positionIds
    const staffIndex = data.staff.findIndex(s => s.id === entry.staffId);
    if (staffIndex !== -1) {
      const staff = data.staff[staffIndex];
      if (!staff.positionIds) staff.positionIds = [];
      if (!staff.positionIds.includes(entry.positionId)) {
        staff.positionIds.push(entry.positionId);
        staffUpdated = true;
      }
    }

    // 2. Cap nhat position.staffOrder
    if (staffUpdated) {
      const posIndex = data.positions.findIndex(p => p.id === entry.positionId);
      if (posIndex !== -1) {
        const pos = data.positions[posIndex];
        if (!pos.staffOrder) pos.staffOrder = [];
        if (!pos.staffOrder.includes(entry.staffId)) {
          pos.staffOrder.push(entry.staffId);
          posUpdated = true;
        }
      }
    }

    if (staffUpdated) keysToSave.push("staff");
    if (posUpdated) keysToSave.push("positions");
  }

  await persistData(data, keysToSave);
  return entry;
}

export async function upsertManyTemplateAssignments(
  inputs: Array<Omit<TemplateAssignment, "id"> & { id?: string }>,
) {
  if (!inputs.length) return [];
  const data = await getAppData();

  inputs.forEach((input) => {
    const existingIndex = data.templateSchedule.findIndex(
      (item) =>
        item.dayOfWeek === input.dayOfWeek &&
        item.shift === input.shift &&
        item.positionId === input.positionId &&
        (item.slotIndex || 0) === (input.slotIndex || 0),
    );
    const entry = {
      ...input,
      id: input.id || (existingIndex >= 0 ? data.templateSchedule[existingIndex].id : generateId("template")),
    };
    if (existingIndex >= 0) {
      data.templateSchedule[existingIndex] = entry;
    } else {
      data.templateSchedule.push(entry);
    }
  });

  await persistData(data, ["templateSchedule"]);
  return inputs;
}

export async function applyPrioritizedStaffToTemplate() {
  const data = await getAppData();
  const inactivePositionRules = data.positionRules.filter((r) => !r.active);

  const newAssignments: TemplateAssignment[] = [];

  for (let dayOfWeek = 1; dayOfWeek <= 6; dayOfWeek++) {
    if (dayOfWeek === 6) continue; // Thu 7 de trong
    for (const shift of ["morning", "afternoon"] as const) {
      const rule = data.scheduleRules.find(r => r.dayOfWeek === dayOfWeek && r.shift === shift);
      if (rule && !rule.active) continue;

      for (const position of data.positions) {
        const isPositionClosed = inactivePositionRules.some(
          (r) => r.dayOfWeek === dayOfWeek && r.shift === shift && r.positionId === position.id
        );

        const registeredStaff = data.staff.filter(
          (s) => s.active && s.positionIds.includes(position.id)
        );
        const orderList = position.staffOrder || [];
        const orderedStaff = [...registeredStaff].sort((a, b) => {
          const idxA = orderList.indexOf(a.id);
          const idxB = orderList.indexOf(b.id);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.name.localeCompare(b.name, "vi");
        });

        if (!isPositionClosed && orderedStaff.length > 0) {
          const quota = position.quota || 1;
          for (let i = 0; i < quota; i++) {
            const staffId = orderedStaff[i]?.id;
            if (staffId) {
              newAssignments.push({
                id: generateId("template"),
                dayOfWeek,
                shift,
                positionId: position.id,
                staffId: staffId,
                slotIndex: i,
              });
            }
          }
        }
      }
    }
  }

  data.templateSchedule = newAssignments;
  await persistData(data, ["templateSchedule"]);
  return data.templateSchedule;
}

export async function upsertWeeklyAssignment(
  input: Omit<WeeklyAssignment, "id" | "source"> & {
    id?: string;
    source?: WeeklyAssignment["source"];
  },
) {
  if (isPastShift(input.date, input.shift)) {
    throw new Error("Ca lam da qua nen khong the dieu chinh.");
  }

  const data = await getAppData();

  const weekAssignments = data.weeklySchedule.filter((item) => item.weekStart === input.weekStart);
  if (weekAssignments.length === 0) {
    const effectiveLeaves = getEffectiveLeaveRequests(data);
    const generated = buildAssignmentsFromTemplate(
      data.templateSchedule,
      data.positions,
      input.weekStart,
      effectiveLeaves,
      data.scheduleRules,
      data.positionRules,
      data.holidays,
    ).map((item) => ({
      ...item,
      id: generateId("weekly")
    }));
    data.weeklySchedule.push(...generated);
  }

  const existing = data.weeklySchedule.find(
    (item) =>
      item.date === input.date &&
      item.shift === input.shift &&
      item.positionId === input.positionId &&
      (item.slotIndex || 0) === (input.slotIndex || 0),
  );

  const entry: WeeklyAssignment = {
    ...input,
    id: input.id || existing?.id || generateId("weekly"),
    source: input.source ?? "manual",
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
    ...input,
    id: input.id || existing?.id || generateId("leave"),
  };

  data.leaveRequests = data.leaveRequests.filter((item) => item.id !== entry.id);
  data.leaveRequests.push(entry);
  await persistData(data, ["leaveRequests"]);
  return entry;
}

export async function upsertPositionRule(input: Omit<PositionRule, "id"> & { id?: string }) {
  const data = await getAppData();
  const existing = data.positionRules.find(
    (item) =>
      item.positionId === input.positionId &&
      item.dayOfWeek === input.dayOfWeek &&
      item.shift === input.shift,
  );

  const entry = {
    ...input,
    id: input.id || existing?.id || generateId("pos-rule"),
  };

  data.positionRules = data.positionRules.filter((item) => item.id !== entry.id);
  data.positionRules.push(entry);
  await persistData(data, ["positionRules"]);
  return entry;
}

export async function upsertManyPositionRules(rules: (Omit<PositionRule, "id"> & { id?: string })[]) {
  const data = await getAppData();

  for (const input of rules) {
    const existing = data.positionRules.find(
      (item) =>
        item.positionId === input.positionId &&
        item.dayOfWeek === input.dayOfWeek &&
        item.shift === input.shift,
    );

    const entry = {
      ...input,
      id: input.id || existing?.id || generateId("pos-rule"),
    };

    data.positionRules = data.positionRules.filter((item) => item.id !== entry.id);
    data.positionRules.push(entry);
  }

  await persistData(data, ["positionRules"]);
  return rules;
}

export async function generateWeekFromTemplate(weekStart: string) {
  const data = await getAppData();
  const effectiveLeaves = getEffectiveLeaveRequests(data);
  const generated = buildAssignmentsFromTemplate(
    data.templateSchedule,
    data.positions,
    weekStart,
    effectiveLeaves,
    data.scheduleRules,
    data.positionRules,
    data.holidays,
  ).map((item) => ({
    ...item,
    id: generateId("weekly")
  }));

  const remaining = data.weeklySchedule.filter((item) => item.weekStart !== weekStart);
  data.weeklySchedule = [...remaining, ...generated];
  await persistData(data, ["weeklySchedule"]);
  return generated;
}

export async function generateWeekIfEmpty(weekStart: string) {
  const data = await getAppData();
  const existing = data.weeklySchedule.filter((item) => item.weekStart === weekStart);
  
  if (existing.length > 0) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[Repository] Bỏ qua sinh lịch tự động vì tuần ${weekStart} đã có ${existing.length} ca.`);
    }
    return existing;
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`[Repository] Tự động sinh lịch cho tuần ${weekStart}...`);
  }
  return generateWeekFromTemplate(weekStart);
}

export async function deleteLeaveRequest(leaveId: string) {
  const data = await getAppData();
  data.leaveRequests = data.leaveRequests.filter((item) => item.id !== leaveId);
  await persistData(data, ["leaveRequests"]);
}

export async function addLeaveCancellation(
  input: Omit<LeaveCancellation, "id">,
) {
  const data = await getAppData();
  const entry: LeaveCancellation = {
    ...input,
    id: generateId("cancel"),
  };
  data.leaveCancellations.push(entry);
  await persistData(data, ["leaveCancellations"]);
  return entry;
}

export async function upsertHoliday(input: { id?: string; date: string; name: string; note?: string }) {
  const data = await getAppData();
  const entry = {
    ...input,
    id: input.id || generateId("holiday"),
  };

  data.holidays = [
    ...data.holidays.filter((h) => h.id !== entry.id),
    entry,
  ].sort((a, b) => a.date.localeCompare(b.date));

  await persistData(data, ["holidays"]);
  return entry;
}

export async function deleteHoliday(id: string) {
  const data = await getAppData();
  data.holidays = data.holidays.filter((h) => h.id !== id);
  await persistData(data, ["holidays"]);
}

export async function syncSaturdayOvertime(
  date: string,
  shift: "morning" | "afternoon",
  weekStart: string,
  staffIds: string[]
) {
  if (isPastShift(date, shift)) {
    throw new Error("Ca lam da qua nen khong the dieu chinh.");
  }

  const data = await getAppData();

  const remainingSchedule = data.weeklySchedule.filter(
    (item) => !(item.date === date && item.shift === shift && item.positionId === SATURDAY_OT_POSITION_ID)
  );

  const newAssignments = staffIds.map((staffId, index) => ({
    id: generateId("weekly"),
    weekStart,
    date,
    shift,
    positionId: SATURDAY_OT_POSITION_ID, // Vị trí ẩn dành riêng cho Tăng ca T7
    staffId,
    slotIndex: index,
    source: "manual" as const,
    status: "published" as const,
  }));

  data.weeklySchedule = [...remainingSchedule, ...newAssignments];
  await persistData(data, ["weeklySchedule"]);
  return newAssignments;
}
