"use client";

import { useMemo, useState } from "react";
import { GripVertical, Search, Users } from "lucide-react";
import type { StaffMember } from "@/lib/types";
import { getStaffColorStyle, getStaffMatrixLabel, getStaffShortName } from "./types";

interface StaffPaletteProps {
  staff: StaffMember[];
  staffCounts: Record<string, number>;
  selectedStaffId: string | null;
  onSelectStaff: (staffId: string | null) => void;
  onDragStaffStart: (staff: StaffMember) => void;
  onDragStaffEnd: () => void;
}

// [QWEN3] Kho tháº» nhÃ¢n viÃªn phÃ­a trÃªn ma tráº­n, ghi nháº­n sá»‘ phÃ²ng/ca Ä‘Æ°á»£c gÃ¡n trong tuáº§n
export function StaffPalette({
  staff,
  staffCounts,
  selectedStaffId,
  onSelectStaff,
  onDragStaffStart,
  onDragStaffEnd,
}: StaffPaletteProps) {
  const [search, setSearch] = useState("");

  const filteredStaff = useMemo(() => {
    let list = staff.filter((s) => s.active !== false);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.code && s.code.toLowerCase().includes(q)) ||
          getStaffShortName(s.name).toLowerCase().includes(q),
      );
    }
    // Sáº¯p xáº¿p theo tÃªn gá»i ngáº¯n
    return list.sort((a, b) => getStaffShortName(a.name).localeCompare(getStaffShortName(b.name)));
  }, [staff, search]);

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 shadow-2xs">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Kho Tháº» NhÃ¢n ViÃªn</h3>
            <p className="text-[11px] text-slate-500">
              KÃ©o tháº» vÃ o Ã´ phÃ²ng trong ma tráº­n â€¢ Hoáº·c nháº¥p chá»n tháº» rá»“i nháº¥p Ã´ phÃ²ng
            </p>
          </div>
        </div>

        {/* Ã” tÃ¬m kiáº¿m nhÃ¢n sá»± */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="TÃ¬m nhÃ¢n sá»±..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-56 rounded-2xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-100 transition-all"
          />
        </div>
      </div>

      {/* Danh sÃ¡ch tháº» nhÃ¢n viÃªn cuá»™n ngang / flex wrap */}
      <div className="mt-3 flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
        {filteredStaff.map((person) => {
          const isSelected = selectedStaffId === person.id;
          const assignedCount = staffCounts[person.id] || 0;
          const matrixLabel = getStaffMatrixLabel(person.name);
          const colorStyle = getStaffColorStyle(person.id || person.name);

          return (
            <div
              key={person.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/json",
                  JSON.stringify({ type: "staff", staffId: person.id }),
                );
                e.dataTransfer.effectAllowed = "copyMove";
                onDragStaffStart(person);
              }}
              onDragEnd={() => {
                onDragStaffEnd();
              }}
              onClick={() => {
                onSelectStaff(isSelected ? null : person.id);
              }}
              className={`group flex items-center gap-1.5 rounded-2xl border px-2.5 py-1.5 text-xs font-semibold cursor-grab active:cursor-grabbing transition-all select-none shadow-2xs ${
                isSelected
                  ? `${colorStyle.bg} ${colorStyle.border} ${colorStyle.text} ring-2 ring-teal-500 ring-offset-1 scale-105 shadow-md`
                  : `${colorStyle.bg} ${colorStyle.border} ${colorStyle.text} hover:scale-102 hover:shadow-xs`
              }`}
              title={`${person.name} (${person.code || "NV"}) - ÄÃ£ gÃ¡n ${assignedCount} ca trong tuáº§n. Nháº¥p chá»n hoáº·c kÃ©o tháº£ vÃ o Ã´ phÃ²ng.`}
            >
              <GripVertical className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />

              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shadow-2xs ${colorStyle.avatarBg} ${colorStyle.avatarText}`}>
                {getStaffShortName(person.name).slice(0, 1).toUpperCase()}
              </span>

              {/* TÃªn gá»n: ÄD TÃªn */}
              <span className="font-bold tracking-tight">
                {matrixLabel}
              </span>

              {/* Badge sá»‘ ca Ä‘Ã£ gÃ¡n */}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  assignedCount > 0
                    ? "bg-white/80 text-slate-800 border border-slate-200/80 shadow-2xs"
                    : "bg-slate-200/60 text-slate-500"
                }`}
              >
                {assignedCount} ca
              </span>
            </div>
          );
        })}

        {filteredStaff.length === 0 && (
          <div className="py-4 text-center text-xs text-slate-400 w-full">
            KhÃ´ng tÃ¬m tháº¥y nhÃ¢n sá»± phÃ¹ há»£p
          </div>
        )}
      </div>
    </div>
  );
}
