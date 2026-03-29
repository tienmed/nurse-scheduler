import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getMonthBounds, getMonthKey } from "@/lib/date";
import { getAppData } from "@/lib/repository";
import { calculateMonthlyLeaves, calculateMonthlyWorkload } from "@/lib/schedule";

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  const monthKey = getMonthKey(month);
  const { start, end } = getMonthBounds(monthKey);
  const data = await getAppData();

  const workload = calculateMonthlyWorkload(data.weeklySchedule, monthKey).sort(
    (left, right) => right.shifts - left.shifts,
  );
  const leaves = calculateMonthlyLeaves(data.leaveRequests, monthKey).sort(
    (left, right) => right.days - left.days,
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NurseFlow";
  workbook.created = new Date();

  // Sheet 1: Tổng hợp công việc
  const workloadSheet = workbook.addWorksheet("Tong Hop Cong Viec");
  workloadSheet.columns = [
    { header: "Nhan su", key: "name", width: 28 },
    { header: "Ma NV", key: "code", width: 12 },
    { header: "Ngay lam", key: "workDays", width: 12 },
    { header: "Ca sang", key: "morning", width: 12 },
    { header: "Ca chieu", key: "afternoon", width: 12 },
    { header: "Tang ca", key: "overtime", width: 12 },
    { header: "Tong ca", key: "total", width: 12 },
  ];

  workload.forEach((item) => {
    const person = data.staff.find((s) => s.id === item.staffId);
    workloadSheet.addRow({
      name: person?.name ?? item.staffId,
      code: person?.code ?? "",
      workDays: item.workDays,
      morning: item.morningShifts,
      afternoon: item.afternoonShifts,
      overtime: item.overtimeShifts,
      total: item.shifts,
    });
  });

  workloadSheet.getRow(1).font = { bold: true };

  // Sheet 2: Tổng hợp nghỉ phép
  const leaveSheet = workbook.addWorksheet("Tong Hop Nghi Phep");
  leaveSheet.columns = [
    { header: "Nhan su", key: "name", width: 28 },
    { header: "Ngay nghi", key: "days", width: 12 },
    { header: "Phep", key: "phep", width: 10 },
    { header: "Om", key: "om", width: 10 },
    { header: "Di hoc", key: "dihoc", width: 10 },
    { header: "Khac", key: "khac", width: 10 },
  ];

  leaves.forEach((item) => {
    const person = data.staff.find((s) => s.id === item.staffId);
    leaveSheet.addRow({
      name: person?.name ?? item.staffId,
      days: item.days,
      phep: item.phep,
      om: item.om,
      dihoc: item.dihoc,
      khac: item.khac,
    });
  });

  leaveSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bao-cao-thang-${monthKey}.xlsx"`,
    },
  });
}
