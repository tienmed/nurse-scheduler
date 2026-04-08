import { DEMO_ACCESS_CONTROL } from "@/lib/constants";
import { isSheetsConfigured } from "@/lib/env";
import {
  getCachedAppData,
  invalidateAppDataCache,
  readAppDataFromSheets,
  writeAppDataKeysToSheets,
} from "@/lib/google-sheets";
import { MOCK_DATA } from "@/lib/mock-data";
import { buildAssignmentsFromTemplate, getWeekBoard } from "@/lib/schedule";
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
  } catch (e) {
    // ignore
  }
  return 0; // 0 means show all
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

  // Áp dụng bộ lọc thời gian nếu có cấu hình chân trời dữ liệu (Horizon)
  if (horizonDays > 0) {
    const { subDays, parseISO, isAfter, startOfToday } = await import("date-fns");
    const cutoffDate = subDays(startOfToday(), horizonDays);

    const filterByDate = (items: any[]) =>
      items.filter((item) => {
        if (!item.date) return true;
        try {
          return isAfter(parseISO(item.date), cutoffDate);
        } catch {
          return true;
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
      console.log(`🧹 [Horizon Filter] Đã lọc dữ liệu > ${horizonDays} ngày:`);
      console.log(`   - Lịch tuần: ${originalCounts.weekly} -> ${data.weeklySchedule.length}`);
      console.log(`   - Nghỉ phép: ${originalCounts.leaves} -> ${data.leaveRequests.length}`);
    }
  }

  // Đảm bảo các trường mới luôn tồn tại (phòng trường hợp cache cũ hoặc sheet trống)
  if (!data.positionRules) {
    data.positionRules = [];
  }
  if (!data.leaveCancellations) {
    data.leaveCancellations = [];
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
  invalidateAppDataCache();
}

export { writeAppDataKeysToSheets, invalidateAppDataCache };

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

  if (previousEmail && previousEmail !== normalizedEmail) {
    data.accessControl = data.accessControl.filter(
      (item) => item.email.toLowerCase() !== previousEmail,
    );
  }

  if (normalizedEmail) {
    const accessEntry = {
      id: existing ? `access-${entry.id}` : `access-${entry.id}`,
      email: normalizedEmail,
      role: entry.role,
      displayName: entry.name,
    };

    data.accessControl = data.accessControl.filter(
      (item) => item.email.toLowerCase() !== normalizedEmail,
    );
    data.accessControl.push(accessEntry);
  }

  await persistData(data, normalizedEmail || previousEmail ? ["staff", "accessControl"] : ["staff"]);
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
    console.log(`📦 [Repository] upsertTemplateAssignment: ${existing ? 'Cập nhật' : 'Thêm mới'} entry ID="${entry.id}", staffId="${entry.staffId}"`);
  }

  data.templateSchedule = [
    ...data.templateSchedule.filter((item) => item.id !== entry.id),
    entry,
  ];

  const keysToSave: (keyof typeof data)[] = ["templateSchedule"];

  // Đồng bộ ngược: Nếu nhân sự được gán vào 1 vị trí cố định ở Lịch nền,
  // Tự động bổ sung nhân sự đó vào danh sách vị trí nếu chưa có.
  if (entry.staffId) {
    let staffUpdated = false;
    let posUpdated = false;

    // 1. Cập nhật staff.positionIds
    const staffIndex = data.staff.findIndex(s => s.id === entry.staffId);
    if (staffIndex !== -1) {
      const staff = data.staff[staffIndex];
      // Type staff.positionIds as it might be undefined/not array
      if (!staff.positionIds) staff.positionIds = [];
      if (!staff.positionIds.includes(entry.positionId)) {
        staff.positionIds.push(entry.positionId);
        staffUpdated = true;
      }
    }

    // 2. Cập nhật position.staffOrder
    if (staffUpdated || true) { // Always check posOrder
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

  // Duyệt qua tất cả các cấu hình ca mặc định (nếu data.scheduleRules trống, coi như lấy từ hằng số bên UI, nhưng repository thì phải tự định nghĩa hoặc lặp qua 1-6 * sáng/chiều)
  // Thực tế: Lịch nền sẽ áp dụng cho Tuần T2-T7, ca Sáng/Chiều
  for (let dayOfWeek = 1; dayOfWeek <= 6; dayOfWeek++) {
    for (const shift of ["morning", "afternoon"] as const) {
      // Bỏ qua nếu rules bị đóng (nếu có scheduleRules)
      const rule = data.scheduleRules.find(r => r.dayOfWeek === dayOfWeek && r.shift === shift);
      if (rule && !rule.active) continue;

      for (const position of data.positions) {
        const isPositionClosed = inactivePositionRules.some(
          (r) => r.dayOfWeek === dayOfWeek && r.shift === shift && r.positionId === position.id
        );

        // Sinh danh sách ưu tiên động y hệt bên Area (tránh lỗi ảo)
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
  const data = await getAppData();
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
  const generated = buildAssignmentsFromTemplate(
    data.templateSchedule,
    data.positions,
    weekStart,
    data.leaveRequests,
    data.scheduleRules,
    data.positionRules,
  ).map((item) => ({
    ...item,
    id: generateId("weekly")
  }));

  const remaining = data.weeklySchedule.filter((item) => item.weekStart !== weekStart);
  data.weeklySchedule = [...remaining, ...generated];
  await persistData(data, ["weeklySchedule"]);
  return generated;
}

export async function publishWeek(weekStart: string) {
  const data = await getAppData();

  // 1. Phục hồi mảng dự kiến hiện tại (trên màn hình đang có gì)
  let displayedAssignments = data.weeklySchedule.filter(
    (item) => item.weekStart === weekStart
  );

  if (displayedAssignments.length === 0) {
    displayedAssignments = buildAssignmentsFromTemplate(
      data.templateSchedule,
      data.positions,
      weekStart,
      data.leaveRequests,
      data.scheduleRules,
      data.positionRules,
    );
  }

  // 2. Dựng fullBoard tương tự UI để lấy những người tự điền qua Định mức (staffOrder)
  const fullBoard = getWeekBoard(
    displayedAssignments,
    data.positions,
    data.staff,
    data.leaveRequests,
    weekStart,
    data.scheduleRules,
    data.positionRules,
  );

  const publishedAssignments: WeeklyAssignment[] = [];

  // 3. Quét tóm tất cả những slot có người để chốt
  for (const day of fullBoard) {
    for (const entry of day.entries) {
      for (const slot of entry.slots) {
        if (!slot.person) continue;

        const isPreview = slot.assignment?.id?.startsWith("preview-");
        const finalId = (!slot.assignment || isPreview)
          ? generateId("weekly")
          : slot.assignment.id;

        publishedAssignments.push({
          id: finalId,
          weekStart,
          date: day.date,
          shift: day.shift,
          positionId: entry.position.id,
          staffId: slot.person.id,
          slotIndex: slot.slotIndex,
          source: slot.assignment?.source || "template",
          status: "published",
          note: slot.assignment?.note ?? "",
        });
      }
    }
  }

  // 4. Lưu đè đợt assignment mới này vào Database
  const remaining = data.weeklySchedule.filter((item) => item.weekStart !== weekStart);
  data.weeklySchedule = [...remaining, ...publishedAssignments];

  await persistData(data, ["weeklySchedule"]);
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
