"use client";

import { useEffect, useRef } from "react";
import { autoGenerateWeek } from "@/app/actions";
import { useRouter } from "next/navigation";

export function AutoGenerateWeek({ weekStart, enabled }: { weekStart: string, enabled: boolean }) {
  const router = useRouter();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!enabled || hasTriggered.current) return;
    hasTriggered.current = true;
    
    autoGenerateWeek(weekStart).then((res) => {
      if (res?.success) {
        router.refresh();
      }
    });
  }, [weekStart, enabled, router]);

  return null;
}
