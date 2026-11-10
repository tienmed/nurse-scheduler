"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { SmartExportAdjustModal } from "@/components/room-assignment/smart-export-adjust-modal";
import type { WeeklyAssignment } from "@/lib/types";

interface SmartAdjustTriggerButtonProps {
  userEmail?: string;
  userRole?: string;
  currentAssignments?: WeeklyAssignment[];
  className?: string;
}

const PRIVILEGED_EMAILS = [
  "tienmed@gmail.com",
  "nghiadn.pk@pnt.edu.vn",
  "bstien@pnt.edu.vn",
  "admin@nurseflow.local",
];

export function SmartAdjustTriggerButton({
  userEmail,
  userRole,
  currentAssignments = [],
  className = "",
}: SmartAdjustTriggerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const email = (userEmail || "").toLowerCase().trim();
  const role = (userRole || "").toLowerCase().trim();

  // Chỉ hiển thị đối với tienmed, Nghĩa hoặc admin / coordinator
  const isAuthorized =
    PRIVILEGED_EMAILS.includes(email) || role === "admin" || role === "coordinator";

  if (!isAuthorized) {
    return null; // Không hiển thị với nhân sự thông thường
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-xl sm:rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100/90 px-3 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-extrabold text-amber-950 hover:from-amber-100 hover:to-amber-200 shadow-xs active:scale-95 transition-all cursor-pointer ring-1 ring-amber-300/60 ${className}`}
        title="Góp ý điều chỉnh lịch phòng trực & Xuất file Excel theo khu vực (AI)"
      >
        <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 animate-pulse shrink-0" />
        <span className="whitespace-nowrap">Góp ý & Xuất Excel (AI)</span>
      </button>

      <SmartExportAdjustModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentAssignments={currentAssignments}
      />
    </>
  );
}
