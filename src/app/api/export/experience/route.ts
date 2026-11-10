import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAppData } from "@/lib/repository";
import { calculatePositionExperienceStats } from "@/lib/schedule";
import { getMonthKey } from "@/lib/date";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get("month");
    const scope = searchParams.get("scope") || "all"; // "month" hoặc "all"

    const data = await getAppData();
    const activeStaff = data.staff.filter((s) => s.active);
    const positions = data.positions;

    const filterMonth = scope === "month" && month ? getMonthKey(month) : undefined;
    const stats = calculatePositionExperienceStats(
      data.weeklySchedule,
      activeStaff,
      positions,
      filterMonth,
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "NurseFlow [QWEN3]";
    workbook.created = new Date();

    const sheetName = filterMonth ? `Tich_Luy_${filterMonth}` : "Tich_Luy_Toan_Bo";
    const sheet = workbook.addWorksheet(sheetName);

    // Tiêu đề báo cáo
    sheet.mergeCells("A1", `${String.fromCharCode(65 + positions.length + 3)}1`);
    const titleCell = sheet.getCell("A1");
    titleCell.value = `BẢNG TỔNG HỢP TÍCH LŨY KINH NGHIỆM & CHUYÊN MÔN THEO VỊ TRÍ VIỆC LÀM (${filterMonth ? "Tháng " + filterMonth : "Toàn bộ lịch sử"})`;
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "0D9488" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 32;

    // Ghi chú quy chuẩn
    sheet.mergeCells("A2", `${String.fromCharCode(65 + positions.length + 3)}2`);
    const noteCell = sheet.getCell("A2");
    noteCell.value = "* Quy chuẩn: 1 ca trực hoàn thành = 4 giờ làm việc chuyên môn; nếu kiêm nhiệm n vị trí trong 1 ca thì 4 giờ chia đều (mỗi vị trí nhận 4/n giờ). Đơn vị hiển thị: Số ca (Số giờ).";
    noteCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "64748B" } };
    noteCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 20;

    // Header bảng
    const headerRow = [
      "Mã NV",
      "Họ và tên",
      ...positions.map((p) => p.name),
      "Tổng số ca",
      "Tổng số giờ (h)",
      "Vị trí nòng cốt",
    ];

    const hRow = sheet.addRow(headerRow);
    hRow.height = 28;
    hRow.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFF" } };
    hRow.alignment = { horizontal: "center", vertical: "middle" };

    // Định dạng màu nền Header Teal
    for (let col = 1; col <= headerRow.length; col++) {
      const cell = hRow.getCell(col);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "0D9488" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "E2E8F0" } },
        bottom: { style: "thin", color: { argb: "E2E8F0" } },
        left: { style: "thin", color: { argb: "E2E8F0" } },
        right: { style: "thin", color: { argb: "E2E8F0" } },
      };
    }

    // Ghi dữ liệu từng nhân sự
    for (const item of stats) {
      const rowData = [
        item.staffCode || "",
        item.staffName,
        ...positions.map((p) => {
          const exp = item.positions[p.id];
          return exp && exp.shifts > 0
            ? `${exp.shifts} ca (${exp.hours % 1 === 0 ? exp.hours : exp.hours.toFixed(1)}h)`
            : "-";
        }),
        item.totalShifts,
        item.totalHours % 1 === 0 ? item.totalHours : Number(item.totalHours.toFixed(1)),
        item.topPosition
          ? `${item.topPosition.name} (${item.topPosition.hours % 1 === 0 ? item.topPosition.hours : item.topPosition.hours.toFixed(1)}h)`
          : "Chưa có",
      ];

      const r = sheet.addRow(rowData);
      r.height = 22;
      r.font = { name: "Arial", size: 10 };
      r.alignment = { vertical: "middle" };

      // Căn giữa mã NV và các cột số liệu
      r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      for (let col = 3; col <= headerRow.length; col++) {
        r.getCell(col).alignment = { horizontal: "center", vertical: "middle" };
      }

      // Tô viền
      for (let col = 1; col <= headerRow.length; col++) {
        r.getCell(col).border = {
          top: { style: "thin", color: { argb: "CBD5E1" } },
          bottom: { style: "thin", color: { argb: "CBD5E1" } },
          left: { style: "thin", color: { argb: "CBD5E1" } },
          right: { style: "thin", color: { argb: "CBD5E1" } },
        };
      }
    }

    // Tự động điều chỉnh độ rộng cột
    sheet.columns.forEach((column, index) => {
      if (index === 0) column.width = 12; // Mã NV
      else if (index === 1) column.width = 24; // Họ tên
      else if (index >= 2 && index < 2 + positions.length) column.width = 18; // Từng vị trí
      else column.width = 20; // Tổng kết
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = filterMonth
      ? `Bang_Tich_Luy_Chuyen_Mon_${filterMonth}.xlsx`
      : `Bang_Tich_Luy_Chuyen_Mon_Toan_Bo.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Lỗi xuất Excel tích lũy chuyên môn:", error);
    return NextResponse.json(
      { error: "Không thể tạo file Excel thống kê tích lũy chuyên môn: " + error.message },
      { status: 500 },
    );
  }
}
