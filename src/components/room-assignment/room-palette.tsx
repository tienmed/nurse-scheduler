"use client";

import { useMemo, useState } from "react";
import { GripVertical, Layers, Search, Sparkles, X } from "lucide-react";
import type { Position } from "@/lib/types";
import { getAreaStyle } from "./types";

interface RoomPaletteProps {
  positions: Position[];
  // Số lượng phân công theo phòng trong cả tuần hoặc ca hiện tại
  assignedCounts?: Record<string, number>;
  selectedPosition: Position | null;
  onSelectPosition: (pos: Position | null) => void;
  onDragStart?: (position: Position) => void;
  onDragEnd?: () => void;
}

export function RoomPalette({
  positions,
  assignedCounts = {},
  selectedPosition,
  onSelectPosition,
  onDragStart,
  onDragEnd,
}: RoomPaletteProps) {
  const [search, setSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("all");

  // Lấy danh sách các khu vực duy nhất
  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const p of positions) {
      if (p.area) set.add(p.area.trim());
    }
    return Array.from(set);
  }, [positions]);

  // Lọc phòng theo từ khóa và khu vực
  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      const matchSearch =
        !search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.area && p.area.toLowerCase().includes(search.toLowerCase()));

      const matchArea = selectedArea === "all" || p.area?.trim() === selectedArea;

      return matchSearch && matchArea;
    });
  }, [positions, search, selectedArea]);

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm xl:p-5">
      {/* Header & Công cụ tìm kiếm */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-teal-100 text-teal-800">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Kho Thẻ Phòng ({positions.length} phòng)
              </h3>
              {selectedPosition && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                  <Sparkles className="h-3 w-3" />
                  Đang chọn: {selectedPosition.name}
                  <button
                    type="button"
                    onClick={() => onSelectPosition(null)}
                    className="ml-1 hover:text-rose-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Kéo thẻ phòng thả vào ô giao nhau giữa Nhân sự và Buổi/Thứ, hoặc nhấp chọn phòng rồi nhấp vào ô để gán.
            </p>
          </div>
        </div>

        {/* Ô tìm kiếm & Bộ lọc khu vực */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lọc theo khu vực */}
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-teal-500 focus:bg-white focus:outline-none"
          >
            <option value="all">Tất cả khu vực ({areas.length})</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          {/* Tìm kiếm */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm nhanh phòng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-40 sm:w-48 rounded-2xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Danh sách thẻ phòng có thể kéo thả */}
      <div className="mt-3 flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1">
        {filteredPositions.length === 0 ? (
          <p className="text-xs italic text-slate-400 py-2">Không tìm thấy phòng phù hợp</p>
        ) : (
          filteredPositions.map((pos) => {
            const style = getAreaStyle(pos.area);
            const isSelected = selectedPosition?.id === pos.id;
            const count = assignedCounts[pos.id] || 0;

            return (
              <div
                key={pos.id}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", pos.id);
                  e.dataTransfer.setData("text", pos.id);
                  e.dataTransfer.setData(
                    "application/json",
                    JSON.stringify({ positionId: pos.id, positionName: pos.name }),
                  );
                  e.dataTransfer.effectAllowed = "copy";
                  onDragStart?.(pos);
                }}
                onDragEnd={() => {
                  onDragEnd?.();
                }}
                onClick={() => {
                  onSelectPosition(isSelected ? null : pos);
                }}
                className={`group inline-flex cursor-grab active:cursor-grabbing items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold shadow-xs select-none transition-all active:scale-95 ${
                  isSelected
                    ? "border-teal-600 bg-teal-600 text-white ring-2 ring-teal-200 shadow-md"
                    : `${style.border} ${style.lightBg} ${style.text} hover:border-teal-400 hover:shadow-sm`
                }`}
                title={`Kéo hoặc nhấp để chọn: ${pos.name} (${pos.area || "Khu vực khác"})`}
              >
                <GripVertical
                  className={`h-3.5 w-3.5 shrink-0 pointer-events-none ${
                    isSelected ? "text-white/80" : "text-slate-400 group-hover:text-teal-700"
                  }`}
                />
                <span className="truncate max-w-[140px] pointer-events-none font-bold">
                  {pos.name}
                </span>

                {pos.area && (
                  <span
                    className={`rounded-md px-1.5 py-0.2 text-[9px] pointer-events-none ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-white/80 text-slate-500 border border-slate-200/60"
                    }`}
                  >
                    {pos.area}
                  </span>
                )}

                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold pointer-events-none ${
                      isSelected ? "bg-white text-teal-800" : "bg-teal-100 text-teal-800"
                    }`}
                    title={`Đã phân công ${count} lượt`}
                  >
                    {count}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
