import { ChevronDown } from "lucide-react";

interface SurfaceSectionProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Khi true, section có thể thu gọn/mở rộng bằng click header */
  collapsible?: boolean;
  /** Mặc định mở hay đóng khi collapsible=true (default: true = mở) */
  defaultOpen?: boolean;
}

export function SurfaceSection({
  eyebrow,
  title,
  description,
  action,
  children,
  collapsible = false,
  defaultOpen = true,
}: SurfaceSectionProps) {
  const headerContent = (
    <div className="space-y-2">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">{eyebrow}</p>
      ) : null}
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950 md:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (collapsible) {
    return (
      <details
        open={defaultOpen || undefined}
        className="group/collapse rounded-[30px] border border-white/80 bg-white/92 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 xl:p-6 [&::-webkit-details-marker]:hidden">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-end md:justify-between">
            {headerContent}
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-open/collapse:rotate-180" />
        </summary>
        <div className="border-t border-slate-200/80 p-5 pt-5 xl:p-6 xl:pt-5">
          {children}
        </div>
      </details>
    );
  }

  return (
    <section className="rounded-[30px] border border-white/80 bg-white/92 p-5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur xl:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 md:flex-row md:items-end md:justify-between">
        {headerContent}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}

