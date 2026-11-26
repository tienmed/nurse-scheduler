"use client";

import { useState } from "react";
import { Users, User, Calendar } from "lucide-react";
import { MyLeaveStatsView } from "./my-leave-stats-view";
import { AllStaffLeaveStatsView } from "./all-staff-leave-stats-view";
import type { LeaveRecord, StaffMember } from "@/lib/types";

interface LeaveStatsTabContainerProps {
  currentStaff: StaffMember;
  allStaff: StaffMember[];
  allLeaves: LeaveRecord[];
  yearlyStats: {
    year: number;
    totalDays: number;
    totalSessions: number;
    leavesCount: number;
  };
  isManager: boolean;
  initialYear?: number;
}

export function LeaveStatsTabContainer({
  currentStaff,
  allStaff,
  allLeaves,
  yearlyStats,
  isManager,
  initialYear,
}: LeaveStatsTabContainerProps) {
  const currentYear = yearlyStats.year;
  const [selectedYear, setSelectedYear] = useState<number>(initialYear || currentYear);

  // Mặc định cho Quản lý (Tiến & Nghĩa) là xem toàn bộ nhân sự "all-staff", còn nhân viên bình thường chỉ xem "my-stats"
  const [viewMode, setViewMode] = useState<"all-staff" | "my-stats">(
    isManager ? "all-staff" : "my-stats",
  );

  // Danh sách các năm có dữ liệu hoặc xung quanh năm hiện tại
  const yearsList = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="space-y-5">
      {/* THANH ĐIỀU HƯỚNG DÀNH CHO QUẢN LÝ (TIẾN & NGHĨA) */}
      {isManager && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-white border border-slate-200 p-3 sm:p-4 shadow-sm">
          {/* Nút chuyển đổi chế độ xem */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode("all-staff")}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 transition ${
                viewMode === "all-staff"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Toàn bộ nhân sự</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("my-stats")}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 transition ${
                viewMode === "my-stats"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <User className="h-4 w-4" />
              <span>Cá nhân tôi ({currentStaff.code})</span>
            </button>
          </div>

          {/* Bộ chọn năm */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-teal-600" />
              Năm:
            </span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-teal-500 focus:outline-none shadow-xs"
            >
              {yearsList.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* HIỂN THỊ NỘI DUNG TƯƠNG ỨNG */}
      {viewMode === "all-staff" && isManager ? (
        <AllStaffLeaveStatsView
          allStaff={allStaff}
          allLeaves={allLeaves}
          currentYear={currentYear}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
        />
      ) : (
        <MyLeaveStatsView
          currentStaff={currentStaff}
          allLeaves={allLeaves}
          yearlyStats={{
            ...yearlyStats,
            year: selectedYear,
          }}
        />
      )}
    </div>
  );
}
