"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleGridProps {
  children: ReactNode[];
  limit?: number;
  columns?: string;
}

export function CollapsibleGrid({
  children,
  limit = 3,
  columns = "sm:grid-cols-2",
}: CollapsibleGridProps) {
  const [expanded, setExpanded] = useState(false);
  const total = children.length;
  const hasMore = total > limit;
  const visible = expanded ? children : children.slice(0, limit);
  const remaining = total - limit;

  return (
    <div>
      <div className={`grid gap-3 ${columns}`}>{visible}</div>
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur transition-all hover:border-slate-300 hover:bg-white hover:text-slate-900 hover:shadow-md active:scale-[0.98]"
        >
          <span>+{remaining} vị trí khác</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
      {hasMore && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2.5 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur transition-all hover:border-slate-300 hover:bg-white hover:text-slate-700 active:scale-[0.98]"
        >
          Thu gọn
        </button>
      )}
    </div>
  );
}
