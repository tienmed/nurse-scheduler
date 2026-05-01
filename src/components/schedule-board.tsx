"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, Clock, NotebookPen, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/pill";
import { saveSingleTemplateAssignmentAction, saveWeeklyAssignmentAction } from "@/app/actions";
import { ASSIGNMENT_STATUS_LABELS, LEAVE_REASON_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/date";
import { getStatusTone, isOvertimeSlot } from "@/lib/schedule";
import type {
  LeaveRecord,
  Position,
  ShiftType,
  StaffMember,
  WeeklyAssignment,
  WorkloadSummary,
} from "@/lib/types";
import { ShiftEditDialog } from "./shift-edit-dialog";

interface SlotEntry {
  assignment?: WeeklyAssignment | null;
  person?: StaffMember | null;
  leave?: LeaveRecord | null;
  slotIndex: number;
}

interface BoardEntry {
  position: Position;
  slots: SlotEntry[];
}

interface BoardSlot {
  date: string;
  dayOfWeek: number;
  shift: ShiftType;
  title: string;
  entries: BoardEntry[];
}

interface ScheduleBoardProps {
  board: BoardSlot[];
  positions?: Position[];
  emptyTitle?: string;
  emptyDescription?: string;

  // Các tham số mới phục vụ Popup
  staff?: StaffMember[];
  leaveRequests?: LeaveRecord[];
  workload?: WorkloadSummary[];
  weeklySchedule?: WeeklyAssignment[];
  weekStart?: string;
  editable?: boolean;
  mode?: "weekly" | "template";
  showEmptySlotSummary?: boolean;
}

function groupEntriesByArea(entries: BoardEntry[]) {
  const groups = new Map<string, BoardEntry[]>();
  for (const entry of entries) {
    const area = entry.position.area || "Khác";
    const list = groups.get(area) ?? [];
    list.push(entry);
    groups.set(area, list);
  }
  return groups;
}

function getRotationTooltip(person: StaffMember, positions: Position[]) {
  if (!person.positionIds.length) return "";
  const names = person.positionIds
    .map((id) => positions.find((p) => p.id === id)?.name)
    .filter(Boolean);
  return names.length > 0 ? `Có thể luân chuyển: ${names.join(", ")}` : "";
}

export function ScheduleBoard({
  board,
  positions = [],
  emptyTitle = "Chưa có khung lịch để hiển thị",
  emptyDescription = "Hãy thêm vị trí và bật ít nhất một ca làm trong lịch nền để bắt đầu lập lịch tuần.",

  staff = [],
  leaveRequests = [],
  workload = [],
  weeklySchedule = [],
  weekStart = "",
  editable = false,
  mode = "weekly",
  showEmptySlotSummary = false,
}: ScheduleBoardProps) {
  // Trạng thái modal
  const [editingSlot, setEditingSlot] = useState<{
    slot: BoardSlot;
    entry: BoardEntry;
    subslot: SlotEntry;
    rect?: DOMRect;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingClearKey, setPendingClearKey] = useState<string | null>(null);

  const clearAssignmentQuickly = (
    slot: BoardSlot,
    entry: BoardEntry,
    subslot: SlotEntry,
  ) => {
    const key = `${slot.date}-${slot.shift}-${entry.position.id}-${subslot.slotIndex}`;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("returnTo", mode === "template" ? "/template" : `/schedule?week=${weekStart}&day=${slot.dayOfWeek}&shift=${slot.shift}`);
      formData.set("weekStart", weekStart);
      formData.set("date", slot.date);
      formData.set("dayOfWeek", String(slot.dayOfWeek));
      formData.set("shift", slot.shift);
      formData.set("status", subslot.assignment ? "adjusted" : "draft");
      formData.set("positionId", entry.position.id);
      formData.set("staffId", "");
      formData.set("slotIndex", String(subslot.slotIndex ?? 0));
      if (subslot.assignment?.id) formData.set("id", subslot.assignment.id);
      setPendingClearKey(key);
      try {
        if (mode === "template") {
          await saveSingleTemplateAssignmentAction(formData);
        } else {
          await saveWeeklyAssignmentAction(formData);
        }
      } finally {
        setPendingClearKey(null);
      }
    });
  };

  if (board.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title={emptyTitle}
        description={emptyDescription}
        tips={[
          "Thêm vị trí làm việc ở trang Nhân sự.",
          "Bật ca làm ở trang Lịch nền.",
        ]}
        tone="slate"
      />
    );
  }

  return (
    <div className="space-y-5">
      {board.map((slot) => {
        const areaGroups = groupEntriesByArea(slot.entries);

        return (
          <section key={`${slot.date}-${slot.shift}`} className="space-y-4">
            <div className="flex flex-col gap-2 rounded-[26px] border border-slate-900/8 bg-[linear-gradient(135deg,rgba(15,23,42,0.96)_0%,rgba(30,41,59,0.92)_54%,rgba(13,148,136,0.82)_100%)] px-4 py-4 text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)] md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">{slot.title}</h3>
                <p className="text-sm text-white/72">{formatDate(slot.date, "dd/MM/yyyy")}</p>
              </div>
              <div className="flex gap-2">
                <Pill tone="teal">{slot.entries.flatMap(e => e.slots).filter((s) => s.assignment).length} vị trí đã gán</Pill>
                <Pill tone="amber">
                  {slot.entries.flatMap((e) => e.slots).filter((s) => !s.person && s.assignment?.staffId !== "CLOSED").length} slot trống
                </Pill>
                {isOvertimeSlot(slot.date, slot.shift) ? (
                  <Pill tone="amber">Tăng ca</Pill>
                ) : null}
              </div>
            </div>

            {showEmptySlotSummary && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                <p className="mb-2 text-sm font-semibold text-amber-900">Tổng quan slot trống đang mở</p>
                <div className="flex flex-wrap gap-2">
                  {slot.entries.flatMap((entry) =>
                    entry.slots
                      .filter((subslot) => !subslot.person && subslot.assignment?.staffId !== "CLOSED")
                      .map((subslot) => (
                        editable ? (
                          <button
                            key={`quick-${slot.date}-${slot.shift}-${entry.position.id}-${subslot.slotIndex}`}
                            type="button"
                            onClick={(e) =>
                              setEditingSlot({
                                slot,
                                entry,
                                subslot,
                                rect: e.currentTarget.getBoundingClientRect(),
                              })
                            }
                            className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                          >
                            {entry.position.area ? `${entry.position.area} · ` : ""}{entry.position.name} · Slot {subslot.slotIndex + 1}
                          </button>
                        ) : (
                          <span
                            key={`quick-${slot.date}-${slot.shift}-${entry.position.id}-${subslot.slotIndex}`}
                            className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900"
                          >
                            {entry.position.area ? `${entry.position.area} · ` : ""}{entry.position.name} · Slot {subslot.slotIndex + 1}
                          </span>
                        )
                      )),
                  )}
                  {slot.entries.flatMap((entry) =>
                    entry.slots.filter((subslot) => !subslot.person && subslot.assignment?.staffId !== "CLOSED"),
                  ).length === 0 && (
                    <span className="text-xs text-amber-700">Không có slot trống trong ca này.</span>
                  )}
                </div>
              </div>
            )}

            {[...areaGroups.entries()].map(([areaName, entries], areaIndex) => {
              const themeColors = [
                "bg-indigo-50/40 ring-indigo-100",
                "bg-emerald-50/40 ring-emerald-100",
                "bg-rose-50/40 ring-rose-100",
                "bg-amber-50/40 ring-amber-100",
                "bg-cyan-50/40 ring-cyan-100",
                "bg-violet-50/40 ring-violet-100",
                "bg-orange-50/40 ring-orange-100"
              ];
              const theme = areaName === "Khác" ? "bg-slate-50/40 ring-slate-200" : themeColors[areaIndex % themeColors.length];

              return (
                <div key={areaName} className="space-y-3">
                  <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                    <span className="h-px flex-1 bg-slate-200" />
                    {areaName}
                    <span className="h-px flex-1 bg-slate-200" />
                  </h4>
                  <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {entries.map((entry) => (
                      <article
                        key={`${slot.date}-${slot.shift}-${entry.position.id}`}
                        className={`rounded-[20px] p-3 ring-1 ring-inset shadow-sm transition hover:shadow-md ${theme}`}
                      >
                        {(() => {
                          const seenStaff = new Set<string>();
                          const duplicateNames = new Set<string>();
                          entry.slots.forEach((subslot) => {
                            const staffId = subslot.person?.id ?? subslot.assignment?.staffId;
                            if (!staffId || staffId === "CLOSED") return;
                            if (seenStaff.has(staffId)) {
                              duplicateNames.add(subslot.person?.name ?? staffId);
                            }
                            seenStaff.add(staffId);
                          });
                          if (duplicateNames.size === 0) return null;
                          return (
                            <div className="mb-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                              ⚠️ Trùng nhân sự trong cùng vị trí: {Array.from(duplicateNames).join(", ")}
                            </div>
                          );
                        })()}
                        <div className="mb-3 flex items-center justify-between border-b border-slate-100 px-3 pb-3 pt-1">
                          <h4 className="font-semibold text-slate-800">{entry.position.name}</h4>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            {entry.slots.length} người
                          </span>
                        </div>

                        <div className="flex flex-col gap-2">
                          {entry.slots.map((subslot) => {
                            const { isPastShift } = require("@/lib/date");
                            const isPast = mode !== "template" && isPastShift(slot.date, slot.shift);
                            const canEdit = editable && !isPast;

                            const isClosed = subslot.assignment?.staffId === "CLOSED";
                            const isAssigned = !!subslot.assignment && !isClosed;
                            const isConflict = !!subslot.leave && !isClosed;
                            const isEmpty = !subslot.person && !isClosed;
                            const isPreview = !subslot.assignment && !!subslot.person;

                            const tone = isClosed ? "slate" : isAssigned ? getStatusTone(subslot.assignment!.status) : isPreview ? "indigo" : "slate";
                            const statusLabel = isClosed ? "Đã Khóa" : isAssigned ? ASSIGNMENT_STATUS_LABELS[subslot.assignment!.status] : isPreview ? "Dự kiến" : "Trống";

                            let slotBaseClass = "flex w-full items-start justify-between rounded-[16px] p-3 text-left transition-all ";

                            if (isClosed) {
                              slotBaseClass += "bg-slate-100 ring-1 ring-inset ring-slate-200 opacity-70 border-dashed border border-slate-300";
                            } else if (isConflict) {
                              slotBaseClass += "bg-rose-50 ring-2 ring-inset ring-rose-400 hover:bg-rose-100/50";
                            } else if (isEmpty) {
                              slotBaseClass += "bg-slate-50/50 border-2 border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50";
                            } else if (isPreview) {
                              slotBaseClass += "bg-indigo-50/40 ring-1 ring-inset ring-indigo-200 border-indigo-100/50 hover:bg-indigo-50 hover:ring-indigo-300 shadow-sm";
                            } else {
                              slotBaseClass += "bg-white ring-1 ring-inset ring-slate-200/60 shadow-[0_2px_8px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:ring-slate-300";
                            }

                            if (canEdit) slotBaseClass += " cursor-pointer active:scale-[0.98]";

                            const rowKey = `${slot.date}-${slot.shift}-${entry.position.id}-${subslot.slotIndex}`;
                            return (
                              <div key={rowKey} className="flex items-start gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    if (canEdit) {
                                      setEditingSlot({ slot, entry, subslot, rect: e.currentTarget.getBoundingClientRect() });
                                    }
                                  }}
                                  disabled={!canEdit}
                                  className={`${slotBaseClass} flex-1`}
                                >
                                <div className="flex flex-1 flex-col pr-2">
                                  <div className="flex items-center gap-2">
                                    {isClosed ? (
                                      <>
                                        <NotebookPen className="h-4 w-4 shrink-0 text-slate-500" />
                                        <span className="font-medium text-slate-500 line-through decoration-slate-400/50">
                                          Vị trí bị đóng ca này
                                        </span>
                                      </>
                                    ) : subslot.person ? (
                                      <>
                                        <CalendarClock className="h-4 w-4 shrink-0 text-teal-700" />
                                        <span
                                          className="font-medium text-slate-900 break-words leading-tight text-left"
                                          title={getRotationTooltip(subslot.person, positions)}
                                        >
                                          {subslot.person.name}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="truncate text-sm italic text-slate-400">
                                        Chưa xếp người
                                      </span>
                                    )}
                                  </div>

                                  {!isClosed && subslot.person && isOvertimeSlot(slot.date, slot.shift) && (
                                    <div className="ml-6 mt-1 flex items-center gap-1">
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${subslot.person.prefersOvertime
                                          ? "bg-teal-100 text-teal-700"
                                          : "bg-amber-100 text-amber-700"
                                          }`}
                                      >
                                        <Clock className="h-3 w-3" />
                                        {subslot.person.prefersOvertime ? "Sẵn sàng TC" : "Không đk TC"}
                                      </span>
                                    </div>
                                  )}

                                  {subslot.assignment?.note && (
                                    <div className="ml-6 mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
                                      <NotebookPen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                      <p className="line-clamp-2">{subslot.assignment.note}</p>
                                    </div>
                                  )}

                                  {subslot.leave && (
                                    <div className="ml-6 mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600">
                                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                      <span>Nghỉ {LEAVE_REASON_LABELS[subslot.leave.reason].toLowerCase()}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="shrink-0 scale-90 origin-top-right ml-2">
                                  <Pill tone={tone}>{statusLabel}</Pill>
                                </div>
                                </button>
                                {canEdit && !isClosed && !!subslot.person && (
                                  <button
                                    type="button"
                                    onClick={() => clearAssignmentQuickly(slot, entry, subslot)}
                                    disabled={isPending && pendingClearKey === rowKey}
                                    title="Bỏ trống nhanh"
                                    className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      {/* Render Dialog */}
      {editable && editingSlot && (
        <ShiftEditDialog
          isOpen={true}
          onClose={() => setEditingSlot(null)}
          date={editingSlot.slot.date}
          shift={editingSlot.slot.shift}
          position={editingSlot.entry.position}
          currentAssignment={editingSlot.subslot.assignment}
          defaultPerson={editingSlot.subslot.person}
          slotIndex={editingSlot.subslot.slotIndex}
          dayOfWeek={editingSlot.slot.dayOfWeek}
          mode={mode}
          anchorRect={editingSlot.rect}
          staff={staff}
          positions={positions}
          leaveRequests={leaveRequests}
          workload={workload}
          weeklySchedule={weeklySchedule}
          weekStart={weekStart}
          returnTo={mode === "template" ? "/template" : `/schedule?week=${weekStart}&day=${editingSlot.slot.dayOfWeek}&shift=${editingSlot.slot.shift}`}
        />
      )}
    </div>
  );
}
