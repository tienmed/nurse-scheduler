import { cn } from "@/lib/cn";

interface PillProps {
  children: React.ReactNode;
  tone?: "slate" | "emerald" | "amber" | "rose" | "teal";
}

const toneClasses = {
  slate: "border-slate-200 bg-slate-100/80 text-slate-700",
  emerald: "border-emerald-200 bg-emerald-100/90 text-emerald-700",
  amber: "border-amber-200 bg-amber-100/90 text-amber-700",
  rose: "border-rose-200 bg-rose-100/90 text-rose-700",
  teal: "border-teal-200 bg-teal-100/90 text-teal-700",
};

export function Pill({ children, tone = "slate" }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-[0.16em] uppercase",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

