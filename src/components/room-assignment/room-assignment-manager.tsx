"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarX2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Grid3X3,
  LayoutTemplate,
  MapPin,
  RotateCcw,
  Search,
  Sparkles,
  Table,
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import type {
  Holiday,
  LeaveRecord,
  Position,
  PositionRule,
  ScheduleRule,
  StaffMember,
  TemplateAssignment,
  WeeklyAssignment,
} from "@/lib/types";
import { StaffPalette } from "./staff-palette";
import { RoomMatrixCell } from "./room-matrix-cell";
import { LeaveWarningModal } from "./leave-warning-modal";
import { RoomSummaryMatrix, type SlotInfo } from "./room-summary-matrix";
import { saveWeekRoomAssignmentsAction } from "@/app/actions";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { isOffDay } from "@/lib/date";
import { getActiveScheduleRules } from "@/lib/schedule";
import {
  getAreaStyle,
  getRoomGroupInfo,
  getStaffColorStyle,
  getStaffLeaveLabel,
  getStaffMatrixLabel,
  getStaffShortName,
  type AreaStyle,
  type RoomGroupInfo,
} from "./types";

interface RoomAssignmentManagerProps {
  weekStart: string;
  positions: Position[];
  staff: StaffMember[];
  leaveRequests: LeaveRecord[];
  scheduleRules: ScheduleRule[];
  holidays: Holiday[];
  templateSchedule?: TemplateAssignment[];
  positionRules?: PositionRule[];
  initialAssignments: WeeklyAssignment[];
  editable?: boolean;
}

interface PendingWarningState {
  isOpen: boolean;
  staff: StaffMember;
  position: Position;
  slotKey: string;
  slotLabel: string;
  leaveRecord: LeaveRecord;
  sourcePositionId?: string;
  sourceSlotKey?: string;
}

export function RoomAssignmentManager({
  weekStart,
  positions,
  staff,
  leaveRequests,
  scheduleRules,
  holidays,
  templateSchedule = [],
  initialAssignments,
  editable = true,
}: RoomAssignmentManagerProps) {
  // [QWEN3] Chế độ xem: "room-matrix" (Ma trận Phân Phòng Theo Ca - Chuẩn mẫu ảnh) hoặc "staff-matrix" (Theo nhân sự)
  const [viewMode, setViewMode] = useState<"room-matrix" | "staff-matrix">("room-matrix");

  // Tìm kiếm phòng trong ma trận phòng
  const [roomSearch, setRoomSearch] = useState("");

  // Nhân sự được chọn từ kho thẻ để click gán nhanh
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // State cảnh báo popup khi kéo vào ca nghỉ phép
  const [warningState, setWarningState] = useState<PendingWarningState | null>(null);

  // Phản hồi thông báo
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // [QWEN3] Sử dụng getActiveScheduleRules để đảm bảo luôn có đủ các ca làm việc trong tuần
  const slots: SlotInfo[] = useMemo(() => {
    const weekStartDate = parseISO(weekStart);
    const activeRules = getActiveScheduleRules(scheduleRules);

    return activeRules
      .map((rule) => {
        const slotDate = format(addDays(weekStartDate, rule.dayOfWeek - 1), "yyyy-MM-dd");
        return {
          date: slotDate,
          shift: rule.shift,
          dayOfWeek: rule.dayOfWeek,
          label: `${rule.shift === "morning" ? "Sáng" : "Chiều"} ${WEEKDAY_LABELS[rule.dayOfWeek]}`,
        };
      })
      .filter((slot) => !isOffDay(slot.date, slot.shift, holidays))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.shift === "morning" ? -1 : 1;
      });
  }, [weekStart, scheduleRules, holidays]);

  // Gom nhóm các slot theo ngày để vẽ header 2 tầng
  const daysGrouped = useMemo(() => {
    const map = new Map<string, { date: string; dayOfWeek: number; slots: SlotInfo[] }>();
    for (const slot of slots) {
      if (!map.has(slot.date)) {
        map.set(slot.date, { date: slot.date, dayOfWeek: slot.dayOfWeek, slots: [] });
      }
      map.get(slot.date)!.slots.push(slot);
    }
    return Array.from(map.values());
  }, [slots]);

  // [QWEN3] Khởi tạo phân công: ưu tiên initialAssignments, nếu trống sẽ tự động lấy templateSchedule
  const [assignmentsBySlot, setAssignmentsBySlot] = useState<
    Record<string, { positionId: string; staffId: string }[]>
  >(() => {
    const map: Record<string, { positionId: string; staffId: string }[]> = {};

    if (initialAssignments && initialAssignments.length > 0) {
      for (const item of initialAssignments) {
        const key = `${item.date}_${item.shift}`;
        if (!map[key]) map[key] = [];
        map[key].push({
          positionId: item.positionId,
          staffId: item.staffId,
        });
      }
    } else if (templateSchedule && templateSchedule.length > 0) {
      // Tự động nạp sẵn theo lịch nền nếu tuần này chưa được lưu phân công
      const weekStartDate = parseISO(weekStart);
      const activeRules = getActiveScheduleRules(scheduleRules);
      for (const rule of activeRules) {
        const slotDate = format(addDays(weekStartDate, rule.dayOfWeek - 1), "yyyy-MM-dd");
        const key = `${slotDate}_${rule.shift}`;
        const matches = templateSchedule.filter(
          (t) => t.dayOfWeek === rule.dayOfWeek && t.shift === rule.shift,
        );
        if (matches.length > 0) {
          map[key] = matches.map((t) => ({
            positionId: t.positionId,
            staffId: t.staffId,
          }));
        }
      }
    }

    return map;
  });

  // Đánh dấu các ca đã bị thay đổi
  const [modifiedSlots, setModifiedSlots] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Map vị trí tra cứu
  const positionMap = useMemo(() => {
    return new Map(positions.map((p) => [p.id, p]));
  }, [positions]);

  // Map nhân sự tra cứu
  const staffMap = useMemo(() => {
    return new Map(staff.map((s) => [s.id, s]));
  }, [staff]);

  // [QWEN3] Kho thẻ nhân viên: tính số ca nhân viên được gán trong tuần
  const staffWeekCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const list of Object.values(assignmentsBySlot)) {
      for (const item of list) {
        counts[item.staffId] = (counts[item.staffId] || 0) + 1;
      }
    }
    return counts;
  }, [assignmentsBySlot]);

  // Map tra cứu nghỉ phép: `${staffId}_${date}_${shift}` -> LeaveRecord
  const leaveMap = useMemo(() => {
    const map = new Map<string, LeaveRecord>();
    for (const leave of leaveRequests) {
      if (leave.shift === "full-day") {
        map.set(`${leave.staffId}_${leave.date}_morning`, leave);
        map.set(`${leave.staffId}_${leave.date}_afternoon`, leave);
      } else {
        map.set(`${leave.staffId}_${leave.date}_${leave.shift}`, leave);
      }
    }
    return map;
  }, [leaveRequests]);

  // Map tra cứu vị trí phân công: `${positionId}_${slotKey}` -> StaffMember[]
  const positionAssignmentsMap = useMemo(() => {
    const map = new Map<string, StaffMember[]>();
    for (const [slotKey, list] of Object.entries(assignmentsBySlot)) {
      for (const item of list) {
        const key = `${item.positionId}_${slotKey}`;
        const staffObj = staffMap.get(item.staffId);
        if (staffObj) {
          const current = map.get(key) || [];
          current.push(staffObj);
          map.set(key, current);
        }
      }
    }
    return map;
  }, [assignmentsBySlot, staffMap]);

  // [QWEN3] Trọng số ưu tiên sắp xếp khu vực mặc định
  const getAreaDefaultWeight = (area: string): number => {
    const l = area.toLowerCase().trim();
    if (l.includes("sảnh") || l.includes("tiếp nhận")) return 1;
    if (l.includes("trệt")) return 2;
    if (l.includes("tầng 1")) return 3;
    if (l.includes("tầng 2")) return 4;
    if (l.includes("tầng 3")) return 5;
    if (l.includes("khám")) return 6;
    if (l.includes("cận lâm sàng")) return 7;
    if (l.includes("thủ thuật")) return 8;
    if (l.includes("hành chính")) return 9;
    if (l.includes("khác")) return 99;
    return 50;
  };

  // [QWEN3] Quản lý thứ tự tùy chỉnh của các khu vực và phòng (lưu vào localStorage)
  const [customAreaOrder, setCustomAreaOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("nurseflow_room_matrix_area_order");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [customPosOrder, setCustomPosOrder] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem("nurseflow_room_matrix_pos_order");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // [QWEN3] Phân nhóm theo khu vực (area) và hỗ trợ dời thứ tự lên xuống
  const areaGroups = useMemo(() => {
    const map = new Map<string, Position[]>();
    for (const pos of positions) {
      const areaName = pos.area?.trim() || "Khu vực khác";
      if (!map.has(areaName)) {
        map.set(areaName, []);
      }
      map.get(areaName)!.push(pos);
    }

    const allAreaNames = Array.from(map.keys());

    // Sắp xếp khu vực theo customAreaOrder nếu có, hoặc theo trọng số mặc định
    allAreaNames.sort((a, b) => {
      if (customAreaOrder.length > 0) {
        const idxA = customAreaOrder.indexOf(a);
        const idxB = customAreaOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      const weightA = getAreaDefaultWeight(a);
      const weightB = getAreaDefaultWeight(b);
      if (weightA !== weightB) return weightA - weightB;
      return a.localeCompare(b, "vi");
    });

    const groups = allAreaNames.map((areaName) => {
      let posList = map.get(areaName) || [];

      if (roomSearch.trim()) {
        const q = roomSearch.toLowerCase();
        posList = posList.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q)),
        );
      }

      // Sắp xếp các phòng trong khu vực theo customPosOrder nếu có
      const orderForArea = customPosOrder[areaName];
      if (orderForArea && orderForArea.length > 0) {
        posList = [...posList].sort((a, b) => {
          const idxA = orderForArea.indexOf(a.id);
          const idxB = orderForArea.indexOf(b.id);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.name.localeCompare(b.name, "vi");
        });
      }

      return {
        areaName,
        style: getAreaStyle(areaName),
        positions: posList,
      };
    });

    return groups.filter((g) => g.positions.length > 0);
  }, [positions, customAreaOrder, customPosOrder, roomSearch]);

  // Tổng hợp danh sách ID phòng theo thứ tự hiện tại (để xuất Excel đúng thứ tự)
  const orderedPositionIds = useMemo(() => {
    return areaGroups.flatMap((g) => g.positions.map((p) => p.id));
  }, [areaGroups]);

  // Danh sách các phòng phẳng theo đúng thứ tự
  const orderedPositions = useMemo(() => {
    return areaGroups.flatMap((g) => g.positions);
  }, [areaGroups]);

  // Hàm dời vị trí lên/xuống của từng khu vực
  const handleMoveArea = (areaName: string, direction: "up" | "down") => {
    const currentAreas = areaGroups.map((g) => g.areaName);
    const idx = currentAreas.indexOf(areaName);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentAreas.length) return;

    const updated = [...currentAreas];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    setCustomAreaOrder(updated);
    try {
      localStorage.setItem("nurseflow_room_matrix_area_order", JSON.stringify(updated));
    } catch {}
    setFeedback({
      type: "success",
      message: `Đã dời khu vực "${areaName}" ${direction === "up" ? "lên trên" : "xuống dưới"}.`,
    });
  };

  // Hàm dời vị trí lên/xuống của từng phòng trong khu vực
  const handleMovePositionInArea = (
    areaName: string,
    posId: string,
    direction: "up" | "down",
    currentPositions: Position[],
  ) => {
    const currentIds = currentPositions.map((p) => p.id);
    const idx = currentIds.indexOf(posId);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentIds.length) return;

    const updated = [...currentIds];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    setCustomPosOrder((prev) => {
      const nextMap = { ...prev, [areaName]: updated };
      try {
        localStorage.setItem("nurseflow_room_matrix_pos_order", JSON.stringify(nextMap));
      } catch {}
      return nextMap;
    });

    const posObj = positionMap.get(posId);
    setFeedback({
      type: "success",
      message: `Đã dời phòng "${posObj?.name || posId}" ${direction === "up" ? "lên" : "xuống"}.`,
    });
  };

  // Hàm đặt lại thứ tự mặc định
  const handleResetOrder = () => {
    setCustomAreaOrder([]);
    setCustomPosOrder({});
    try {
      localStorage.removeItem("nurseflow_room_matrix_area_order");
      localStorage.removeItem("nurseflow_room_matrix_pos_order");
    } catch {}
    setFeedback({
      type: "success",
      message: "Đã khôi phục thứ tự hiển thị khu vực và phòng về mặc định.",
    });
  };

  // Tìm label của slot từ slotKey
  const getSlotLabel = (slotKey: string): string => {
    const found = slots.find((s) => `${s.date}_${s.shift}` === slotKey);
    return found ? found.label : slotKey;
  };

  // 1. Thao tác GÁN nhân sự vào phòng (có kiểm tra phép và popup)
  const handleAssignStaffToRoom = (
    staffId: string,
    positionId: string,
    slotKey: string,
    force = false,
  ) => {
    if (!editable) {
      setFeedback({
        type: "error",
        message: "Bạn không có quyền chỉnh sửa phân công.",
      });
      return;
    }

    const staffObj = staffMap.get(staffId);
    const posObj = positionMap.get(positionId);
    if (!staffObj || !posObj) return;

    // Kiểm tra nhân sự có phép trong ca này hay không
    const leave = leaveMap.get(`${staffId}_${slotKey}`);
    if (leave && !force) {
      // Mở Popup Cảnh Báo Nghỉ Phép!
      setWarningState({
        isOpen: true,
        staff: staffObj,
        position: posObj,
        slotKey,
        slotLabel: getSlotLabel(slotKey),
        leaveRecord: leave,
      });
      return;
    }

    // Thực hiện gán
    setAssignmentsBySlot((prev) => {
      const currentList = prev[slotKey] || [];
      // Kiểm tra xem nhân sự đã được gán vào phòng này trong ca này chưa
      if (currentList.some((item) => item.staffId === staffId && item.positionId === positionId)) {
        setFeedback({
          type: "error",
          message: `${getStaffMatrixLabel(staffObj.name)} đã được gán vào ${posObj.name} trong ca này rồi.`,
        });
        return prev;
      }

      setModifiedSlots((prevMod) => new Set(prevMod).add(slotKey));
      setFeedback({
        type: "success",
        message: `Đã phân ${getStaffMatrixLabel(staffObj.name)} vào ${posObj.name}!`,
      });

      return {
        ...prev,
        [slotKey]: [...currentList, { positionId, staffId }],
      };
    });

    // Reset chọn nếu đang click-assign
    setSelectedStaffId(null);
  };

  // 2. Thao tác DI CHUYỂN nhân sự giữa các ô phòng
  const handleMoveStaff = (
    staffId: string,
    sourcePositionId: string,
    sourceSlotKey: string,
    targetPositionId: string,
    targetSlotKey: string,
    force = false,
  ) => {
    if (!editable) return;

    const staffObj = staffMap.get(staffId);
    const targetPosObj = positionMap.get(targetPositionId);
    if (!staffObj || !targetPosObj) return;

    // Kiểm tra nghỉ phép ở slot đích
    const leave = leaveMap.get(`${staffId}_${targetSlotKey}`);
    if (leave && !force) {
      setWarningState({
        isOpen: true,
        staff: staffObj,
        position: targetPosObj,
        slotKey: targetSlotKey,
        slotLabel: getSlotLabel(targetSlotKey),
        leaveRecord: leave,
        sourcePositionId,
        sourceSlotKey,
      });
      return;
    }

    // Thực hiện di chuyển: xóa ở nguồn, thêm ở đích
    setAssignmentsBySlot((prev) => {
      const sourceList = (prev[sourceSlotKey] || []).filter(
        (item) => !(item.staffId === staffId && item.positionId === sourcePositionId),
      );

      const targetList = (prev[targetSlotKey] || []).filter(
        (item) => !(item.staffId === staffId && item.positionId === targetPositionId),
      );
      targetList.push({ positionId: targetPositionId, staffId });

      return {
        ...prev,
        [sourceSlotKey]: sourceList,
        [targetSlotKey]: targetList,
      };
    });

    setModifiedSlots((prev) => new Set(prev).add(sourceSlotKey).add(targetSlotKey));
    setFeedback({
      type: "success",
      message: `Đã chuyển ${getStaffMatrixLabel(staffObj.name)} sang ${targetPosObj.name}!`,
    });
  };

  // 3. Thao tác THÁO PHÒNG (Nút ✕ trên thẻ nhân viên)
  const handleRemoveStaffFromRoom = (staffId: string, positionId: string, slotKey: string) => {
    if (!editable) return;

    const staffObj = staffMap.get(staffId);
    const posObj = positionMap.get(positionId);

    setAssignmentsBySlot((prev) => {
      const currentList = prev[slotKey] || [];
      const updated = currentList.filter(
        (item) => !(item.staffId === staffId && item.positionId === positionId),
      );
      return {
        ...prev,
        [slotKey]: updated,
      };
    });

    setModifiedSlots((prev) => new Set(prev).add(slotKey));
    setFeedback({
      type: "success",
      message: `Đã tháo ${getStaffMatrixLabel(staffObj?.name || "")} khỏi ${posObj?.name || "phòng"}.`,
    });
  };

  // 4. [QWEN3] NÚT PHÂN PHÒNG THEO LỊCH NỀN: Nạp toàn bộ phân công mẫu vào tuần
  const handleApplyTemplateSchedule = () => {
    if (!editable) return;
    if (templateSchedule.length === 0) {
      setFeedback({
        type: "error",
        message: "Chưa có dữ liệu lịch nền để áp dụng.",
      });
      return;
    }

    const newAssignmentsMap: Record<string, { positionId: string; staffId: string }[]> = {};
    let totalAssigned = 0;

    for (const slot of slots) {
      const key = `${slot.date}_${slot.shift}`;
      const matches = templateSchedule.filter(
        (t) => t.dayOfWeek === slot.dayOfWeek && t.shift === slot.shift,
      );

      newAssignmentsMap[key] = matches.map((t) => ({
        positionId: t.positionId,
        staffId: t.staffId,
      }));

      totalAssigned += matches.length;
    }

    setAssignmentsBySlot(newAssignmentsMap);
    setModifiedSlots(new Set(slots.map((s) => `${s.date}_${s.shift}`)));
    setFeedback({
      type: "success",
      message: `Đã tự động phân phòng từ lịch nền cho cả tuần (${totalAssigned} lượt)! Bạn có thể kéo thả điều chỉnh lại.`,
    });
  };

  // 5. Xóa trắng toàn bộ phân công tuần
  const handleResetAllWeek = () => {
    if (!editable) return;
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ phân công tuần này để xếp lại từ đầu?")) return;

    const cleared: Record<string, { positionId: string; staffId: string }[]> = {};
    for (const slot of slots) {
      cleared[`${slot.date}_${slot.shift}`] = [];
    }

    setAssignmentsBySlot(cleared);
    setModifiedSlots(new Set(slots.map((s) => `${s.date}_${s.shift}`)));
    setFeedback({
      type: "success",
      message: "Đã xóa toàn bộ phân công phòng của tuần này.",
    });
  };

  // 6. Lưu toàn bộ phân công tuần
  const handleSaveAll = () => {
    if (!editable) return;

    startTransition(async () => {
      try {
        const slotsToSave = slots.map((s) => {
          const key = `${s.date}_${s.shift}`;
          return {
            date: s.date,
            shift: s.shift,
            assignments: assignmentsBySlot[key] || [],
          };
        });

        await saveWeekRoomAssignmentsAction({
          weekStart,
          slots: slotsToSave,
        });

        setModifiedSlots(new Set());
        setFeedback({
          type: "success",
          message: "Đã lưu toàn bộ phân công phòng tuần vào hệ thống thành công!",
        });
      } catch (err: unknown) {
        setFeedback({
          type: "error",
          message: (err as Error)?.message || "Có lỗi xảy ra khi lưu phân công.",
        });
      }
    });
  };

  const hasUnsavedChanges = modifiedSlots.size > 0;
  const startDate = parseISO(weekStart);
  const endDate = addDays(startDate, 6);

  return (
    <div className="space-y-5">
      {/* THANH ĐIỀU KHIỂN TRÊN CÙNG */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 shadow-2xs">
                <Grid3X3 className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                Ma Trận Phân Phòng Theo Ca
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Dòng là Phòng (nhóm khu vực) • Cột là Buổi/Thứ • Thẻ nhân viên ghi gọn <strong>ĐD Tên</strong> • Tuần {format(startDate, "dd/MM/yyyy")} – {format(endDate, "dd/MM/yyyy")}
            </p>
          </div>

          {/* Các nút hành động */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Chuyển chế độ xem */}
            <div className="inline-flex rounded-2xl bg-slate-100 p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode("room-matrix")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "room-matrix"
                    ? "bg-white text-teal-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Grid3X3 className="h-4 w-4 text-teal-600" />
                Ma trận Phòng × Ca (Chuẩn mẫu)
              </button>

              <button
                type="button"
                onClick={() => setViewMode("staff-matrix")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "staff-matrix"
                    ? "bg-white text-teal-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Table className="h-4 w-4" />
                Bảng tổng hợp theo Nhân sự
              </button>
            </div>

            {/* [QWEN3] Nút Phân phòng theo lịch nền */}
            {editable && (
              <button
                type="button"
                onClick={handleApplyTemplateSchedule}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100 shadow-xs active:scale-95 cursor-pointer transition-all"
                title="Lấy phân công mẫu trong Lịch nền áp dụng sẵn cho cả tuần"
              >
                <LayoutTemplate className="h-4 w-4 text-teal-700" />
                Phân phòng theo lịch nền
              </button>
            )}

            {/* [QWEN3] Nút Xuất Excel Ma Trận chuẩn theo mẫu và đúng thứ tự sắp xếp */}
            <a
              href={`/api/export/room-matrix?week=${weekStart}${orderedPositionIds.length > 0 ? `&order=${encodeURIComponent(orderedPositionIds.join(","))}` : ""}`}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-950 hover:bg-emerald-100 shadow-xs active:scale-95 transition-all"
              title="Xuất file Excel ma trận phân phòng đúng thứ tự khu vực và phòng hiện tại"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
              Xuất Excel Ma Trận
            </a>

            {/* Nút Xóa trắng */}
            {editable && (
              <button
                type="button"
                onClick={handleResetAllWeek}
                className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 shadow-xs cursor-pointer transition-all"
                title="Xóa toàn bộ phân công của tuần này để làm lại"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Xóa trắng
              </button>
            )}

            {/* Nút Lưu tuần */}
            {editable && (
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isPending || !hasUnsavedChanges}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-500 active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isPending ? "Đang lưu..." : hasUnsavedChanges ? "Lưu phân công tuần" : "Đã lưu đầy đủ"}
              </button>
            )}
          </div>
        </div>

        {/* Thông báo phản hồi */}
        {feedback && (
          <div
            className={`mt-4 flex items-center justify-between rounded-2xl px-4 py-2.5 text-xs font-semibold ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : "bg-rose-50 text-rose-900 border border-rose-200"
            }`}
          >
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {viewMode === "staff-matrix" ? (
        /* CHẾ ĐỘ XEM TỔNG HỢP THEO NHÂN SỰ */
        <RoomSummaryMatrix
          weekStart={weekStart}
          positions={orderedPositions}
          staff={staff}
          slots={slots}
          assignmentsBySlot={assignmentsBySlot}
          leaveRequests={leaveRequests}
          onBackToDnD={() => setViewMode("room-matrix")}
          onSaveAll={handleSaveAll}
          isSaving={isPending}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      ) : (
        /* MA TRẬN PHÂN PHÒNG THEO CA (PHÒNG × BUỔI/THỨ) - CHUẨN MẪU THỰC TẾ */
        <div className="space-y-5">
          {/* 1. KHO THẺ NHÂN VIÊN TRÊN CÙNG */}
          <StaffPalette
            staff={staff}
            staffCounts={staffWeekCounts}
            selectedStaffId={selectedStaffId}
            onSelectStaff={setSelectedStaffId}
            onDragStaffStart={() => {}}
            onDragStaffEnd={() => {}}
          />

          {/* 2. MA TRẬN PHÂN PHÒNG THEO CA */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm xl:p-5">
            {/* Thanh tìm kiếm phòng & Đặt lại thứ tự */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Ma Trận Phân Phòng Theo Ca</span>
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                    {orderedPositionIds.length} phòng • {areaGroups.length} khu vực • {slots.length} ca
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Phân nhóm theo khu vực • Bấm nút <strong>↑ / ↓</strong> để dời vị trí khu vực và phòng • Kéo thẻ nhân viên để phân công
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(customAreaOrder.length > 0 || Object.keys(customPosOrder).length > 0) && (
                  <button
                    type="button"
                    onClick={handleResetOrder}
                    className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                    title="Khôi phục thứ tự khu vực và phòng về mặc định ban đầu"
                  >
                    <RotateCcw className="h-3 w-3 text-slate-400" />
                    Đặt lại thứ tự
                  </button>
                )}

                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Lọc phòng hoặc khu vực..."
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Bảng Ma Trận Phòng × Buổi/Thứ */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
              <table className="w-full min-w-[950px] border-collapse text-left text-xs">
                <thead>
                  {/* Hàng 1: Tiêu đề Cột Phòng & Các Ngày trong tuần */}
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-800">
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-20 w-60 min-w-[220px] border-r border-slate-200 bg-slate-100 p-3 font-bold uppercase tracking-wider text-slate-800 shadow-xs"
                    >
                      Khu vực / Phòng làm việc
                    </th>

                    {daysGrouped.map((day) => (
                      <th
                        key={day.date}
                        colSpan={day.slots.length}
                        className="border-r border-slate-200 p-2 text-center font-bold text-slate-800 bg-slate-50"
                      >
                        <div className="text-[11px] font-normal text-slate-500">
                          {format(parseISO(day.date), "d/M")}
                        </div>
                        <div className="font-extrabold text-teal-900 text-xs">
                          {WEEKDAY_LABELS[day.dayOfWeek]}
                        </div>
                      </th>
                    ))}
                  </tr>

                  {/* Hàng 2: Các ca (Sáng / Chiều) */}
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                    {slots.map((slot) => (
                      <th
                        key={`${slot.date}_${slot.shift}`}
                        className={`border-r border-slate-200 p-1.5 text-center font-bold text-[11px] min-w-[125px] ${
                          slot.shift === "morning"
                            ? "bg-amber-50/50 text-amber-950"
                            : "bg-sky-50/50 text-sky-950"
                        }`}
                      >
                        {slot.shift === "morning" ? "Sáng" : "Chiều"}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {areaGroups.map((group, groupIndex) => {
                    return (
                      <tr key={`group-${group.areaName}`} className="contents">
                        {/* Thanh phân chia Khu vực có nút Dời vị trí lên/xuống */}
                        <tr className={`border-t-2 border-b ${group.style.border} ${group.style.bg}`}>
                          <td
                            colSpan={slots.length + 1}
                            className={`sticky left-0 z-10 px-3 py-1.5 text-xs font-bold ${group.style.text}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[11px] font-extrabold ${group.style.badge} text-white shadow-2xs`}
                                >
                                  <MapPin className="h-3 w-3" />
                                  Khu vực: {group.areaName} ({group.positions.length} phòng)
                                </span>
                              </div>

                              {/* Cụm nút di chuyển Khu vực lên/xuống */}
                              {editable && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400 font-normal mr-1">Dời khu vực:</span>
                                  <button
                                    type="button"
                                    disabled={groupIndex === 0}
                                    onClick={() => handleMoveArea(group.areaName, "up")}
                                    className="flex h-5 w-5 items-center justify-center rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                                    title={`Chuyển khu vực "${group.areaName}" lên trên`}
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={groupIndex === areaGroups.length - 1}
                                    onClick={() => handleMoveArea(group.areaName, "down")}
                                    className="flex h-5 w-5 items-center justify-center rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                                    title={`Chuyển khu vực "${group.areaName}" xuống dưới`}
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Danh sách các phòng trong khu vực */}
                        {group.positions.map((pos, posIndex) => {
                          return (
                            <tr
                              key={pos.id}
                              className={`hover:bg-slate-50/80 transition-colors ${group.style.lightBg}`}
                            >
                              {/* Cột Tên phòng (Sticky bên trái) có nút Dời vị trí lên/xuống */}
                              <td className="sticky left-0 z-10 border-r border-b border-slate-200/90 bg-white/95 px-3 py-2 font-bold text-slate-900 shadow-xs">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate text-xs font-bold text-slate-900">{pos.name}</span>
                                      {pos.quota && pos.quota > 1 && (
                                        <span className="shrink-0 rounded-md bg-slate-100 px-1 py-0.2 text-[10px] text-slate-500 font-normal">
                                          ĐB: {pos.quota}
                                        </span>
                                      )}
                                    </div>
                                    {pos.description && (
                                      <span className="text-[10px] text-slate-400 font-normal block truncate">
                                        {pos.description}
                                      </span>
                                    )}
                                  </div>

                                  {/* Cụm nút di chuyển phòng lên/xuống */}
                                  {editable && (
                                    <div className="flex items-center gap-0.5 shrink-0 opacity-40 hover:opacity-100 transition-opacity">
                                      <button
                                        type="button"
                                        disabled={posIndex === 0}
                                        onClick={() =>
                                          handleMovePositionInArea(
                                            group.areaName,
                                            pos.id,
                                            "up",
                                            group.positions,
                                          )
                                        }
                                        className="flex h-5 w-5 items-center justify-center rounded text-slate-600 hover:bg-teal-100 hover:text-teal-800 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
                                        title={`Dời phòng "${pos.name}" lên trên`}
                                      >
                                        <ArrowUp className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={posIndex === group.positions.length - 1}
                                        onClick={() =>
                                          handleMovePositionInArea(
                                            group.areaName,
                                            pos.id,
                                            "down",
                                            group.positions,
                                          )
                                        }
                                        className="flex h-5 w-5 items-center justify-center rounded text-slate-600 hover:bg-teal-100 hover:text-teal-800 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
                                        title={`Dời phòng "${pos.name}" xuống dưới`}
                                      >
                                        <ArrowDown className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Các ô buổi/thứ cho phòng này */}
                              {slots.map((slot) => {
                                const slotKey = `${slot.date}_${slot.shift}`;
                                const assignedStaff = positionAssignmentsMap.get(`${pos.id}_${slotKey}`) || [];

                                return (
                                  <RoomMatrixCell
                                    key={`${pos.id}_${slotKey}`}
                                    position={pos}
                                    slot={slot}
                                    assignedStaff={assignedStaff}
                                    leaveMap={leaveMap}
                                    selectedStaffId={selectedStaffId}
                                    editable={editable}
                                    onAssignStaff={(staffId, positionId, sKey) => {
                                      handleAssignStaffToRoom(staffId, positionId, sKey);
                                    }}
                                    onRemoveStaff={handleRemoveStaffFromRoom}
                                    onMoveStaff={handleMoveStaff}
                                  />
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* [QWEN3] DÒNG PHÉP Ở CUỐI BẢNG (MÀU CAM NHẠT CHUẨN MẪU THỰC TẾ) */}
                  <tr className="border-t-2 border-amber-300 bg-amber-50/90 font-semibold">
                    <td className="sticky left-0 z-10 border-r border-b border-amber-300 bg-amber-100/90 px-3 py-3 font-bold text-amber-950 shadow-xs">
                      <div className="flex items-center gap-1.5">
                        <CalendarX2 className="h-4 w-4 text-amber-700" />
                        <span>Phép</span>
                      </div>
                    </td>

                    {/* Tự động gán nhân viên đăng ký phép vào từng buổi/thứ, kèm ghi chú tắt lý do nghỉ */}
                    {slots.map((slot) => {
                      const leavesOnSlot = leaveRequests.filter(
                        (l) =>
                          l.date === slot.date &&
                          (l.shift === "full-day" || l.shift === slot.shift),
                      );

                      const staffLeaves = leavesOnSlot
                        .map((l) => {
                          const staffObj = staffMap.get(l.staffId);
                          return staffObj ? { person: staffObj, leave: l } : null;
                        })
                        .filter(Boolean) as { person: StaffMember; leave: LeaveRecord }[];

                      return (
                        <td
                          key={`leave-${slot.date}-${slot.shift}`}
                          className="border-r border-b border-amber-200/90 p-1.5 align-top text-center"
                        >
                          {staffLeaves.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {staffLeaves.map(({ person, leave }) => {
                                const leaveLabel = getStaffLeaveLabel(person.name, leave.reason, leave.note);
                                const colorStyle = getStaffColorStyle(person.id || person.name);

                                return (
                                  <span
                                    key={leave.id || `${person.id}-${slot.date}`}
                                    className={`inline-flex items-center justify-center gap-1 rounded-xl px-2 py-0.5 text-[11px] font-bold shadow-2xs border ${colorStyle.bg} ${colorStyle.border} ${colorStyle.text}`}
                                    title={`${person.name} (${person.code || "NV"}) - Lý do: ${leave.reason} ${leave.note ? `(${leave.note})` : ""}`}
                                  >
                                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colorStyle.avatarBg}`} />
                                    {leaveLabel}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-amber-300/80 select-none">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* POPUP CẢNH BÁO NGHỈ PHÉP */}
      <LeaveWarningModal
        isOpen={Boolean(warningState?.isOpen)}
        staff={warningState?.staff || null}
        position={warningState?.position || null}
        slotLabel={warningState?.slotLabel || ""}
        leaveRecord={warningState?.leaveRecord || null}
        onCancel={() => setWarningState(null)}
        onConfirm={() => {
          if (!warningState) return;
          if (warningState.sourcePositionId && warningState.sourceSlotKey) {
            handleMoveStaff(
              warningState.staff.id,
              warningState.sourcePositionId,
              warningState.sourceSlotKey,
              warningState.position.id,
              warningState.slotKey,
              true, // force = true
            );
          } else {
            handleAssignStaffToRoom(
              warningState.staff.id,
              warningState.position.id,
              warningState.slotKey,
              true, // force = true
            );
          }
          setWarningState(null);
        }}
      />
    </div>
  );
}
