"use client";

import { useTransition, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Loader2, Minus, Plus, Users } from "lucide-react";
import { updatePositionQuota, updatePositionStaffOrder } from "@/app/actions";
import type { Position, StaffMember } from "@/lib/types";
import { Pill } from "@/components/pill";

interface PositionCardProps {
  position: Position;
  allStaff: StaffMember[];
  editable: boolean;
}

export function PositionCard({ position, allStaff, editable }: PositionCardProps) {
  // Những staff có đăng ký vị trí nằm trong chuyên môn của họ
  const registeredStaff = allStaff.filter(
    (s) => s.active && s.positionIds.includes(position.id)
  );

  // Xếp hạng: ưu tiên staffOrder từ DB, những người chưa có trong order thì cho xuống cuối list
  const orderList = position.staffOrder || [];
  const orderedStaff = [...registeredStaff].sort((a, b) => {
    const idxA = orderList.indexOf(a.id);
    const idxB = orderList.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name, "vi");
  });

  const [currentStaff, setCurrentStaff] = useState(orderedStaff);
  const [quota, setQuota] = useState(position.quota || 1);
  const [isPending, startTransition] = useTransition();

  const handleQuotaChange = (delta: number) => {
    if (!editable) return;
    const q = Math.max(1, quota + delta);
    setQuota(q);
    startTransition(async () => {
      await updatePositionQuota(position.id, q);
    });
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    if (!editable) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === currentStaff.length - 1) return;

    const newList = [...currentStaff];
    const swapWith = direction === "up" ? index - 1 : index + 1;
    [newList[index], newList[swapWith]] = [newList[swapWith], newList[index]];
    
    setCurrentStaff(newList);
    startTransition(async () => {
      await updatePositionStaffOrder(position.id, newList.map((s) => s.id));
    });
  };

  return (
    <article className="relative flex flex-col justify-between overflow-hidden rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.03)] transition hover:shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
      {isPending && (
        <div className="absolute right-4 top-4 text-teal-600">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      <div>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{position.name}</h3>
            {position.description && (
              <p className="mt-1 text-sm text-slate-500 line-clamp-2">{position.description}</p>
            )}
            <div className="mt-2">
              <Pill tone="slate">{position.area || "Chưa phân khu"}</Pill>
            </div>
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between rounded-2xl bg-slate-50/80 px-4 py-3 border border-slate-100">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Users className="h-4 w-4 text-slate-400" />
            Định mức trực:
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleQuotaChange(-1)}
              disabled={!editable || quota <= 1 || isPending}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm border border-slate-200 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-4 text-center text-sm font-semibold text-slate-900">{quota}</span>
            <button
              onClick={() => handleQuotaChange(1)}
              disabled={!editable || isPending}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm border border-slate-200 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
            Nhân sự ưu tiên phụ trách
          </h4>
          {currentStaff.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
              Chưa có nhân sự nào khai báo làm việc tại vị trí này. (Quản lý ở tab Nhân sự)
            </div>
          ) : (
            <div className="space-y-1.5">
              {currentStaff.map((staff, index) => (
                <div
                  key={staff.id}
                  className="group flex flex-row items-center justify-between rounded-[20px] border border-transparent px-3 py-2 transition hover:border-slate-200/60 hover:bg-slate-50/80"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                      {staff.name}
                    </span>
                  </div>
                  {editable && (
                    <div className="flex opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => handleMove(index, "up")}
                        disabled={index === 0 || isPending}
                        className="p-1.5 text-slate-400 transition hover:text-teal-600 disabled:opacity-30 disabled:hover:text-slate-400"
                        title="Đẩy lên trên"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMove(index, "down")}
                        disabled={index === currentStaff.length - 1 || isPending}
                        className="p-1.5 text-slate-400 transition hover:text-teal-600 disabled:opacity-30 disabled:hover:text-slate-400"
                        title="Đẩy xuống dưới"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
