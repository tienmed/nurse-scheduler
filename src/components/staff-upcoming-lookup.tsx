"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/pill";
import { SHIFT_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/date";

interface UpcomingSlot {
  date: string;
  shift: "morning" | "afternoon";
  positionName: string;
}

interface StaffUpcomingItem {
  staff: { id: string; name: string };
  combined: UpcomingSlot[];
}

export function StaffUpcomingLookup({ items }: { items: StaffUpcomingItem[] }) {
  const [query, setQuery] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((item) =>
      item.staff.name.toLowerCase().includes(q) || item.staff.id.toLowerCase().includes(q),
    );
  }, [items, query]);

  const displayed = selectedStaffId
    ? filtered.filter((item) => item.staff.id === selectedStaffId)
    : filtered;

  const showResults = query.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedStaffId("");
          }}
          placeholder="Nhập tên/mã nhân sự để lọc..."
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500"
        />
        <select
          value={selectedStaffId}
          onChange={(e) => setSelectedStaffId(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500"
          disabled={!showResults}
        >
          <option value="">Tất cả nhân sự trong kết quả lọc</option>
          {filtered.map(({ staff }) => (
            <option key={staff.id} value={staff.id}>
              {staff.name}
            </option>
          ))}
        </select>
      </div>

      {!showResults ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Chưa nhập từ khóa tìm kiếm. Hãy search tên/mã để hiện danh sách.
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(({ staff, combined }) => (
            <div key={staff.id} className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">{staff.name}</p>
                <Pill tone={combined.length > 0 ? "teal" : "amber"}>
                  {combined.length > 0 ? `${combined.length} ca sắp tới` : "Chưa có ca dự kiến"}
                </Pill>
              </div>
              {combined.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {combined.slice(0, 8).map((slot, idx) => (
                    <span key={`${staff.id}-${slot.date}-${slot.shift}-${idx}`} className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                      {formatDate(slot.date, "dd/MM")} · {SHIFT_LABELS[slot.shift]} · {slot.positionName}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-amber-700">Không có ca dự kiến trong khoảng thời gian đang xét.</p>
              )}
            </div>
          ))}
          {displayed.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Không có nhân sự khớp với từ khóa.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
