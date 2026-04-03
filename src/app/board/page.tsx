import { BoardTabs } from "@/components/board-tabs";

import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getWeekStartFromInput } from "@/lib/date";
import { getAppData } from "@/lib/repository";
import {
  buildAssignmentsFromTemplate,
  getActiveScheduleRules,
  getWeekBoard,
  getWeeklyAssignments,
} from "@/lib/schedule";
import Link from "next/link";
import { WEEKDAY_LABELS } from "@/lib/constants";
import type { Position } from "@/lib/types";

interface BoardPageProps {
  searchParams: Promise<{
    week?: string;
    day?: string;
    shift?: string;
    view?: string;
  }>;
}

// Bảng ưu tiên khu vực
const AREA_PRIORITY: Record<string, number> = {
  "sảnh": 0,
  "trệt": 1,
  "tầng 1": 2,
  "tầng 2": 3,
};

function getAreaPriority(area?: string): number {
  if (!area) return 99;
  const lower = area.toLowerCase().trim();
  if (AREA_PRIORITY[lower] !== undefined) return AREA_PRIORITY[lower];
  for (const [key, value] of Object.entries(AREA_PRIORITY)) {
    if (lower.startsWith(key)) return value;
  }
  return 98;
}


// Gom nhóm position theo area rồi chia trái/phải
type PositionEntry = {
  position: Position;
  staffNames: string[];
};

type AreaGroup = {
  area: string;
  left: PositionEntry[];
  right: PositionEntry[];
  center: PositionEntry[];
};

function getDefaultDayAndShift(weekStart: string): { day: number; shift: "morning" | "afternoon" } {
  // Lấy giờ hiện tại chuẩn theo múi giờ Việt Nam (UTC+7)
  const now = new Date();
  const vnTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));

  const weekStartDate = parseISO(weekStart);
  const weekEndDate = addDays(weekStartDate, 5); // T2 -> T7 (5 days diff)

  // Chỉ bắt tab nếu ngày hiện nay nằm trong phạm vi của tuần đang xem
  if (vnTime >= weekStartDate && vnTime <= addDays(weekEndDate, 1)) {
    const currentDay = vnTime.getDay(); // 0 = Chủ nhật
    const hour = vnTime.getHours();

    if (currentDay === 0) return { day: 1, shift: "morning" };
    return { day: currentDay, shift: hour < 12 ? "morning" : "afternoon" };
  }
  return { day: 1, shift: "morning" };
}

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const { week, day: dayParam, shift: shiftParam, view } = await searchParams;
  const isPersonnelView = view === "personnel";
  const weekStart = getWeekStartFromInput(week);
  const currentWeekStart = getWeekStartFromInput(); // Tuần hiện tại thực tế
  const isCurrentWeek = weekStart === currentWeekStart;
  const data = await getAppData();

  const actualAssignments = getWeeklyAssignments(data.weeklySchedule, weekStart);
  const displayedAssignments =
    actualAssignments.length > 0
      ? actualAssignments
      : buildAssignmentsFromTemplate(
        data.templateSchedule,
        data.positions,
        weekStart,
        data.leaveRequests,
        data.scheduleRules,
        data.positionRules,
      );

  const fullBoard = getWeekBoard(
    displayedAssignments,
    data.positions,
    data.staff,
    data.leaveRequests,
    weekStart,
    data.scheduleRules,
    data.positionRules,
  );

  const activeRules = getActiveScheduleRules(data.scheduleRules);

  // Tính ngày + buổi đang chọn
  const defaults = getDefaultDayAndShift(weekStart);
  const selectedDay = dayParam ? Number(dayParam) : defaults.day;
  const selectedShift: "morning" | "afternoon" =
    shiftParam === "morning" || shiftParam === "afternoon" ? shiftParam : defaults.shift;

  // Filter board: chỉ lấy 1 slot khớp
  const currentSlot = fullBoard.find(
    (slot) => slot.dayOfWeek === selectedDay && slot.shift === selectedShift,
  );

  // Build tabs
  const slotTabs = activeRules.map((rule) => {
    const isActive = rule.dayOfWeek === selectedDay && rule.shift === selectedShift;
    return {
      dayOfWeek: rule.dayOfWeek,
      shift: rule.shift,
      label: `${rule.shift === "morning" ? "S" : "C"} ${WEEKDAY_LABELS[rule.dayOfWeek].replace("Thứ ", "T")}`,
      href: `/board?week=${weekStart}&day=${rule.dayOfWeek}&shift=${rule.shift}${isPersonnelView ? '&view=personnel' : ''}`,
      isActive,
    };
  });

  // Ngày hiển thị
  const startDate = parseISO(weekStart);
  const endDate = addDays(startDate, 6);
  const currentDate = currentSlot?.date
    ? format(parseISO(currentSlot.date), "dd/MM")
    : "";

  // Nhóm position theo area
  const areaMap = new Map<string, AreaGroup>();

  if (currentSlot) {
    for (const entry of currentSlot.entries) {
      const area = entry.position.area || "Khác";
      // Tách phần khu vực chính (VD: "Trệt phải" → baseArea = "Trệt")
      const lower = area.toLowerCase().trim();
      let baseArea = area;
      for (const key of Object.keys(AREA_PRIORITY)) {
        if (lower.startsWith(key)) {
          baseArea = key.charAt(0).toUpperCase() + key.slice(1);
          break;
        }
      }

      if (!areaMap.has(baseArea)) {
        areaMap.set(baseArea, { area: baseArea, left: [], right: [], center: [] });
      }
      const group = areaMap.get(baseArea)!;

      const staffNames = entry.slots
        .map((s: { person?: { name?: string } | null }) => s.person?.name ?? "")
        .filter(Boolean);

      const posEntry: PositionEntry = {
        position: entry.position,
        staffNames,
      };

      if (lower.includes("phải")) {
        group.right.push(posEntry);
      } else if (lower.includes("trái")) {
        group.left.push(posEntry);
      } else {
        group.center.push(posEntry);
      }
    }
  }

  // Gom nhóm Personnel
  const personnelMap = new Map<string, { person: { id: string, name: string }, positions: Position[] }>();

  if (currentSlot && isPersonnelView) {
    for (const entry of currentSlot.entries) {
      for (const subslot of entry.slots) {
        if (subslot.person) {
          let pData = personnelMap.get(subslot.person.id);
          if (!pData) {
            pData = { person: subslot.person, positions: [] };
            personnelMap.set(subslot.person.id, pData);
          }
          if (!pData.positions.some((p) => p.id === entry.position.id)) {
            pData.positions.push(entry.position);
          }
        }
      }
    }
  }

  const personnelList = Array.from(personnelMap.values()).sort((a, b) =>
    a.person.name.localeCompare(b.person.name)
  );

  // Sắp xếp areaGroups theo ưu tiên
  const sortedGroups = Array.from(areaMap.values()).sort((a, b) => {
    return getAreaPriority(a.area) - getAreaPriority(b.area);
  });

  // Màu nền cho từng khu vực
  const areaColors: Record<string, { bg: string; border: string; badge: string }> = {
    "Sảnh": { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-600" },
    "Trệt": { bg: "bg-sky-50", border: "border-sky-200", badge: "bg-sky-600" },
    "Tầng 1": { bg: "bg-violet-50", border: "border-violet-200", badge: "bg-violet-600" },
    "Tầng 2": { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-600" },
  };
  const defaultColor = { bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-600" };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Lịch tuần từ {format(startDate, "dd/MM/yyyy")} đến {format(endDate, "dd/MM/yyyy")}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {currentSlot ? `${currentSlot.title} • ${currentDate}` : "Chọn buổi bên dưới"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-teal-100 px-3 py-1.5 font-semibold text-teal-700">
                {actualAssignments.length > 0 ? "Chính thức" : "Dự kiến"}
              </span>
              <div className="flex h-8 items-center rounded-full bg-slate-200 p-1">
                <Link
                  href={`/board?week=${weekStart}&day=${selectedDay}&shift=${selectedShift}&view=calendar`}
                  className={`flex h-full items-center rounded-full px-4 font-semibold transition-colors ${!isPersonnelView ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                  Lịch
                </Link>
                <Link
                  href={`/board?week=${weekStart}&day=${selectedDay}&shift=${selectedShift}&view=personnel`}
                  className={`flex h-full items-center rounded-full px-4 font-semibold transition-colors ${isPersonnelView ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                  Nhân sự
                </Link>
              </div>
              {isCurrentWeek ? (
                <Link
                  href={`/board?week=${format(addDays(parseISO(currentWeekStart), 7), "yyyy-MM-dd")}${isPersonnelView ? "&view=personnel" : ""}`}
                  className="flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 font-semibold text-white shadow-sm transition-all hover:bg-slate-700 active:scale-95"
                >
                  Tuần sau
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Link
                  href={`/board?week=${currentWeekStart}${isPersonnelView ? "&view=personnel" : ""}`}
                  className="flex items-center gap-1 rounded-full bg-teal-600 px-3 py-1.5 font-semibold text-white shadow-sm transition-all hover:bg-teal-500 active:scale-95"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Tuần hiện tại
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <BoardTabs tabs={slotTabs} />

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {isPersonnelView ? (
          personnelList.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {personnelList.map((data) => (
                <div key={data.person.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700 font-bold">
                      {data.person.name.charAt(0)}
                    </div>
                    <h3 className="font-bold text-slate-900 flex-1 leading-tight">{data.person.name}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.positions.map(pos => (
                      <span key={pos.id} className="inline-flex items-center rounded-lg bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 border border-teal-200">
                        {pos.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-16 text-center">
              <p className="text-lg font-semibold text-slate-900">Không có nhân viên</p>
              <p className="mt-2 text-sm text-slate-500">Buổi này chưa có nhân sự nào được xếp lịch.</p>
            </div>
          )
        ) : sortedGroups.length > 0 ? (
          <div className="space-y-6">
            {sortedGroups.map((group) => {
              const colors = areaColors[group.area] || defaultColor;
              const hasLeftRight = group.left.length > 0 || group.right.length > 0;

              return (
                <section
                  key={group.area}
                  className={`rounded-3xl border ${colors.border} ${colors.bg} p-5 shadow-sm`}
                >
                  {/* Badge khu vực */}
                  <div className="mb-4 flex items-center gap-3">
                    <span className={`rounded-full ${colors.badge} px-4 py-1.5 text-sm font-bold text-white shadow-sm`}>
                      {group.area}
                    </span>
                  </div>

                  {/* Nội dung */}
                  {hasLeftRight ? (
                    <div className="grid gap-0 md:grid-cols-[1fr_auto_1fr]">
                      {/* Bên phải */}
                      <div className="p-3">
                        <div className="mb-3 flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${colors.badge}`} />
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Bên phải</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {group.right.map((entry) => (
                            <PositionCard key={entry.position.id} entry={entry} />
                          ))}
                          {group.right.length === 0 && (
                            <p className="text-sm italic text-slate-300 col-span-2">Không có vị trí</p>
                          )}
                        </div>
                      </div>

                      {/* Divider dọc (desktop) / ngang (mobile) */}
                      <div className="hidden md:flex md:items-stretch md:justify-center md:px-1">
                        <div className="w-px bg-slate-300/60" />
                      </div>
                      <div className="mx-3 border-t border-slate-300/60 md:hidden" />

                      {/* Bên trái */}
                      <div className="p-3">
                        <div className="mb-3 flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${colors.badge}`} />
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Bên trái</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {group.left.map((entry) => (
                            <PositionCard key={entry.position.id} entry={entry} />
                          ))}
                          {group.left.length === 0 && (
                            <p className="text-sm italic text-slate-300 col-span-2">Không có vị trí</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Vị trí không thuộc trái/phải */}
                  {group.center.length > 0 && (
                    <div className={hasLeftRight ? "mt-4" : ""}>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {group.center.map((entry) => (
                          <PositionCard key={entry.position.id} entry={entry} />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-16 text-center">
            <p className="text-lg font-semibold text-slate-900">Chưa có lịch</p>
            <p className="mt-2 text-sm text-slate-500">Buổi này chưa có dữ liệu phân công.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function PositionCard({ entry }: { entry: PositionEntry }) {
  const hasStaff = entry.staffNames.length > 0;

  return (
    <div className="rounded-2xl border border-white/80 bg-white px-4 py-3.5 shadow-sm transition-all hover:shadow-md">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        {entry.position.name}
      </p>
      <div className="mt-2 space-y-1">
        {hasStaff ? (
          entry.staffNames.map((name, idx) => (
            <p key={idx} className="text-sm font-semibold text-slate-900">{name}</p>
          ))
        ) : (
          <p className="text-sm italic text-slate-400">Chưa phân công</p>
        )}
      </div>
    </div>
  );
}
