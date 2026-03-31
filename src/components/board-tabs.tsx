"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

interface BoardTabsProps {
    tabs: {
        dayOfWeek: number;
        shift: string;
        label: string;
        href: string;
        isActive: boolean;
    }[];
}

export function BoardTabs({ tabs }: BoardTabsProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Tìm tab đang active và cuộn tới nó
        const activeEl = scrollRef.current?.querySelector('[data-active="true"]');
        if (activeEl) {
            activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
    }, [tabs]);

    return (
        <nav className="sticky top-[73px] z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <div ref={scrollRef} className="flex gap-1 overflow-x-auto py-2.5 scrollbar-none">
                    {tabs.map((tab) => (
                        <Link
                            key={`${tab.dayOfWeek}-${tab.shift}`}
                            href={tab.href}
                            data-active={tab.isActive}
                            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all ${tab.isActive
                                    ? "bg-slate-900 text-white shadow-md"
                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                                }`}
                        >
                            {tab.label}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}
