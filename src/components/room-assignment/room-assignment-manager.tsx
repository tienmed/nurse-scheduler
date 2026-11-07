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
  getStaffColorStyle,
  getStaffLeaveLabel,
  getStaffMatrixLabel,
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
  // [QWEN3] Cháº¿ Ä‘á»™ xem: "room-matrix" (Ma tráº­n PhÃ¢n PhÃ²ng Theo Ca - Chuáº©n máº«u áº£nh) hoáº·c "staff-matrix" (Theo nhÃ¢n sá»±)
  const [viewMode, setViewMode] = useState<"room-matrix" | "staff-matrix">("room-matrix");

  // TÃ¬m kiáº¿m phÃ²ng trong ma tráº­n phÃ²ng
  const [roomSearch, setRoomSearch] = useState("");

  // NhÃ¢n sá»± Ä‘Æ°á»£c chá»n tá»« kho tháº» Ä‘á»ƒ click gÃ¡n nhanh
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // State cáº£nh bÃ¡o popup khi kÃ©o vÃ o ca nghá»‰ phÃ©p
  const [warningState, setWarningState] = useState<PendingWarningState | null>(null);

  // Pháº£n há»“i thÃ´ng bÃ¡o
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // [QWEN3] Sá»­ dá»¥ng getActiveScheduleRules Ä‘á»ƒ Ä‘áº£m báº£o luÃ´n cÃ³ Ä‘á»§ cÃ¡c ca lÃ m viá»‡c trong tuáº§n
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
          label: `${rule.shift === "morning" ? "SÃ¡ng" : "Chiá»u"} ${WEEKDAY_LABELS[rule.dayOfWeek]}`,
        };
      })
      .filter((slot) => !isOffDay(slot.date, slot.shift, holidays))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.shift === "morning" ? -1 : 1;
      });
  }, [weekStart, scheduleRules, holidays]);

  // Gom nhÃ³m cÃ¡c slot theo ngÃ y Ä‘á»ƒ váº½ header 2 táº§ng
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

  // [QWEN3] Khá»Ÿi táº¡o phÃ¢n cÃ´ng: Æ°u tiÃªn initialAssignments, náº¿u trá»‘ng sáº½ tá»± Ä‘á»™ng láº¥y templateSchedule
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
      // Tá»± Ä‘á»™ng náº¡p sáºµn theo lá»‹ch ná»n náº¿u tuáº§n nÃ y chÆ°a Ä‘Æ°á»£c lÆ°u phÃ¢n cÃ´ng
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

  // ÄÃ¡nh dáº¥u cÃ¡c ca Ä‘Ã£ bá»‹ thay Ä‘á»•i
  const [modifiedSlots, setModifiedSlots] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Map vá»‹ trÃ­ tra cá»©u
  const positionMap = useMemo(() => {
    return new Map(positions.map((p) => [p.id, p]));
  }, [positions]);

  // Map nhÃ¢n sá»± tra cá»©u
  const staffMap = useMemo(() => {
    return new Map(staff.map((s) => [s.id, s]));
  }, [staff]);

  // [QWEN3] Kho tháº» nhÃ¢n viÃªn: tÃ­nh sá»‘ ca nhÃ¢n viÃªn Ä‘Æ°á»£c gÃ¡n trong tuáº§n
  const staffWeekCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const list of Object.values(assignmentsBySlot)) {
      for (const item of list) {
        counts[item.staffId] = (counts[item.staffId] || 0) + 1;
      }
    }
    return counts;
  }, [assignmentsBySlot]);

  // Map tra cá»©u nghá»‰ phÃ©p: `${staffId}_${date}_${shift}` -> LeaveRecord
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

  // Map tra cá»©u vá»‹ trÃ­ phÃ¢n cÃ´ng: `${positionId}_${slotKey}` -> StaffMember[]
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

  // [QWEN3] Trá»ng sá»‘ Æ°u tiÃªn sáº¯p xáº¿p khu vá»±c máº·c Ä‘á»‹nh
  const getAreaDefaultWeight = (area: string): number => {
    const l = area.toLowerCase().trim();
    if (l.includes("sáº£nh") || l.includes("tiáº¿p nháº­n")) return 1;
    if (l.includes("trá»‡t")) return 2;
    if (l.includes("táº§ng 1")) return 3;
    if (l.includes("táº§ng 2")) return 4;
    if (l.includes("táº§ng 3")) return 5;
    if (l.includes("khÃ¡m")) return 6;
    if (l.includes("cáº­n lÃ¢m sÃ ng")) return 7;
    if (l.includes("thá»§ thuáº­t")) return 8;
    if (l.includes("hÃ nh chÃ­nh")) return 9;
    if (l.includes("khÃ¡c")) return 99;
    return 50;
  };

  // [QWEN3] Quáº£n lÃ½ thá»© tá»± tÃ¹y chá»‰nh cá»§a cÃ¡c khu vá»±c vÃ  phÃ²ng (lÆ°u vÃ o localStorage)
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

  // [QWEN3] PhÃ¢n nhÃ³m theo khu vá»±c (area) vÃ  há»— trá»£ dá»i thá»© tá»± lÃªn xuá»‘ng
  const areaGroups = useMemo(() => {
    const map = new Map<string, Position[]>();
    for (const pos of positions) {
      const areaName = pos.area?.trim() || "Khu vá»±c khÃ¡c";
      if (!map.has(areaName)) {
        map.set(areaName, []);
      }
      map.get(areaName)!.push(pos);
    }

    const allAreaNames = Array.from(map.keys());

    // Sáº¯p xáº¿p khu vá»±c theo customAreaOrder náº¿u cÃ³, hoáº·c theo trá»ng sá»‘ máº·c Ä‘á»‹nh
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

      // Sáº¯p xáº¿p cÃ¡c phÃ²ng trong khu vá»±c theo customPosOrder náº¿u cÃ³
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

  // Tá»•ng há»£p danh sÃ¡ch ID phÃ²ng theo thá»© tá»± hiá»‡n táº¡i (Ä‘á»ƒ xuáº¥t Excel Ä‘Ãºng thá»© tá»±)
  const orderedPositionIds = useMemo(() => {
    return areaGroups.flatMap((g) => g.positions.map((p) => p.id));
  }, [areaGroups]);

  // Danh sÃ¡ch cÃ¡c phÃ²ng pháº³ng theo Ä‘Ãºng thá»© tá»±
  const orderedPositions = useMemo(() => {
    return areaGroups.flatMap((g) => g.positions);
  }, [areaGroups]);

  // HÃ m dá»i vá»‹ trÃ­ lÃªn/xuá»‘ng cá»§a tá»«ng khu vá»±c
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
      message: `ÄÃ£ dá»i khu vá»±c "${areaName}" ${direction === "up" ? "lÃªn trÃªn" : "xuá»‘ng dÆ°á»›i"}.`,
    });
  };

  // HÃ m dá»i vá»‹ trÃ­ lÃªn/xuá»‘ng cá»§a tá»«ng phÃ²ng trong khu vá»±c
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
      message: `ÄÃ£ dá»i phÃ²ng "${posObj?.name || posId}" ${direction === "up" ? "lÃªn" : "xuá»‘ng"}.`,
    });
  };

  // HÃ m Ä‘áº·t láº¡i thá»© tá»± máº·c Ä‘á»‹nh
  const handleResetOrder = () => {
    setCustomAreaOrder([]);
    setCustomPosOrder({});
    try {
      localStorage.removeItem("nurseflow_room_matrix_area_order");
      localStorage.removeItem("nurseflow_room_matrix_pos_order");
    } catch {}
    setFeedback({
      type: "success",
      message: "ÄÃ£ khÃ´i phá»¥c thá»© tá»± hiá»ƒn thá»‹ khu vá»±c vÃ  phÃ²ng vá» máº·c Ä‘á»‹nh.",
    });
  };

  // TÃ¬m label cá»§a slot tá»« slotKey
  const getSlotLabel = (slotKey: string): string => {
    const found = slots.find((s) => `${s.date}_${s.shift}` === slotKey);
    return found ? found.label : slotKey;
  };

  // 1. Thao tÃ¡c GÃN nhÃ¢n sá»± vÃ o phÃ²ng (cÃ³ kiá»ƒm tra phÃ©p vÃ  popup)
  const handleAssignStaffToRoom = (
    staffId: string,
    positionId: string,
    slotKey: string,
    force = false,
  ) => {
    if (!editable) {
      setFeedback({
        type: "error",
        message: "Báº¡n khÃ´ng cÃ³ quyá»n chá»‰nh sá»­a phÃ¢n cÃ´ng.",
      });
      return;
    }

    const staffObj = staffMap.get(staffId);
    const posObj = positionMap.get(positionId);
    if (!staffObj || !posObj) return;

    // Kiá»ƒm tra nhÃ¢n sá»± cÃ³ phÃ©p trong ca nÃ y hay khÃ´ng
    const leave = leaveMap.get(`${staffId}_${slotKey}`);
    if (leave && !force) {
      // Má»Ÿ Popup Cáº£nh BÃ¡o Nghá»‰ PhÃ©p!
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

    // Thá»±c hiá»‡n gÃ¡n
    setAssignmentsBySlot((prev) => {
      const currentList = prev[slotKey] || [];
      // Kiá»ƒm tra xem nhÃ¢n sá»± Ä‘Ã£ Ä‘Æ°á»£c gÃ¡n vÃ o phÃ²ng nÃ y trong ca nÃ y chÆ°a
      if (currentList.some((item) => item.staffId === staffId && item.positionId === positionId)) {
        setFeedback({
          type: "error",
          message: `${getStaffMatrixLabel(staffObj.name)} Ä‘Ã£ Ä‘Æ°á»£c gÃ¡n vÃ o ${posObj.name} trong ca nÃ y rá»“i.`,
        });
        return prev;
      }

      setModifiedSlots((prevMod) => new Set(prevMod).add(slotKey));
      setFeedback({
        type: "success",
        message: `ÄÃ£ phÃ¢n ${getStaffMatrixLabel(staffObj.name)} vÃ o ${posObj.name}!`,
      });

      return {
        ...prev,
        [slotKey]: [...currentList, { positionId, staffId }],
      };
    });

    // Reset chá»n náº¿u Ä‘ang click-assign
    setSelectedStaffId(null);
  };

  // 2. Thao tÃ¡c DI CHUYá»‚N nhÃ¢n sá»± giá»¯a cÃ¡c Ã´ phÃ²ng
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

    // Kiá»ƒm tra nghá»‰ phÃ©p á»Ÿ slot Ä‘Ã­ch
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

    // Thá»±c hiá»‡n di chuyá»ƒn: xÃ³a á»Ÿ nguá»“n, thÃªm á»Ÿ Ä‘Ã­ch
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
      message: `ÄÃ£ chuyá»ƒn ${getStaffMatrixLabel(staffObj.name)} sang ${targetPosObj.name}!`,
    });
  };

  // 3. Thao tÃ¡c THÃO PHÃ’NG (NÃºt âœ• trÃªn tháº» nhÃ¢n viÃªn)
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
      message: `ÄÃ£ thÃ¡o ${getStaffMatrixLabel(staffObj?.name || "")} khá»i ${posObj?.name || "phÃ²ng"}.`,
    });
  };

  // 4. [QWEN3] NÃšT PHÃ‚N PHÃ’NG THEO Lá»ŠCH Ná»€N: Náº¡p toÃ n bá»™ phÃ¢n cÃ´ng máº«u vÃ o tuáº§n
  const handleApplyTemplateSchedule = () => {
    if (!editable) return;
    if (templateSchedule.length === 0) {
      setFeedback({
        type: "error",
        message: "ChÆ°a cÃ³ dá»¯ liá»‡u lá»‹ch ná»n Ä‘á»ƒ Ã¡p dá»¥ng.",
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
      message: `ÄÃ£ tá»± Ä‘á»™ng phÃ¢n phÃ²ng tá»« lá»‹ch ná»n cho cáº£ tuáº§n (${totalAssigned} lÆ°á»£t)! Báº¡n cÃ³ thá»ƒ kÃ©o tháº£ Ä‘iá»u chá»‰nh láº¡i.`,
    });
  };

  // 5. XÃ³a tráº¯ng toÃ n bá»™ phÃ¢n cÃ´ng tuáº§n
  const handleResetAllWeek = () => {
    if (!editable) return;
    if (!confirm("Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a toÃ n bá»™ phÃ¢n cÃ´ng tuáº§n nÃ y Ä‘á»ƒ xáº¿p láº¡i tá»« Ä‘áº§u?")) return;

    const cleared: Record<string, { positionId: string; staffId: string }[]> = {};
    for (const slot of slots) {
      cleared[`${slot.date}_${slot.shift}`] = [];
    }

    setAssignmentsBySlot(cleared);
    setModifiedSlots(new Set(slots.map((s) => `${s.date}_${s.shift}`)));
    setFeedback({
      type: "success",
      message: "ÄÃ£ xÃ³a toÃ n bá»™ phÃ¢n cÃ´ng phÃ²ng cá»§a tuáº§n nÃ y.",
    });
  };

  // 6. LÆ°u toÃ n bá»™ phÃ¢n cÃ´ng tuáº§n
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
          message: "ÄÃ£ lÆ°u toÃ n bá»™ phÃ¢n cÃ´ng phÃ²ng tuáº§n vÃ o há»‡ thá»‘ng thÃ nh cÃ´ng!",
        });
      } catch (err: unknown) {
        setFeedback({
          type: "error",
          message: (err as Error)?.message || "CÃ³ lá»—i xáº£y ra khi lÆ°u phÃ¢n cÃ´ng.",
        });
      }
    });
  };

  const hasUnsavedChanges = modifiedSlots.size > 0;
  const startDate = parseISO(weekStart);
  const endDate = addDays(startDate, 6);

  return (
    <div className="space-y-5">
      {/* THANH ÄIá»€U KHIá»‚N TRÃŠN CÃ™NG */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 shadow-2xs">
                <Grid3X3 className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                Ma Tráº­n PhÃ¢n PhÃ²ng Theo Ca
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              DÃ²ng lÃ  PhÃ²ng (nhÃ³m khu vá»±c) â€¢ Cá»™t lÃ  Buá»•i/Thá»© â€¢ Tháº» nhÃ¢n viÃªn ghi gá»n <strong>ÄD TÃªn</strong> â€¢ Tuáº§n {format(startDate, "dd/MM/yyyy")} â€“ {format(endDate, "dd/MM/yyyy")}
            </p>
          </div>

          {/* CÃ¡c nÃºt hÃ nh Ä‘á»™ng */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Chuyá»ƒn cháº¿ Ä‘á»™ xem */}
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
                Ma tráº­n PhÃ²ng Ã— Ca (Chuáº©n máº«u)
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
                Báº£ng tá»•ng há»£p theo NhÃ¢n sá»±
              </button>
            </div>

            {/* [QWEN3] NÃºt PhÃ¢n phÃ²ng theo lá»‹ch ná»n */}
            {editable && (
              <button
                type="button"
                onClick={handleApplyTemplateSchedule}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100 shadow-xs active:scale-95 cursor-pointer transition-all"
                title="Láº¥y phÃ¢n cÃ´ng máº«u trong Lá»‹ch ná»n Ã¡p dá»¥ng sáºµn cho cáº£ tuáº§n"
              >
                <LayoutTemplate className="h-4 w-4 text-teal-700" />
                PhÃ¢n phÃ²ng theo lá»‹ch ná»n
              </button>
            )}

            {/* [QWEN3] NÃºt Xuáº¥t Excel Ma Tráº­n chuáº©n theo máº«u vÃ  Ä‘Ãºng thá»© tá»± sáº¯p xáº¿p */}
            <a
              href={`/api/export/room-matrix?week=${weekStart}${orderedPositionIds.length > 0 ? `&order=${encodeURIComponent(orderedPositionIds.join(","))}` : ""}`}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-950 hover:bg-emerald-100 shadow-xs active:scale-95 transition-all"
              title="Xuáº¥t file Excel ma tráº­n phÃ¢n phÃ²ng Ä‘Ãºng thá»© tá»± khu vá»±c vÃ  phÃ²ng hiá»‡n táº¡i"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
              Xuáº¥t Excel Ma Tráº­n
            </a>

            {/* NÃºt XÃ³a tráº¯ng */}
            {editable && (
              <button
                type="button"
                onClick={handleResetAllWeek}
                className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 shadow-xs cursor-pointer transition-all"
                title="XÃ³a toÃ n bá»™ phÃ¢n cÃ´ng cá»§a tuáº§n nÃ y Ä‘á»ƒ lÃ m láº¡i"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                XÃ³a tráº¯ng
              </button>
            )}

            {/* NÃºt LÆ°u tuáº§n */}
            {editable && (
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isPending || !hasUnsavedChanges}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-500 active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isPending ? "Äang lÆ°u..." : hasUnsavedChanges ? "LÆ°u phÃ¢n cÃ´ng tuáº§n" : "ÄÃ£ lÆ°u Ä‘áº§y Ä‘á»§"}
              </button>
            )}
          </div>
        </div>

        {/* ThÃ´ng bÃ¡o pháº£n há»“i */}
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
              âœ•
            </button>
          </div>
        )}
      </div>

      {viewMode === "staff-matrix" ? (
        /* CHáº¾ Äá»˜ XEM Tá»”NG Há»¢P THEO NHÃ‚N Sá»° */
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
        /* MA TRáº¬N PHÃ‚N PHÃ’NG THEO CA (PHÃ’NG Ã— BUá»”I/THá»¨) - CHUáº¨N MáºªU THá»°C Táº¾ */
        <div className="space-y-5">
          {/* 1. KHO THáºº NHÃ‚N VIÃŠN TRÃŠN CÃ™NG */}
          <StaffPalette
            staff={staff}
            staffCounts={staffWeekCounts}
            selectedStaffId={selectedStaffId}
            onSelectStaff={setSelectedStaffId}
            onDragStaffStart={() => {}}
            onDragStaffEnd={() => {}}
          />

          {/* 2. MA TRáº¬N PHÃ‚N PHÃ’NG THEO CA */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm xl:p-5">
            {/* Thanh tÃ¬m kiáº¿m phÃ²ng & Äáº·t láº¡i thá»© tá»± */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Ma Tráº­n PhÃ¢n PhÃ²ng Theo Ca</span>
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                    {orderedPositionIds.length} phÃ²ng â€¢ {areaGroups.length} khu vá»±c â€¢ {slots.length} ca
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  PhÃ¢n nhÃ³m theo khu vá»±c â€¢ Báº¥m nÃºt <strong>â†‘ / â†“</strong> Ä‘á»ƒ dá»i vá»‹ trÃ­ khu vá»±c vÃ  phÃ²ng â€¢ KÃ©o tháº» nhÃ¢n viÃªn Ä‘á»ƒ phÃ¢n cÃ´ng
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(customAreaOrder.length > 0 || Object.keys(customPosOrder).length > 0) && (
                  <button
                    type="button"
                    onClick={handleResetOrder}
                    className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                    title="KhÃ´i phá»¥c thá»© tá»± khu vá»±c vÃ  phÃ²ng vá» máº·c Ä‘á»‹nh ban Ä‘áº§u"
                  >
                    <RotateCcw className="h-3 w-3 text-slate-400" />
                    Äáº·t láº¡i thá»© tá»±
                  </button>
                )}

                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Lá»c phÃ²ng hoáº·c khu vá»±c..."
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Báº£ng Ma Tráº­n PhÃ²ng Ã— Buá»•i/Thá»© */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
              <table className="w-full min-w-[950px] border-collapse text-left text-xs">
                <thead>
                  {/* HÃ ng 1: TiÃªu Ä‘á» Cá»™t PhÃ²ng & CÃ¡c NgÃ y trong tuáº§n */}
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-800">
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-20 w-60 min-w-[220px] border-r border-slate-200 bg-slate-100 p-3 font-bold uppercase tracking-wider text-slate-800 shadow-xs"
                    >
                      Khu vá»±c / PhÃ²ng lÃ m viá»‡c
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

                  {/* HÃ ng 2: CÃ¡c ca (SÃ¡ng / Chiá»u) */}
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
                        {slot.shift === "morning" ? "SÃ¡ng" : "Chiá»u"}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {areaGroups.map((group, groupIndex) => {
                    return (
                      <tr key={`group-${group.areaName}`} className="contents">
                        {/* Thanh phÃ¢n chia Khu vá»±c cÃ³ nÃºt Dá»i vá»‹ trÃ­ lÃªn/xuá»‘ng */}
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
                                  Khu vá»±c: {group.areaName} ({group.positions.length} phÃ²ng)
                                </span>
                              </div>

                              {/* Cá»¥m nÃºt di chuyá»ƒn Khu vá»±c lÃªn/xuá»‘ng */}
                              {editable && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400 font-normal mr-1">Dá»i khu vá»±c:</span>
                                  <button
                                    type="button"
                                    disabled={groupIndex === 0}
                                    onClick={() => handleMoveArea(group.areaName, "up")}
                                    className="flex h-5 w-5 items-center justify-center rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                                    title={`Chuyá»ƒn khu vá»±c "${group.areaName}" lÃªn trÃªn`}
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={groupIndex === areaGroups.length - 1}
                                    onClick={() => handleMoveArea(group.areaName, "down")}
                                    className="flex h-5 w-5 items-center justify-center rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                                    title={`Chuyá»ƒn khu vá»±c "${group.areaName}" xuá»‘ng dÆ°á»›i`}
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Danh sÃ¡ch cÃ¡c phÃ²ng trong khu vá»±c */}
                        {group.positions.map((pos, posIndex) => {
                          return (
                            <tr
                              key={pos.id}
                              className={`hover:bg-slate-50/80 transition-colors ${group.style.lightBg}`}
                            >
                              {/* Cá»™t TÃªn phÃ²ng (Sticky bÃªn trÃ¡i) cÃ³ nÃºt Dá»i vá»‹ trÃ­ lÃªn/xuá»‘ng */}
                              <td className="sticky left-0 z-10 border-r border-b border-slate-200/90 bg-white/95 px-3 py-2 font-bold text-slate-900 shadow-xs">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate text-xs font-bold text-slate-900">{pos.name}</span>
                                      {pos.quota && pos.quota > 1 && (
                                        <span className="shrink-0 rounded-md bg-slate-100 px-1 py-0.2 text-[10px] text-slate-500 font-normal">
                                          ÄB: {pos.quota}
                                        </span>
                                      )}
                                    </div>
                                    {pos.description && (
                                      <span className="text-[10px] text-slate-400 font-normal block truncate">
                                        {pos.description}
                                      </span>
                                    )}
                                  </div>

                                  {/* Cá»¥m nÃºt di chuyá»ƒn phÃ²ng lÃªn/xuá»‘ng */}
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
                                        title={`Dá»i phÃ²ng "${pos.name}" lÃªn trÃªn`}
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
                                        title={`Dá»i phÃ²ng "${pos.name}" xuá»‘ng dÆ°á»›i`}
                                      >
                                        <ArrowDown className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* CÃ¡c Ã´ buá»•i/thá»© cho phÃ²ng nÃ y */}
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

                  {/* [QWEN3] DÃ’NG PHÃ‰P á»ž CUá»I Báº¢NG (MÃ€U CAM NHáº T CHUáº¨N MáºªU THá»°C Táº¾) */}
                  <tr className="border-t-2 border-amber-300 bg-amber-50/90 font-semibold">
                    <td className="sticky left-0 z-10 border-r border-b border-amber-300 bg-amber-100/90 px-3 py-3 font-bold text-amber-950 shadow-xs">
                      <div className="flex items-center gap-1.5">
                        <CalendarX2 className="h-4 w-4 text-amber-700" />
                        <span>PhÃ©p</span>
                      </div>
                    </td>

                    {/* Tá»± Ä‘á»™ng gÃ¡n nhÃ¢n viÃªn Ä‘Äƒng kÃ½ phÃ©p vÃ o tá»«ng buá»•i/thá»©, kÃ¨m ghi chÃº táº¯t lÃ½ do nghá»‰ */}
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
                                    title={`${person.name} (${person.code || "NV"}) - LÃ½ do: ${leave.reason} ${leave.note ? `(${leave.note})` : ""}`}
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

      {/* POPUP Cáº¢NH BÃO NGHá»ˆ PHÃ‰P */}
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
