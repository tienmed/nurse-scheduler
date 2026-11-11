import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addDays, format, isValid, parseISO } from "date-fns";
import {
  generateWeekIfEmpty,
  getAppData,
  invalidateAppDataCache,
  writeAppDataKeysToSheets,
} from "@/lib/repository";
import { verifyScheduleConfirmToken } from "@/lib/schedule-confirm-token";

export const dynamic = "force-dynamic";

function renderConfirmResultHtml(options: {
  title: string;
  subtitle: string;
  status: "success" | "warning" | "error";
  weekStart?: string;
  detailsHtml?: string;
}) {
  const { title, subtitle, status, weekStart, detailsHtml } = options;

  let headerGradient = "linear-gradient(135deg, #0d9488 0%, #059669 100%)";
  let iconHtml = "✅";
  if (status === "warning") {
    headerGradient = "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)";
    iconHtml = "ℹ️";
  } else if (status === "error") {
    headerGradient = "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)";
    iconHtml = "❌";
  }

  const boardHref = weekStart ? `/room-assignment?week=${encodeURIComponent(weekStart)}` : "/room-assignment";

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | NurseFlow</title>
  <style>
    body {
      margin: 0;
      padding: 24px 16px;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .card {
      width: 100%;
      max-width: 560px;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: ${headerGradient};
      padding: 30px 26px;
      text-align: center;
      color: #ffffff;
    }
    .icon { font-size: 42px; margin-bottom: 10px; line-height: 1; }
    .title { font-size: 21px; font-weight: 700; margin: 0 0 8px 0; }
    .subtitle { font-size: 14px; opacity: 0.94; margin: 0; line-height: 1.5; }
    .body { padding: 24px 26px; }
    .notice {
      background-color: #f0fdfa;
      border-left: 4px solid #0d9488;
      border-radius: 8px;
      padding: 14px 16px;
      font-size: 13px;
      color: #115e59;
      line-height: 1.55;
      margin-bottom: 20px;
    }
    .btn {
      display: block;
      text-align: center;
      background: #0f766e;
      color: #ffffff;
      text-decoration: none;
      padding: 13px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon">${iconHtml}</div>
      <h1 class="title">${title}</h1>
      <p class="subtitle">${subtitle}</p>
    </div>
    <div class="body">
      ${detailsHtml || ""}
      <a href="${boardHref}" class="btn">Mở Bảng Phân Phòng Tuần Này &rarr;</a>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Xác nhận 1 chạm từ email sáng Chủ Nhật để chốt lịch tuần sau thành Chính thức (published).
 */
export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("week")?.trim() || "";
  const token = request.nextUrl.searchParams.get("token")?.trim() || "";

  const parsedWeek = parseISO(weekStart);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !isValid(parsedWeek)) {
    return renderConfirmResultHtml({
      title: "Tham số tuần không hợp lệ",
      subtitle: "Liên kết xác nhận không chứa ngày đầu tuần hợp lệ.",
      status: "error",
    });
  }

  let tokenValid = false;
  try {
    tokenValid = verifyScheduleConfirmToken(weekStart, token);
  } catch (err) {
    return renderConfirmResultHtml({
      title: "Lỗi cấu hình xác thực",
      subtitle: err instanceof Error ? err.message : "Thiếu khóa AUTH_SECRET.",
      status: "error",
      weekStart,
    });
  }

  if (!tokenValid) {
    return renderConfirmResultHtml({
      title: "Liên kết xác nhận không hợp lệ",
      subtitle: "Mã xác thực không khớp hoặc liên kết đã bị chỉnh sửa.",
      status: "error",
      weekStart,
    });
  }

  try {
    await generateWeekIfEmpty(weekStart);
    const data = await getAppData();
    const weekEntries = data.weeklySchedule.filter((item) => item.weekStart === weekStart);
    const weekRange = `${format(parsedWeek, "dd/MM/yyyy")} – ${format(addDays(parsedWeek, 5), "dd/MM/yyyy")}`;

    if (weekEntries.length === 0) {
      return renderConfirmResultHtml({
        title: "Chưa có dữ liệu lịch tuần",
        subtitle: `Không tìm thấy phân công nào cho tuần ${weekRange}.`,
        status: "warning",
        weekStart,
      });
    }

    const alreadyPublished = weekEntries.every((item) => item.status === "published");
    if (alreadyPublished) {
      return renderConfirmResultHtml({
        title: "Lịch tuần đã được chốt trước đó",
        subtitle: `Lịch phân phòng tuần ${weekRange} đang ở trạng thái Chính thức trên hệ thống.`,
        status: "warning",
        weekStart,
        detailsHtml: `<div class="notice"><strong>Không ghi đè lại:</strong> Toàn bộ ${weekEntries.length} lượt phân công của tuần ${weekRange} đã được chốt chính thức trước đó.</div>`,
      });
    }

    data.weeklySchedule = data.weeklySchedule.map((item) =>
      item.weekStart === weekStart
        ? { ...item, status: "published" as const }
        : item,
    );

    await writeAppDataKeysToSheets(data, ["weeklySchedule"]);
    invalidateAppDataCache();

    ["/", "/schedule", "/board", "/room-assignment", "/dang-ky-phep"].forEach((p) => {
      revalidatePath(p);
    });

    const confirmedAt = format(
      new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })),
      "HH:mm dd/MM/yyyy",
    );

    return renderConfirmResultHtml({
      title: "Đã chốt lịch tuần chính thức!",
      subtitle: `Toàn bộ phân công tuần ${weekRange} đã được xác nhận chính thức trên Google Sheets.`,
      status: "success",
      weekStart,
      detailsHtml: `
        <div class="notice">
          <strong>Thời gian xác nhận:</strong> ${confirmedAt}<br>
          <strong>Tổng lượt phân công đã chốt:</strong> ${weekEntries.length} lượt (Trạng thái: Chính thức).
        </div>
      `,
    });
  } catch (error) {
    console.error("🚨 [ScheduleConfirmRoute] Lỗi khi chốt lịch tuần:", error);
    return renderConfirmResultHtml({
      title: "Lỗi khi chốt lịch chính thức",
      subtitle: error instanceof Error ? error.message : "Không thể cập nhật dữ liệu lên Google Sheets.",
      status: "error",
      weekStart,
    });
  }
}
