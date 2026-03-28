import { AlertTriangle, CalendarClock, NotebookPen } from "lucide-react";
import { Pill } from "@/components/pill";
import { ASSIGNMENT_STATUS_LABELS, LEAVE_REASON_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/date";
import { getStatusTone } from "@/lib/schedule";
import type {
  LeaveRecord,
  Position,
  ShiftType,
  StaffMember,
  WeeklyAssignment,
} from "@/lib/types";

interface BoardEntry {
  position: Position;
  assignment?: WeeklyAssignment | null;
  person?: StaffMember | null;
  leave?: LeaveRecord | null;
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
}

export function ScheduleBoard({ board }: ScheduleBoardProps) {
  return (
    <div className="space-y-5">
      {board.map((slot) => (
        <section key={`${slot.date}-${slot.shift}`} className="space-y-3">
          <div className="flex flex-col gap-2 rounded-[24px] border border-white/80 bg-white/80 px-4 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)] md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">{slot.title}</h3>
              <p className="text-sm text-slate-500">{formatDate(slot.date, "dd/MM/yyyy")}</p>
            </div>
            <Pill tone="teal">{slot.entries.filter((entry) => entry.assignment).length} vị trí đã gán</Pill>
          </div>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {slot.entries.map((entry) => (
              <article
                key={`${slot.date}-${slot.shift}-${entry.position.id}`}
                className="rounded-[24px] border border-white/85 bg-white/92 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">{entry.position.area}</p>
                    <h4 className="mt-2 text-base font-semibold text-slate-950">{entry.position.name}</h4>
                  </div>
                  <Pill tone={entry.assignment ? getStatusTone(entry.assignment.status) : "slate"}>
                    {entry.assignment ? ASSIGNMENT_STATUS_LABELS[entry.assignment.status] : "Trống"}
                  </Pill>
                </div>

                {entry.person ? (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-slate-900">
                      <CalendarClock className="h-4 w-4 text-teal-700" />
                      <p className="font-medium">{entry.person.name}</p>
                    </div>
                    <p className="text-sm text-slate-500">
                      {entry.person.code} · {entry.person.team}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    Chưa có nhân sự cho vị trí này.
                  </div>
                )}

                {entry.assignment?.note ? (
                  <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-100 px-3 py-3 text-sm text-slate-600">
                    <NotebookPen className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <p>{entry.assignment.note}</p>
                  </div>
                ) : null}

                {entry.leave ? (
                  <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Nhân sự đã đăng ký nghỉ {LEAVE_REASON_LABELS[entry.leave.reason].toLowerCase()}.
                    </p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
