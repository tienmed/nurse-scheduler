"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Printer, Search, Users } from "lucide-react";
import type { LeaveRecord, Position, ShiftType, StaffMember } from "@/lib/types";
import { getAreaStyle, getStaffColorStyle, getStaffLeaveLabel, getStaffMatrixLabel } from "./types";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { format, parseISO } from "date-fns";

export interface SlotInfo {
  date: string;
  shift: ShiftType;
  dayOfWeek: number;
  label: string;
}

interface RoomSummaryMatrixProps {
  weekStart: string;
  positions: Position[];
  staff: StaffMember[];
  slots: SlotInfo[];
  // Map: `${date}_${shift}` -> Array of { positionId: string; staffId: string }
  assignmentsBySlot: Record<string, { positionId: string; staffId: string }[]>;
  leaveRequests?: LeaveRecord[];
  onBackToDnD: () => void;
  onSaveAll?: () => void;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
}

export function RoomSummaryMatrix({
  weekStart,
  positions,
  staff,
  slots,
  assignmentsBySlot,
  leaveRequests = [],
  onBackToDnD,
  onSaveAll,
  isSaving = false,
  hasUnsavedChanges = false,
}: RoomSummaryMatrixProps) {
  const [search, setSearch] = useState("");

  // Map staff id -> StaffMember để tra cứu nhanh
  const staffMap = useMemo(() => {
    return new Map(staff.map((s) => [s.id, s]));
  }, [staff]);

  // Lọc danh sách phòng theo từ khóa
  const filteredPositions = useMemo(() => {
    if (!search.trim()) return positions;
    const q = search.toLowerCase();
    return positions.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.area && p.area.toLowerCase().includes(q)),
    );
  }, [positions, search]);

  // Gom nhóm phòng theo khu vực
  const groupedPositions = useMemo(() => {
    const map = new Map<string, Position[]>();
    for (const pos of filteredPositions) {
      const area = pos.area?.trim() || "Khu vực khác";
      const list = map.get(area) ?? [];
      list.push(pos);
      map.set(area, list);
    }
    return Array.from(map.entries());
  }, [filteredPositions]);

  // Map lookup: `${positionId}_${date}_${shift}` -> StaffMember[]
  const positionAssignmentsMap = useMemo(() => {
    const map = new Map<string, StaffMember[]>();

    for (const [slotKey, list] of Object.entries(assignmentsBySlot)) {
      for (const item of list) {
        const key = `${item.positionId}_${slotKey}`;
        const staffObj = staffMap.get(item.staffId);
        if (staffObj) {
          const current = map.get(key) ?? [];
          current.push(staffObj);
          map.set(key, current);
        }
      }
    }

    return map;
  }, [assignmentsBySlot, staffMap]);

  // Nhóm các slot theo ngày để vẽ header 2 tầng
  const daysGrouped = useMemo(() => {
    const map = new Map<string, { date: string; dayOfWeek: number; slots: SlotInfo[] }>();
    for (const slot of slots) {
      if (!map.has(slot.date)) {
        map.set(slot.date, { date: slot.date, dayOfWeek: slot.dayOfWeek, slots: [] });
      }
      map.get(slot.date)!.slots.push(slot);
    }
    return Array.from(map.values());
  }, [slots]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    let totalAssignedSlots = 0;
    let emptySlots = 0;

    for (const pos of positions) {
      for (const slot of slots) {
        const key = `${pos.id}_${slot.date}_${slot.shift}`;
        const assigned = positionAssignmentsMap.get(key);
        if (assigned && assigned.length > 0) {
          totalAssignedSlots += assigned.length;
        } else {
          emptySlots += 1;
        }
      }
    }

    return { totalAssignedSlots, emptySlots };
  }, [positions, slots, positionAssignmentsMap]);

  return (
    <div className="space-y-5">
      {/* Thanh điều khiển trên cùng */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToDnD}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại Kéo – Thả điều chỉnh
          </button>

          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Bảng Tổng Hợp Phân Công Phòng
            </h2>
            <p className="text-xs text-slate-500">
              Tuần bắt đầu {format(parseISO(weekStart), "dd/MM/yyyy")} • Mỗi dòng là 1 phòng (gom theo khu), các cột là buổi/ngày.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tìm kiếm */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Lọc phòng hoặc khu vực..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 sm:w-60 rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {/* Xuất Excel Ma trận */}
          <a
            href={`/api/export/room-matrix?week=${weekStart}`}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 shadow-xs cursor-pointer transition-all"
            title="Xuất file Excel ma trận giống ảnh mẫu"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
            Xuất Excel Ma Trận
          </a>

          {/* In bảng */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer transition-all"
            title="In bảng tổng hợp hoặc xuất PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            In bảng
          </button>

          {/* Nút lưu tất cả nếu có thay đổi */}
          {hasUnsavedChanges && onSaveAll && (
            <button
              type="button"
              onClick={onSaveAll}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-500 active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSaving ? "Đang lưu..." : "Lưu tất cả vào Lịch tuần"}
            </button>
          )}
        </div>
      </div>

      {/* Thông số tổng quan */}
      <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600 print:hidden">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 border border-teal-200 px-3 py-1 text-teal-800">
          <Users className="h-3.5 w-3.5" />
          Tổng lượt phân phòng: <strong>{stats.totalAssignedSlots}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1 text-slate-700">
          Tổng số phòng: <strong>{positions.length}</strong>
        </span>
        {stats.emptySlots > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1 text-amber-800">
            Số lượt ca phòng chưa có người: <strong>{stats.emptySlots}</strong>
          </span>
        )}
      </div>

      {/* Bảng tổng hợp Ma trận */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead>
              {/* Hàng 1: Tiêu đề Cột Phòng & Các Ngày trong tuần */}
              <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-700">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 w-64 min-w-[240px] border-r border-slate-200 bg-slate-100/90 p-3.5 font-bold uppercase tracking-wider text-slate-800 shadow-xs"
                >
                  Khu vực / Phòng làm việc
                </th>

                {daysGrouped.map((day) => (
                  <th
                    key={day.date}
                    colSpan={day.slots.length}
                    className="border-r border-slate-200 p-2.5 text-center font-bold text-slate-800"
                  >
                    <div className="font-extrabold text-teal-900">
                      {WEEKDAY_LABELS[day.dayOfWeek]}
                    </div>
                    <div className="text-[11px] font-normal text-slate-500">
                      {format(parseISO(day.date), "dd/MM")}
                    </div>
                  </th>
                ))}
              </tr>

              {/* Hàng 2: Các ca con (Sáng / Chiều) */}
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-600">
                {slots.map((slot) => (
                  <th
                    key={`${slot.date}_${slot.shift}`}
                    className={`border-r border-slate-200 p-2 text-center font-bold text-[11px] min-w-[110px] ${
                      slot.shift === "morning" ? "bg-amber-50/40 text-amber-900" : "bg-sky-50/40 text-sky-900"
                    }`}
                  >
                    {slot.shift === "morning" ? "Sáng" : "Chiều"}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {groupedPositions.map(([area, posList]) => {
                const style = getAreaStyle(area);

                return (
                  <tr key={`area-group-${area}`} className="contents">
                    {/* Header phân cách khu vực */}
                    <tr className={`border-t-2 border-b ${style.border} ${style.bg}`}>
                      <td
                        colSpan={slots.length + 1}
                        className={`sticky left-0 z-10 px-4 py-2 font-bold ${style.text}`}
                      >
                        <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-bold ${style.lightBg}`}>
                          Khu vực: {area} ({posList.length} phòng)
                        </span>
                      </td>
                    </tr>

                    {/* Từng dòng phòng trong khu vực */}
                    {posList.map((pos) => {
                      return (
                        <tr
                          key={pos.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          {/* Cột Tên phòng */}
                          <td className="sticky left-0 z-10 border-r border-slate-200 bg-white/95 px-4 py-3 font-semibold text-slate-900 shadow-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-850">{pos.name}</span>
                              {pos.quota && pos.quota > 1 && (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-medium">
                                  ĐB: {pos.quota}
                                </span>
                              )}
                            </div>
                            {pos.description && (
                              <p className="mt-0.5 text-[10px] text-slate-400 truncate max-w-[200px]">
                                {pos.description}
                              </p>
                            )}
                          </td>

                          {/* Các ô buổi / ngày tương ứng */}
                          {slots.map((slot) => {
                            const key = `${pos.id}_${slot.date}_${slot.shift}`;
                            const assignedStaff = positionAssignmentsMap.get(key) || [];
                            const hasStaff = assignedStaff.length > 0;

                            return (
                              <td
                                key={`${pos.id}_${slot.date}_${slot.shift}`}
                                className="border-r border-slate-200/80 p-2 align-top text-center"
                              >
                                {hasStaff ? (
                                  <div className="flex flex-col gap-1">
                                    {assignedStaff.map((person) => {
                                      const matrixLabel = getStaffMatrixLabel(person.name);
                                      const colorStyle = getStaffColorStyle(person.id || person.name);

                                      return (
                                        <div
                                          key={person.id}
                                          className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-1 text-[11px] font-bold shadow-2xs text-left ${colorStyle.bg} ${colorStyle.border} ${colorStyle.text}`}
                                          title={`${person.name} (${person.code || person.id})`}
                                        >
                                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colorStyle.avatarBg}`} />
                                          <span className="truncate">{matrixLabel}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 select-none">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Dòng Phép ở cuối bảng giống 100% ảnh mẫu thực tế */}
              <tr className="border-t-2 border-amber-300 bg-amber-50/70 font-semibold">
                <td className="sticky left-0 z-10 border-r border-slate-200 bg-amber-100/90 px-4 py-3 font-bold text-amber-950 shadow-xs">
                  Phép
                </td>
                {slots.map((slot) => {
                  const leavesOnSlot = leaveRequests.filter(
                    (l) =>
                      l.date === slot.date &&
                      (l.shift === "full-day" || l.shift === slot.shift),
                  );
                  const staffLeaves = leavesOnSlot
                    .map((l) => {
                      const staffObj = staffMap.get(l.staffId);
                      return staffObj ? { person: staffObj, leave: l } : null;
                    })
                    .filter(Boolean) as { person: StaffMember; leave: LeaveRecord }[];

                  return (
                    <td
                      key={`leave-${slot.date}-${slot.shift}`}
                      className="border-r border-slate-200/80 p-1.5 align-top text-center text-xs text-amber-900"
                    >
                      {staffLeaves.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {staffLeaves.map(({ person, leave }) => {
                            const leaveLabel = getStaffLeaveLabel(person.name, leave.reason, leave.note);
                            const colorStyle = getStaffColorStyle(person.id || person.name);

                            return (
                              <span
                                key={leave.id || `${person.id}-${slot.date}`}
                                className={`inline-flex items-center justify-center gap-1 rounded-xl px-2 py-0.5 text-[10px] font-bold shadow-2xs border ${colorStyle.bg} ${colorStyle.border} ${colorStyle.text}`}
                                title={`${person.name} (${person.code || "NV"}) - Lý do: ${leave.reason} ${leave.note ? `(${leave.note})` : ""}`}
                              >
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colorStyle.avatarBg}`} />
                                {leaveLabel}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-300 select-none">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
