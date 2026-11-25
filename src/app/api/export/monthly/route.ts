import { NextRequest } from "next/server";
import { getMonthKey } from "@/lib/date";
import { getAppData, getEffectiveLeaveRequests } from "@/lib/repository";
import { buildMonthlyTimesheet } from "@/lib/schedule";
import { generateMonthlyTimesheetExcelBuffer } from "@/lib/monthly-timesheet-excel";

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  const monthKey = getMonthKey(month);
  const data = await getAppData();

  const timesheet = buildMonthlyTimesheet(
    data.weeklySchedule,
    getEffectiveLeaveRequests(data),
    data.staff,
    data.positions,
    data.scheduleRules,
    data.positionRules,
    monthKey,
    data.holidays
  );

  const buffer = await generateMonthlyTimesheetExcelBuffer({
    monthKey,
    timesheet,
    holidays: data.holidays,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bao-cao-thang-${monthKey}.xlsx"`,
    },
  });
}

