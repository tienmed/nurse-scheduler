"use client";

import { useState, Fragment } from "react";
import { Check, X, CheckSquare, Square, Columns, Rows } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { WEEKDAY_LABELS } from "@/lib/constants";
import type { Position, PositionRule, ScheduleRule } from "@/lib/types";
import { savePositionRulesBatchAction } from "@/app/actions";

interface PositionMatrixProps {
  positions: Position[];
  scheduleRules: ScheduleRule[];
  positionRules: PositionRule[];
  editable: boolean;
}

export function PositionMatrix({
  positions,
  scheduleRules,
  positionRules,
  editable,
}: PositionMatrixProps) {
  const activeRules = scheduleRules.filter((r) => r.active);
  
  // Khởi tạo state từ dữ liệu ban đầu
  const [matrix, setMatrix] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    positions.forEach((pos) => {
      activeRules.forEach((rule) => {
        const ruleEntry = positionRules.find(
          (pr) =>
            pr.positionId === pos.id &&
            pr.dayOfWeek === rule.dayOfWeek &&
            pr.shift === rule.shift
        );
        initial[`${pos.id}|${rule.dayOfWeek}|${rule.shift}`] = ruleEntry ? ruleEntry.active : true;
      });
    });
    return initial;
  });

  const toggleAll = (value: boolean) => {
    const newMatrix = { ...matrix };
    Object.keys(newMatrix).forEach((key) => {
      newMatrix[key] = value;
    });
    setMatrix(newMatrix);
  };

  const toggleRow = (posId: string, value: boolean) => {
    const newMatrix = { ...matrix };
    Object.keys(newMatrix).forEach((key) => {
      if (key.startsWith(`${posId}|`)) {
        newMatrix[key] = value;
      }
    });
    setMatrix(newMatrix);
  };

  const toggleCol = (dayOfWeek: number, shift: string, value: boolean) => {
    const newMatrix = { ...matrix };
    const suffix = `|${dayOfWeek}|${shift}`;
    Object.keys(newMatrix).forEach((key) => {
      if (key.endsWith(suffix)) {
        newMatrix[key] = value;
      }
    });
    setMatrix(newMatrix);
  };

  const handleChange = (key: string, checked: boolean) => {
    setMatrix((prev) => ({ ...prev, [key]: checked }));
  };

  // Gom nhóm theo khu vực
  const areas = Array.from(new Set(positions.map((p) => p.area || "Khác")));

  return (
    <form action={savePositionRulesBatchAction} className="space-y-6">
      <input type="hidden" name="returnTo" value="/template" />
      
      {/* Toolbar điều khiển nhanh */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => toggleAll(true)}
          disabled={!editable}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <CheckSquare className="h-3.5 w-3.5 text-teal-600" />
          Mở tất cả
        </button>
        <button
          type="button"
          onClick={() => toggleAll(false)}
          disabled={!editable}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <Square className="h-3.5 w-3.5 text-rose-500" />
          Đóng tất cả
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50 p-3 text-left font-bold text-slate-600 min-w-[160px]">
                  Khu vực / Vị trí
                </th>
                {activeRules.map((rule) => {
                  const label = `${rule.shift === "morning" ? "S" : "C"}${WEEKDAY_LABELS[rule.dayOfWeek].replace("Thứ ", "T")}`;
                  return (
                    <th key={rule.id} className="group border-b border-r border-slate-200 p-0 min-w-[70px]">
                      <div className="flex flex-col items-center gap-1 p-2">
                        <span className="font-bold text-slate-700">{label}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            title="Mở toàn ca"
                            onClick={() => toggleCol(rule.dayOfWeek, rule.shift, true)}
                            className="p-1 rounded hover:bg-teal-100 text-teal-600"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            title="Đóng toàn ca"
                            onClick={() => toggleCol(rule.dayOfWeek, rule.shift, false)}
                            className="p-1 rounded hover:bg-rose-100 text-rose-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <Fragment key={area}>
                  <tr className="bg-slate-100/30">
                    <td colSpan={activeRules.length + 1} className="sticky left-0 border-b border-slate-200 px-3 py-1.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                      {area}
                    </td>
                  </tr>
                  {positions
                    .filter((p) => (p.area || "Khác") === area)
                    .map((pos) => (
                      <tr key={pos.id} className="group hover:bg-slate-50 transition">
                        <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-2.5 font-medium text-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.02)] group-hover:bg-slate-50">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{pos.name}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                <button
                                  type="button"
                                  title="Mở toàn tuần"
                                  onClick={() => toggleRow(pos.id, true)}
                                  className="p-1 rounded hover:bg-teal-100 text-teal-600"
                                >
                                  <Rows className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  title="Đóng toàn tuần"
                                  onClick={() => toggleRow(pos.id, false)}
                                  className="p-1 rounded hover:bg-rose-100 text-rose-500"
                                >
                                  <Square className="h-3 w-3" />
                                </button>
                            </div>
                          </div>
                        </td>
                        {activeRules.map((rule) => {
                          const key = `${pos.id}|${rule.dayOfWeek}|${rule.shift}`;
                          const isActive = matrix[key];
                          
                          return (
                            <td key={`${pos.id}-${rule.id}`} className="border-b border-r border-slate-200 p-0 text-center">
                              <label className={`flex h-full w-full cursor-pointer items-center justify-center p-3 transition ${isActive ? "bg-emerald-50/30" : "bg-rose-50/20"}`}>
                                <input type="hidden" name="all_slots" value={key} />
                                {isActive && (
                                  <input type="hidden" name="active_slots" value={key} />
                                )}
                                <div className="relative flex items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => handleChange(key, e.target.checked)}
                                    disabled={!editable}
                                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border-2 border-slate-200 bg-white transition-all checked:border-teal-500 checked:bg-teal-500 focus:outline-none disabled:cursor-not-allowed"
                                  />
                                  <Check className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
                                </div>
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-900 px-6 py-4 text-white shadow-lg">
        <div className="text-sm">
          <p className="font-semibold text-teal-400">Chế độ tối ưu Giao diện</p>
          <p className="text-slate-400 hidden md:block text-xs">Mọi thay đổi cần được Lưu để áp dụng thực tế.</p>
        </div>
        <SubmitButton disabled={!editable || positions.length === 0} className="rounded-xl px-8 shadow-xl shadow-teal-500/10">
          Lưu cấu hình
        </SubmitButton>
      </div>
    </form>
  );
}
