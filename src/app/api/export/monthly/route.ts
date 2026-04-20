import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getMonthBounds, getMonthKey } from "@/lib/date";
import { getAppData } from "@/lib/repository";
import { buildMonthlyTimesheet } from "@/lib/schedule";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  const monthKey = getMonthKey(month);
  const { start, end } = getMonthBounds(monthKey);
  const data = await getAppData();

  const startDate = parseISO(start);
  const daysCount = differenceInCalendarDays(parseISO(end), startDate) + 1;
  const daysOfWeek = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const { isOffDay } = require("@/lib/date");
  const daysArray = Array.from({ length: daysCount }).map((_, i) => {
    const d = addDays(startDate, i);
    const dateStr = format(d, "yyyy-MM-dd");
    return {
      dateStr,
      label: format(d, "dd/MM"),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isOffDay: isOffDay(dateStr, "morning", data.holidays) || isOffDay(dateStr, "afternoon", data.holidays),
      dow: daysOfWeek[d.getDay()],
    };
  });

  const timesheet = buildMonthlyTimesheet(
    data.weeklySchedule,
    data.leaveRequests,
    data.staff,
    data.positions,
    data.scheduleRules,
    data.positionRules,
    monthKey,
    data.holidays
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NurseFlow";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Cham Cong ${monthKey}`);

  // Dựng Row 1: Nhân viên + Thứ + Tổng
  const row1 = ["Nhân viên"];
  daysArray.forEach(d => {
    row1.push(d.dow);
    row1.push(""); // Dành cho ô Chiều khi merge
  });
  row1.push("Σ Ngày làm", "Σ Phép", "Σ Tăng ca");
  sheet.addRow(row1);

  // Dựng Row 2: Ngày
  const row2 = [""];
  daysArray.forEach(d => {
    row2.push(d.label);
    row2.push("");
  });
  row2.push("", "", "");
  sheet.addRow(row2);

  // Dựng Row 3: Sáng (S) | Chiều (C)
  const row3 = [""];
  daysArray.forEach(() => {
    row3.push("S", "C");
  });
  row3.push("", "", "");
  sheet.addRow(row3);

  // Merge Headers
  sheet.mergeCells("A1:A3"); // Nhân viên

  let colIndex = 2; // Bắt đầu từ cột B
  daysArray.forEach(() => {
    sheet.mergeCells(1, colIndex, 1, colIndex + 1); // Row 1, Col N to N+1
    sheet.mergeCells(2, colIndex, 2, colIndex + 1); // Row 2, Col N to N+1
    colIndex += 2;
  });

  // Merge Totals
  sheet.mergeCells(1, colIndex, 3, colIndex);
  sheet.mergeCells(1, colIndex + 1, 3, colIndex + 1);
  sheet.mergeCells(1, colIndex + 2, 3, colIndex + 2);

  // Dựng Data
  timesheet.forEach(row => {
    const dataRow = [row.name];
    daysArray.forEach(day => {
      const d = row.days[day.dateStr];
      dataRow.push(d?.morning || "");
      dataRow.push(d?.afternoon || "");
    });

    dataRow.push(row.totalWork > 0 ? String(row.totalWork / 2) : "0");

    // Ghi Tổng Phép
    const leaves = [];
    if (row.totalLeaveP > 0) leaves.push(`P: ${row.totalLeaveP / 2}`);
    if (row.totalLeaveH > 0) leaves.push(`H: ${row.totalLeaveH / 2}`);
    if (row.totalLeaveO > 0) leaves.push(`O: ${row.totalLeaveO / 2}`);
    dataRow.push(leaves.length > 0 ? leaves.join("\n") : "0");

    dataRow.push(row.totalOvertime > 0 ? String(row.totalOvertime / 2) : "0");

    const addedRow = sheet.addRow(dataRow);

    // Wrap text cho cột Phép nếu có nhiều dòng
    addedRow.getCell(colIndex + 1).alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
  });

  // Style Headers & Cells
  sheet.getColumn(1).width = 25; // Nhân viên
  sheet.getColumn(colIndex).width = 12;      // Σ Ngày làm
  sheet.getColumn(colIndex + 1).width = 15;  // Σ Phép
  sheet.getColumn(colIndex + 2).width = 12;  // Σ Tăng ca

  // Style cho các cột ngày S và C
  for (let c = 2; c < colIndex; c++) {
    sheet.getColumn(c).width = 4;
  }

  // Khung viền và căn giữa
  sheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      // Header styles
      if (rowNumber <= 3) {
        cell.font = { bold: true, color: { argb: "FF333333" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0F4F8" },
        };
      } else {
        // Data styles
        if (colNumber > 1) {
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        } else {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        }

        // Background cho dòng ngày nghỉ cuối tuần
        if (colNumber > 1 && colNumber < colIndex) {
          const dayIndex = Math.floor((colNumber - 2) / 2);
          if (daysArray[dayIndex]?.isOffDay) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFFAF0" },
            };
          }
        }

        // Màu sắc cho ký hiệu
        const val = cell.value;
        if (val === "✔") cell.font = { color: { argb: "FF0D9488" }, bold: true };
        else if (val === "T") cell.font = { color: { argb: "FFD97706" }, bold: true };
        else if (val === "P") cell.font = { color: { argb: "FF475569" }, bold: true };
        else if (val === "H") cell.font = { color: { argb: "FF4338CA" }, bold: true };
        else if (val === "O") cell.font = { color: { argb: "FFE11D48" }, bold: true };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bao-cao-thang-${monthKey}.xlsx"`,
    },
  });
}
