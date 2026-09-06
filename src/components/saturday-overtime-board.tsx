"use client";

import { useState, useMemo } from "react";
import { Check, Search, Users } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import type { StaffMember, WeeklyAssignment } from "@/lib/types";
import { saveSaturdayOvertimeAction } from "@/app/actions";

interface SaturdayOvertimeBoardProps {
  staff: StaffMember[];
  weeklySchedule: WeeklyAssignment[];
  date: string;
  shift: "morning" | "afternoon";
  weekStart: string;
  editable: boolean;
}

function StaffGroup({ title, list, selectedIds, toggleStaff, editable }: { title: string; list: StaffMember[], selectedIds: Set<string>, toggleStaff: (id: string) => void, editable: boolean }) {
  if (list.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((person) => {
          const isSelected = selectedIds.has(person.id);
          return (
            <label
              key={person.id}
              className={`relative flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${
                isSelected
                  ? "border-teal-500 bg-teal-50/50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              } ${!editable && "opacity-80 cursor-not-allowed"}`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm ${isSelected ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {person.name.charAt(0)}
                </div>
                <div>
                  <div className={`font-semibold ${isSelected ? "text-teal-900" : "text-slate-700"}`}>
                    {person.name}
                  </div>
                  {person.notes && (
                    <div className="text-xs text-slate-500 truncate max-w-[150px]">{person.notes}</div>
                  )}
                </div>
              </div>

              <div className="relative flex items-center justify-center shrink-0">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={isSelected}
                  onChange={() => toggleStaff(person.id)}
                  disabled={!editable}
                />
                <div className="h-6 w-6 rounded-lg border-2 border-slate-300 bg-white transition-all peer-checked:border-teal-500 peer-checked:bg-teal-500"></div>
                <Check className="absolute h-4 w-4 text-white opacity-0 transition-opacity peer-checked:opacity-100 pointer-events-none" />
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function SaturdayOvertimeBoard({

  staff,
  weeklySchedule,
  date,
  shift,
  weekStart,
  editable,
}: SaturdayOvertimeBoardProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Chỉ lấy staff đang active
  const activeStaff = useMemo(() => staff.filter((s) => s.active), [staff]);

  // Lấy danh sách ID đã được phân công Tăng ca (positionId = "SAT_OT")
  const defaultSelectedIds = useMemo(() => {
    return weeklySchedule
      .filter((item) => item.date === date && item.shift === shift && item.positionId === "SAT_OT")
      .map((item) => item.staffId);
  }, [weeklySchedule, date, shift]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(defaultSelectedIds));

  // Tách nhóm nhân sự: Đã đăng ký vs Chưa đăng ký
  const willingStaff = useMemo(() => activeStaff.filter((s) => s.prefersOvertime), [activeStaff]);
  const otherStaff = useMemo(() => activeStaff.filter((s) => !s.prefersOvertime), [activeStaff]);

  const toggleStaff = (id: string) => {
    if (!editable) return;
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const filterStaff = (list: StaffMember[]) => {
    if (!searchTerm) return list;
    return list.filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const filteredWilling = filterStaff(willingStaff);
  const filteredOther = filterStaff(otherStaff);



  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="h-6 w-6 text-teal-600" />
            Danh sách tham gia Tăng ca
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Chọn các nhân sự đi làm trong ca này. Báo cáo sẽ tự động ghi nhận số ngày công dựa trên danh sách này.
          </p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm nhân sự..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-64 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      <form action={saveSaturdayOvertimeAction}>
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="shift" value={shift} />
        <input type="hidden" name="weekStart" value={weekStart} />
        {Array.from(selectedIds).map((id) => (
          <input key={id} type="hidden" name="staffIds" value={id} />
        ))}

        <div className="min-h-[300px]">
          {filteredWilling.length === 0 && filteredOther.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-slate-400 text-sm">
              Không tìm thấy nhân sự nào
            </div>
          ) : (
            <>
              <StaffGroup title="Sẵn sàng tăng ca" list={filteredWilling} selectedIds={selectedIds} toggleStaff={toggleStaff} editable={editable} />
              <StaffGroup title="Nhân sự khác" list={filteredOther} selectedIds={selectedIds} toggleStaff={toggleStaff} editable={editable} />
            </>
          )}
        </div>

        {editable && (
          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
            <div className="text-sm font-medium text-slate-600">
              Đã chọn: <span className="text-teal-600 font-bold text-lg">{selectedIds.size}</span> nhân sự
            </div>
            <SubmitButton className="px-8 shadow-lg shadow-teal-500/20">
              Lưu danh sách
            </SubmitButton>
          </div>
        )}
      </form>
    </div>
  );
}
