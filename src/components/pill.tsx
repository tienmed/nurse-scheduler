import { cn } from "@/lib/cn";

interface PillProps {
  children: React.ReactNode;
  tone?: "slate" | "emerald" | "amber" | "rose" | "teal" | "indigo";
  className?: string;
}

const toneClasses = {
  slate: "border-slate-200 bg-slate-50 text-slate-600 ring-slate-400/10",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-400/10",
  amber: "border-amber-200 bg-amber-50 text-amber-700 ring-amber-400/10",
  rose: "border-rose-200 bg-rose-50 text-rose-700 ring-rose-400/10",
  teal: "border-teal-200 bg-teal-50 text-teal-700 ring-teal-400/10",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700 ring-indigo-400/10",
};

export function Pill({ children, tone = "slate", className }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-tight ring-1 ring-inset transition-all",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
