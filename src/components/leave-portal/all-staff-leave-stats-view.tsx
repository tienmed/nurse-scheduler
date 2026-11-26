"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  GraduationCap,
  HeartCrack,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Palmtree,
  Check,
  Sparkles,
  CalendarOff,
} from "lucide-react";
import type { LeaveRecord, StaffMember } from "@/lib/types";
import { isEffectiveApprovedLeave } from "@/lib/leave-logic";

interface AllStaffLeaveStatsViewProps {
  allStaff: StaffMember[];
  allLeaves: LeaveRecord[];
  currentYear: number;
  availableYears?: number[];
  selectedYear: number;
  onYearChange?: (year: number) => void;
}

export function AllStaffLeaveStatsView({
  allStaff,
  allLeaves,
  selectedYear,
}: AllStaffLeaveStatsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "daysDesc" | "pendingDesc">("daysDesc");
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  const yearPrefix = `${selectedYear}-`;

  // 1. Lọc toàn bộ các ca nghỉ thuộc năm được chọn
  const yearLeaves = useMemo(() => {
    return allLeaves.filter((l) => l.date && l.date.startsWith(yearPrefix));
  }, [allLeaves, yearPrefix]);

  // 2. Tính toán thống kê chi tiết cho từng nhân sự
  const staffStats = useMemo(() => {
    return allStaff.map((staff) => {
      const leaves = yearLeaves.filter((l) => l.staffId === staff.id);

      // Phép đã duyệt (gồm status approved HOẶC pending nhưng thuộc quá khứ)
      const approvedPaidLeaves = leaves.filter((l) => {
        if (!isEffectiveApprovedLeave(l) || l.reason !== "phep") return false;
        try {
          const d = parseISO(l.date).getDay();
          return d !== 0 && d !== 6;
        } catch {
          return false;
        }
      });

      let totalSessions = 0;
      for (const l of approvedPaidLeaves) {
        totalSessions += l.shift === "full-day" ? 2 : 1;
      }
      const approvedPaidDays = totalSessions / 2;

      // Phép đang chờ duyệt trong TƯƠNG LAI (chưa duyệt và chưa diễn ra)
      const pendingPaidLeaves = leaves.filter(
        (l) => l.status === "pending" && l.reason === "phep" && !isEffectiveApprovedLeave(l),
      );

      // Đi học
      const dihocLeaves = leaves.filter((l) => l.reason === "dihoc");
      const dihocSessions = dihocLeaves.reduce(
        (acc, l) => acc + (l.shift === "full-day" ? 2 : 1),
        0,
      );

      // Nghỉ ốm
      const omLeaves = leaves.filter((l) => l.reason === "om");
      const omSessions = omLeaves.reduce(
        (acc, l) => acc + (l.shift === "full-day" ? 2 : 1),
        0,
      );

      // Nghỉ không lương / Khác
      const khacLeaves = leaves.filter((l) => l.reason === "khac");
      const khacSessions = khacLeaves.reduce(
        (acc, l) => acc + (l.shift === "full-day" ? 2 : 1),
        0,
      );

      // Tổng số buổi và ngày vắng mặt thực tế (Phép + Đi học + Nghỉ không lương/Khác + Nghỉ ốm)
      const totalAbsenceSessions = totalSessions + dihocSessions + omSessions + khacSessions;
      const totalAbsenceDays = totalAbsenceSessions / 2;

      return {
        staff,
        approvedPaidLeaves,
        approvedPaidDays,
        approvedPaidSessions: totalSessions,
        pendingPaidLeaves,
        dihocLeaves,
        dihocSessions,
        omLeaves,
        omSessions,
        khacLeaves,
        khacSessions,
        totalAbsenceSessions,
        totalAbsenceDays,
        allLeavesInYear: leaves,
      };
    });
  }, [allStaff, yearLeaves]);

  // 3. Thống kê toàn đơn vị (Metrics)
  const unitSummary = useMemo(() => {
    let totalApprovedDays = 0;
    let totalApprovedSessions = 0;
    let totalPendingCount = 0;
    let totalDihocSessions = 0;
    let totalOmSessions = 0;
    let totalKhacSessions = 0;
    let totalAbsenceDays = 0;
    let activeStaffCount = 0;

    staffStats.forEach((s) => {
      if (s.staff.active !== false) activeStaffCount++;
      totalApprovedDays += s.approvedPaidDays;
      totalApprovedSessions += s.approvedPaidSessions;
      totalPendingCount += s.pendingPaidLeaves.length;
      totalDihocSessions += s.dihocSessions;
      totalOmSessions += s.omSessions;
      totalKhacSessions += s.khacSessions;
      totalAbsenceDays += s.totalAbsenceDays;
    });

    return {
      activeStaffCount,
      totalApprovedDays,
      totalApprovedSessions,
      totalPendingCount,
      totalDihocSessions,
      totalOmSessions,
      totalKhacSessions,
      totalAbsenceDays,
    };
  }, [staffStats]);


  // 4. Lọc và sắp xếp danh sách nhân sự
  const filteredAndSortedStaff = useMemo(() => {
    return staffStats
      .filter(({ staff }) => {
        // Tìm kiếm theo tên hoặc mã nhân sự
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchName = staff.name.toLowerCase().includes(q);
          const matchCode = staff.code.toLowerCase().includes(q);
          const matchEmail = (staff.email || "").toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchEmail) return false;
        }

        // Lọc theo vai trò / trạng thái
        if (roleFilter === "active") {
          return staff.active !== false;
        }
        if (roleFilter === "has-leave") {
          return (
            staff.active !== false &&
            (staffStats.find((s) => s.staff.id === staff.id)?.approvedPaidDays || 0) > 0
          );
        }
        if (roleFilter === "pending") {
          return (
            (staffStats.find((s) => s.staff.id === staff.id)?.pendingPaidLeaves.length || 0) > 0
          );
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "daysDesc") {
          return b.totalAbsenceDays - a.totalAbsenceDays || b.approvedPaidDays - a.approvedPaidDays || a.staff.name.localeCompare(b.staff.name, "vi");
        }
        if (sortBy === "pendingDesc") {
          return b.pendingPaidLeaves.length - a.pendingPaidLeaves.length || a.staff.name.localeCompare(b.staff.name, "vi");
        }
        return a.staff.name.localeCompare(b.staff.name, "vi");
      });
  }, [staffStats, searchTerm, roleFilter, sortBy]);

  // Copy tóm tắt báo cáo vào clipboard
  const [copied, setCopied] = useState(false);
  const handleCopySummary = () => {
    const lines = [
      `BÁO CÁO THỐNG KÊ NGHỈ PHÉP & VẮNG MẶT TOÀN ĐƠN VỊ - NĂM ${selectedYear}`,
      `Tổng số nhân sự: ${unitSummary.activeStaffCount} người`,
      `Tổng số ngày vắng mặt thực tế: ${unitSummary.totalAbsenceDays} ngày`,
      `Tổng số ngày phép năm đã duyệt: ${unitSummary.totalApprovedDays} ngày (${unitSummary.totalApprovedSessions} buổi)`,
      `Tổng số ca chờ duyệt: ${unitSummary.totalPendingCount} ca`,
      `Tổng số buổi đi học: ${unitSummary.totalDihocSessions} buổi | Nghỉ không lương/khác: ${unitSummary.totalKhacSessions} buổi | Nghỉ ốm: ${unitSummary.totalOmSessions} buổi`,
      `----------------------------------------`,
      `STT\tMã NV\tHọ và tên\tTổng vắng (Ngày)\tPhép năm (Ngày)\tĐi học (Buổi)\tKhông lương/Khác (Buổi)\tNghỉ ốm (Buổi)\tChờ duyệt (Ca)`,
      ...filteredAndSortedStaff.map(
        (item, idx) =>
          `${idx + 1}\t${item.staff.code}\t${item.staff.name}\t${item.totalAbsenceDays}\t${item.approvedPaidDays}\t${item.dihocSessions}\t${item.khacSessions}\t${item.omSessions}\t${item.pendingPaidLeaves.length}`,
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* KHỐI 1: TỔNG QUAN TOÀN ĐƠN VỊ */}
      <div className="rounded-2xl sm:rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50/80 via-white to-slate-50 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-teal-100/80 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100/90 px-3 py-1 text-xs font-bold text-teal-800">
              <Users className="h-3.5 w-3.5 text-teal-600" />
              Thống kê toàn bộ nhân sự (Dành cho Quản lý & Điều phối)
            </span>
            <h2 className="mt-1 text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              Quản lý Quỹ Phép Toàn Đơn Vị
            </h2>
            <p className="text-xs text-slate-500 sm:text-sm">
              Theo dõi chi tiết số ngày phép đã duyệt, ca chờ duyệt và chế độ nghỉ của toàn bộ nhân viên.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-teal-700 shadow-sm transition"
              title="Sao chép bảng tổng hợp ra Excel/Clipboard"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Đã sao chép!</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" />
                  <span>Copy số liệu</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 5 Thẻ chỉ số tổng hợp đơn vị */}
        <div className="grid gap-3.5 sm:gap-4 grid-cols-2 lg:grid-cols-5 pt-4">
          {/* Thẻ 1: Tổng số ngày vắng mặt thực tế */}
          <div className="rounded-2xl border-2 border-slate-300 bg-slate-50/90 p-3.5 sm:p-4 shadow-sm col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <CalendarOff className="h-3.5 w-3.5 text-slate-600" />
                Tổng vắng thực tế
              </span>
            </div>
            <p className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-900">
              {unitSummary.totalAbsenceDays}{" "}
              <span className="text-xs sm:text-sm font-semibold text-slate-600">ngày</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Phép + Học + Không lương + Ốm
            </p>
          </div>

          {/* Thẻ 2: Tổng số ngày phép đã duyệt */}
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-3.5 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <Palmtree className="h-3.5 w-3.5 text-emerald-600" />
                Phép năm đã duyệt
              </span>
            </div>
            <p className="mt-1.5 text-2xl sm:text-3xl font-black text-emerald-700">
              {unitSummary.totalApprovedDays}{" "}
              <span className="text-xs sm:text-sm font-semibold text-emerald-900">ngày</span>
            </p>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              = <strong>{unitSummary.totalApprovedSessions} buổi</strong> trừ quỹ phép
            </p>
          </div>

          {/* Thẻ 3: Ca chờ duyệt */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                Chờ duyệt (Tới)
              </span>
            </div>
            <p className="mt-1.5 text-2xl sm:text-3xl font-black text-amber-700">
              {unitSummary.totalPendingCount}{" "}
              <span className="text-xs sm:text-sm font-semibold text-amber-900">ca</span>
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Chưa duyệt trong tương lai
            </p>
          </div>

          {/* Thẻ 4: Đi học */}
          <div className="rounded-2xl border border-indigo-200 bg-white p-3.5 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-600" />
                Đi học đào tạo
              </span>
            </div>
            <p className="mt-1.5 text-2xl sm:text-3xl font-black text-indigo-700">
              {unitSummary.totalDihocSessions}{" "}
              <span className="text-xs sm:text-sm font-semibold text-slate-600">buổi</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Không trừ vào quỹ phép
            </p>
          </div>

          {/* Thẻ 5: Nghỉ ốm & Khác */}
          <div className="rounded-2xl border border-rose-200 bg-white p-3.5 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                <HeartCrack className="h-3.5 w-3.5 text-rose-600" />
                Ốm & Không lương
              </span>
            </div>
            <p className="mt-1.5 text-2xl sm:text-3xl font-black text-rose-700">
              {unitSummary.totalOmSessions + unitSummary.totalKhacSessions}{" "}
              <span className="text-xs sm:text-sm font-semibold text-slate-600">buổi</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Ốm: {unitSummary.totalOmSessions}b · Khác: {unitSummary.totalKhacSessions}b
            </p>
          </div>
        </div>

      </div>

      {/* KHỐI 2: THANH TÌM KIẾM, BỘ LỌC VÀ SẮP XẾP */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên hoặc mã nhân viên (VD: DD01, Lan, Nghĩa...)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none transition"
            />
          </div>

          {/* Nhóm bộ lọc & Sắp xếp */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Lọc danh mục */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={`rounded-lg px-2.5 py-1.5 transition ${
                  roleFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tất cả ({staffStats.length})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("has-leave")}
                className={`rounded-lg px-2.5 py-1.5 transition ${
                  roleFilter === "has-leave" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Có vắng mặt ({staffStats.filter((s) => s.totalAbsenceDays > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("pending")}
                className={`rounded-lg px-2.5 py-1.5 transition ${
                  roleFilter === "pending" ? "bg-white text-amber-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Chờ duyệt tới ({staffStats.filter((s) => s.pendingPaidLeaves.length > 0).length})
              </button>
            </div>

            {/* Sắp xếp */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:border-teal-500 focus:outline-none"
            >
              <option value="daysDesc">Vắng mặt nhiều nhất</option>
              <option value="pendingDesc">Chờ duyệt nhiều nhất</option>
              <option value="name">Tên A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* KHỐI 3: BẢNG DANH SÁCH CHI TIẾT TỪNG NHÂN VIÊN */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-3 px-2.5 text-center w-10">STT</th>
                <th className="py-3 px-2 text-center w-14">Mã NV</th>
                <th className="py-3 px-3">Họ và tên</th>
                <th className="py-3 px-2 text-center bg-slate-200/60 font-black text-slate-900">Tổng vắng</th>
                <th className="py-3 px-2 text-center text-emerald-900">Phép năm</th>
                <th className="py-3 px-2 text-center text-indigo-900">Đi học</th>
                <th className="py-3 px-2 text-center text-rose-900">Ốm / Không lương</th>
                <th className="py-3 px-2 text-center text-amber-800">Chờ duyệt</th>
                <th className="py-3 px-3 text-center w-24">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedStaff.length > 0 ? (
                filteredAndSortedStaff.map((item, idx) => {
                  const isExpanded = expandedStaffId === item.staff.id;
                  const hasLeaves = item.allLeavesInYear.length > 0;

                  return (
                    <tr
                      key={item.staff.id}
                      className={`group transition hover:bg-slate-50/80 ${
                        isExpanded ? "bg-teal-50/20" : ""
                      }`}
                    >
                      <td colSpan={9} className="p-0">
                        {/* Hàng tóm tắt nhân sự */}
                        <div className="grid grid-cols-12 items-center py-3 px-3 text-xs">
                          {/* STT */}
                          <div className="col-span-1 text-center font-bold text-slate-400">
                            {idx + 1}
                          </div>

                          {/* Mã NV */}
                          <div className="col-span-1 font-mono font-bold text-slate-600 text-center">
                            {item.staff.code}
                          </div>

                          {/* Họ và tên & email */}
                          <div className="col-span-3 pr-2">
                            <span className="font-bold text-slate-900 group-hover:text-teal-700 transition">
                              {item.staff.name}
                            </span>
                            {item.staff.active === false && (
                              <span className="ml-1.5 inline-block rounded bg-slate-100 px-1 py-0.2 text-[10px] text-slate-400 font-medium">
                                Đã ngưng
                              </span>
                            )}
                            <span className="block text-[11px] text-slate-400 truncate">
                              {item.staff.email}
                            </span>
                          </div>

                          {/* Cột 1: Tổng vắng thực tế */}
                          <div className="col-span-1 text-center bg-slate-50/80 py-1 rounded-lg">
                            <span
                              className={`inline-flex items-baseline gap-0.5 font-black text-sm ${
                                item.totalAbsenceDays > 0 ? "text-slate-900" : "text-slate-300 font-normal"
                              }`}
                            >
                              {item.totalAbsenceDays}
                              <span className="text-[10px] font-semibold text-slate-500">ng</span>
                            </span>
                            {item.totalAbsenceDays > 0 && (
                              <span className="block text-[9px] text-slate-400">
                                ({item.totalAbsenceSessions}b)
                              </span>
                            )}
                          </div>

                          {/* Cột 2: Phép năm */}
                          <div className="col-span-1 text-center">
                            <span
                              className={`inline-flex items-baseline gap-0.5 font-bold ${
                                item.approvedPaidDays > 0 ? "text-emerald-700" : "text-slate-300 font-normal"
                              }`}
                            >
                              {item.approvedPaidDays}
                              <span className="text-[10px] font-semibold text-emerald-800">ng</span>
                            </span>
                            {item.approvedPaidDays > 0 && (
                              <span className="block text-[9px] text-slate-400">
                                ({item.approvedPaidSessions}b)
                              </span>
                            )}
                          </div>

                          {/* Cột 3: Đi học */}
                          <div className="col-span-1 text-center">
                            {item.dihocSessions > 0 ? (
                              <span className="font-bold text-indigo-700">
                                {item.dihocSessions} b
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </div>

                          {/* Cột 4: Ốm & Không lương */}
                          <div className="col-span-1 text-center">
                            {item.omSessions + item.khacSessions > 0 ? (
                              <span className="font-bold text-rose-700">
                                {item.omSessions + item.khacSessions} b
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </div>

                          {/* Cột 5: Chờ duyệt */}
                          <div className="col-span-1 text-center">
                            {item.pendingPaidLeaves.length > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                                {item.pendingPaidLeaves.length} ca
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </div>

                          {/* Nút xem chi tiết */}
                          <div className="col-span-2 text-center">
                            {hasLeaves ? (
                              <button
                                type="button"
                                onClick={() => setExpandedStaffId(isExpanded ? null : item.staff.id)}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                                  isExpanded
                                    ? "bg-teal-600 text-white"
                                    : "border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 shadow-xs"
                                }`}
                              >
                                {isExpanded ? (
                                  <>
                                    <span>Đóng</span>
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </>
                                ) : (
                                  <>
                                    <span>Chi tiết ({item.allLeavesInYear.length})</span>
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-300 italic">Không có ca</span>
                            )}
                          </div>
                        </div>

                        {/* Khung mở rộng chi tiết các ngày nghỉ của nhân viên này */}
                        {isExpanded && (
                          <div className="border-t border-teal-100 bg-teal-50/30 p-4 sm:p-5 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs sm:text-sm font-bold text-teal-900 flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                                Danh sách các ca nghỉ năm {selectedYear} của {item.staff.name}
                              </h4>
                              <span className="text-[11px] text-slate-500 font-medium">
                                Tổng cộng {item.allLeavesInYear.length} ca ghi nhận
                              </span>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {item.allLeavesInYear
                                .sort((a, b) => a.date.localeCompare(b.date))
                                .map((leave) => {
                                  const isEffectiveApproved = isEffectiveApprovedLeave(leave);
                                  const isPast = leave.date < new Date().toISOString().split("T")[0];
                                  let dateLabel = leave.date;
                                  try {
                                    dateLabel = format(parseISO(leave.date), "dd/MM/yyyy (EEEE)", { locale: vi });
                                  } catch {}

                                  return (
                                    <div
                                      key={leave.id}
                                      className={`rounded-xl border p-2.5 text-xs bg-white shadow-xs ${
                                        !isEffectiveApproved
                                          ? "border-amber-200 bg-amber-50/40"
                                          : "border-slate-200"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                                        <span className="font-bold text-slate-900 capitalize text-[11px]">
                                          {dateLabel}
                                        </span>
                                        {isEffectiveApproved ? (
                                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                                            <CheckCircle2 className="h-2.5 w-2.5" />
                                            {leave.status === "pending" && isPast ? "Đã nghỉ (Quá khứ)" : "Đã duyệt"}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                                            <Clock className="h-2.5 w-2.5" />
                                            Chờ duyệt
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center justify-between text-[11px]">
                                        <div className="flex items-center gap-1">
                                          {leave.shift === "morning" && (
                                            <span className="rounded bg-amber-500 px-1.5 py-0.2 text-[10px] font-black text-white">
                                              S · Sáng
                                            </span>
                                          )}
                                          {leave.shift === "afternoon" && (
                                            <span className="rounded bg-blue-600 px-1.5 py-0.2 text-[10px] font-black text-white">
                                              C · Chiều
                                            </span>
                                          )}
                                          {leave.shift === "full-day" && (
                                            <span className="rounded bg-purple-700 px-1.5 py-0.2 text-[10px] font-black text-white">
                                              CN · Cả ngày
                                            </span>
                                          )}

                                          <span className="font-medium text-slate-600">
                                            {leave.reason === "phep"
                                              ? "Nghỉ phép"
                                              : leave.reason === "dihoc"
                                              ? "Đi học"
                                              : leave.reason === "om"
                                              ? "Nghỉ ốm"
                                              : "Nghỉ không lương / Khác"}
                                          </span>
                                        </div>

                                        <span className="font-bold text-slate-700">
                                          {leave.shift === "full-day" ? "1.0" : "0.5"} ngày
                                        </span>
                                      </div>

                                      {leave.note && (
                                        <p className="mt-1.5 pt-1 border-t border-slate-100 text-[10px] text-slate-500 italic truncate">
                                          {leave.note}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Không tìm thấy nhân viên nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                <td colSpan={3} className="py-3 px-4 text-right">
                  Tổng cộng toàn đơn vị (Năm {selectedYear}):
                </td>
                <td className="py-3 px-2 text-center text-slate-900 font-black text-sm bg-slate-200/70">
                  {unitSummary.totalAbsenceDays} ngày
                </td>
                <td className="py-3 px-2 text-center text-emerald-900 font-black">
                  {unitSummary.totalApprovedDays} ngày
                </td>
                <td className="py-3 px-2 text-center text-indigo-900 font-black">
                  {unitSummary.totalDihocSessions} b
                </td>
                <td className="py-3 px-2 text-center text-rose-900 font-black">
                  {unitSummary.totalOmSessions + unitSummary.totalKhacSessions} b
                </td>
                <td className="py-3 px-2 text-center text-amber-800 font-black">
                  {unitSummary.totalPendingCount} ca
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

