import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getWeekStartFromInput } from "@/lib/date";
import { getAppData } from "@/lib/repository";
import { buildAssignmentsFromTemplate, getWeeklyAssignments } from "@/lib/schedule";

export async function GET(request: NextRequest) {
  const weekStart = getWeekStartFromInput(request.nextUrl.searchParams.get("week"));
  const data = await getAppData();
  const actualAssignments = getWeeklyAssignments(data.weeklySchedule, weekStart);
  const assignments =
    actualAssignments.length > 0
      ? actualAssignments
      : buildAssignmentsFromTemplate(
          data.templateSchedule,
          weekStart,
          data.leaveRequests,
          data.scheduleRules,
        );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Codex";
  workbook.created = new Date();

  const scheduleSheet = workbook.addWorksheet("Lich Tuan");
  scheduleSheet.columns = [
    { header: "Ngay", key: "date", width: 14 },
    { header: "Ca", key: "shift", width: 12 },
    { header: "Vi tri", key: "position", width: 28 },
    { header: "Dieu duong", key: "staff", width: 28 },
    { header: "Trang thai", key: "status", width: 16 },
    { header: "Nguon", key: "source", width: 14 },
    { header: "Ghi chu", key: "note", width: 36 },
  ];

  assignments.forEach((assignment) => {
    const person = data.staff.find((item) => item.id === assignment.staffId);
    const position = data.positions.find((item) => item.id === assignment.positionId);
    scheduleSheet.addRow({
      date: assignment.date,
      shift: assignment.shift,
      position: position?.name ?? assignment.positionId,
      staff: person?.name ?? assignment.staffId,
      status: assignment.status,
      source: assignment.source,
      note: assignment.note ?? "",
    });
  });

  scheduleSheet.getRow(1).font = { bold: true };
  scheduleSheet.views = [{ state: "frozen", ySplit: 1 }];

  const leaveSheet = workbook.addWorksheet("Nghi Phep");
  leaveSheet.columns = [
    { header: "Nhan su", key: "staff", width: 28 },
    { header: "Ngay", key: "date", width: 14 },
    { header: "Ca nghi", key: "shift", width: 14 },
    { header: "Ly do", key: "reason", width: 14 },
    { header: "Ghi chu", key: "note", width: 32 },
  ];

  data.leaveRequests
    .filter((leave) => leave.date >= weekStart)
    .filter((leave) => leave.date <= assignments[assignments.length - 1]?.date)
    .forEach((leave) => {
      const person = data.staff.find((item) => item.id === leave.staffId);
      leaveSheet.addRow({
        staff: person?.name ?? leave.staffId,
        date: leave.date,
        shift: leave.shift,
        reason: leave.reason,
        note: leave.note ?? "",
      });
    });

  leaveSheet.getRow(1).font = { bold: true };
  leaveSheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nurse-schedule-${weekStart}.xlsx"`,
    },
  });
}
