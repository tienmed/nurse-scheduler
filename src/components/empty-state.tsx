import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  tips?: string[];
  tone?: "teal" | "amber" | "slate";
}

const toneMap = {
  teal: {
    shell: "border-teal-200/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.96)_0%,rgba(13,148,136,0.9)_100%)] text-white",
    icon: "bg-white/14 text-white",
    text: "text-white/78",
    tip: "border-white/12 bg-white/10 text-white/78",
  },
  amber: {
    shell: "border-amber-200/70 bg-[linear-gradient(135deg,rgba(120,53,15,0.96)_0%,rgba(245,158,11,0.9)_100%)] text-white",
    icon: "bg-white/14 text-white",
    text: "text-white/78",
    tip: "border-white/12 bg-white/10 text-white/78",
  },
  slate: {
    shell: "border-slate-200 bg-slate-950 text-white",
    icon: "bg-white/10 text-white",
    text: "text-white/72",
    tip: "border-white/10 bg-white/6 text-white/72",
  },
} as const;

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tips,
  tone = "teal",
}: EmptyStateProps) {
  const palette = toneMap[tone];

  return (
    <div className={`rounded-[32px] border p-6 shadow-[0_24px_70px_rgba(15,23,42,0.16)] ${palette.shell}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl space-y-4">
          <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${palette.icon}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
            <p className={`max-w-xl text-sm leading-6 ${palette.text}`}>{description}</p>
          </div>
          {tips?.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {tips.map((tip) => (
                <div key={tip} className={`rounded-2xl border px-4 py-3 text-sm ${palette.tip}`}>
                  {tip}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
