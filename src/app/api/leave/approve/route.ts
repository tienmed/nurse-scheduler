import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { LEAVE_SHIFT_LABELS } from "@/lib/constants";
import { getAppData, invalidateAppDataCache, writeAppDataKeysToSheets } from "@/lib/repository";
import { sendLeaveApprovedNotificationEmail, getUpcoming7DaysApprovedLeaves } from "@/lib/email-service";

export const dynamic = "force-dynamic";

function renderResultHtml(options: {
  title: string;
  subtitle: string;
  status: "success" | "warning" | "error";
  detailsHtml?: string;
  noticeHtml?: string;
}) {
  const { title, subtitle, status, detailsHtml, noticeHtml } = options;

  let headerGradient = "linear-gradient(135deg, #059669 0%, #10b981 100%)";
  let iconHtml = "✅";

  if (status === "warning") {
    headerGradient = "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)";
    iconHtml = "ℹ️";
  } else if (status === "error") {
    headerGradient = "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)";
    iconHtml = "❌";
  }

  const html = `
    <!DOCTYPE html>
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
          max-width: 580px;
          background: #ffffff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          border: 1px solid #e2e8f0;
        }
        .header {
          background: ${headerGradient};
          padding: 32px 28px;
          text-align: center;
          color: #ffffff;
        }
        .icon {
          font-size: 42px;
          margin-bottom: 12px;
          line-height: 1;
        }
        .title {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 8px 0;
        }
        .subtitle {
          font-size: 14px;
          opacity: 0.92;
          margin: 0;
          line-height: 1.5;
        }
        .body {
          padding: 28px;
        }
        .details-box {
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th, td {
          padding: 10px 14px;
          text-align: left;
        }
        th {
          background-color: #f1f5f9;
          color: #475569;
          font-weight: 600;
          border-bottom: 1px solid #e2e8f0;
        }
        td {
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
        }
        .notice {
          background-color: #eff6ff;
          border-left: 4px solid #3b82f6;
          border-radius: 8px;
          padding: 14px 16px;
          font-size: 13px;
          color: #1e40af;
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .footer-btn {
          display: block;
          text-align: center;
          background: #0f172a;
          color: #ffffff;
          text-decoration: none;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          transition: background 0.2s;
        }
        .footer-btn:hover {
          background: #1e293b;
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
          ${noticeHtml || ""}
          <a href="/dang-ky-phep" class="footer-btn">Vào cổng thông tin đăng ký & Xem lịch</a>
        </div>
      </div>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * [QWEN3] Route xử lý Duyệt 1 chạm từ Email gửi tới tienmed@gmail.com
 * Khi người duyệt bấm link trong email, route này cập nhật trạng thái
 * thành approved, đồng bộ Google Sheets, và gửi email phản hồi (BCC ĐD Nghĩa)
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();

  if (!token) {
    return renderResultHtml({
      title: "Thiếu mã xác thực",
      subtitle: "Liên kết duyệt không hợp lệ vì không có mã token xác thực.",
      status: "error",
      noticeHtml: `<div class="notice">Vui lòng kiểm tra lại đường dẫn trong email được gửi từ hệ thống NurseFlow.</div>`,
    });
  }

  try {
    const data = await getAppData();
    const matchingLeaves = data.leaveRequests.filter((l) => l.approveToken === token);

    if (matchingLeaves.length === 0) {
      return renderResultHtml({
        title: "Không tìm thấy đơn nghỉ phép",
        subtitle: "Không tìm thấy đơn nghỉ phép nào tương ứng với mã duyệt này, hoặc đơn đã bị xóa.",
        status: "error",
      });
    }

    let staff = data.staff.find((s) => s.id === matchingLeaves[0].staffId);
    if (!staff && matchingLeaves[0].staffId === "staff-admin-demo") {
      staff = {
        id: "staff-admin-demo",
        name: "Quản trị viên (Demo)",
        code: "ADMIN",
        email: "admin@nurseflow.local",
        role: "admin",
        positionIds: [],
        active: true,
        prefersOvertime: false,
      };
    }
    const staffName = staff?.name || matchingLeaves[0].staffId;

    // Kiểm tra nếu tất cả đã được duyệt trước đó
    const allApproved = matchingLeaves.every((l) => l.status === "approved");
    if (allApproved) {
      const rowsHtml = matchingLeaves
        .map((l) => {
          let dateStr = l.date;
          try {
            dateStr = format(parseISO(l.date), "dd/MM/yyyy (EEEE)", { locale: vi });
          } catch {}
          return `<tr><td>${dateStr}</td><td>${LEAVE_SHIFT_LABELS[l.shift] || l.shift}</td><td><span style="color:#059669;font-weight:bold;">Đã duyệt trước đó</span></td></tr>`;
        })
        .join("");

      return renderResultHtml({
        title: "Đơn đã được duyệt trước đó",
        subtitle: `Phiếu xin nghỉ phép của Điều dưỡng ${staffName} đã được phê duyệt chính thức trước đó.`,
        status: "warning",
        detailsHtml: `
          <div class="details-box">
            <table>
              <thead><tr><th>Ngày</th><th>Buổi</th><th>Trạng thái</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `,
      });
    }

    // Cập nhật trạng thái thành approved
    matchingLeaves.forEach((leave) => {
      leave.status = "approved";
    });

    // Cập nhật lại trong data.leaveRequests
    const matchingIds = new Set(matchingLeaves.map((l) => l.id));
    data.leaveRequests = data.leaveRequests.map((l) => {
      if (matchingIds.has(l.id)) {
        return { ...l, status: "approved" };
      }
      return l;
    });

    // Ghi nhận chính thức vào Google Sheets
    await writeAppDataKeysToSheets(data, ["leaveRequests"]);
    invalidateAppDataCache();

    // Revalidate paths
    ["/", "/schedule", "/leave", "/dang-ky-phep", "/reports"].forEach((p) => {
      revalidatePath(p);
    });

    // Gửi email phản hồi cho người xin nghỉ (BCC tới ĐD Nghĩa)
    if (staff?.email) {
      const emailItems = matchingLeaves.map((l) => ({
        date: l.date,
        shift: l.shift,
        reason: l.reason,
        note: l.note,
      }));

      const upcoming7DaysLeaves = getUpcoming7DaysApprovedLeaves(data.leaveRequests, data.staff);

      sendLeaveApprovedNotificationEmail({
        staff,
        leaveItems: emailItems,
        upcoming7DaysLeaves,
      }).catch((err) => {
        console.error("🚨 [ApproveRoute] Lỗi gửi email phản hồi sau duyệt:", err);
      });
    }

    // Render kết quả thành công
    const rowsHtml = matchingLeaves
      .map((l) => {
        let dateStr = l.date;
        try {
          dateStr = format(parseISO(l.date), "dd/MM/yyyy (EEEE)", { locale: vi });
        } catch {}
        return `<tr><td style="font-weight:600;">${dateStr}</td><td>${LEAVE_SHIFT_LABELS[l.shift] || l.shift}</td><td style="color:#059669;font-weight:bold;">✅ Đã duyệt thành công</td></tr>`;
      })
      .join("");

    return renderResultHtml({
      title: "Phê duyệt thành công! ✅",
      subtitle: `Bạn đã duyệt chính thức ${matchingLeaves.length} ca nghỉ phép cho Điều dưỡng ${staffName}.`,
      status: "success",
      detailsHtml: `
        <div class="details-box">
          <table>
            <thead><tr><th>Ngày</th><th>Buổi</th><th>Kết quả</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `,
      noticeHtml: `
        <div class="notice">
          <strong>Đã gửi email xác nhận:</strong> Hệ thống đã tự động gửi email thông báo xác thực đồng ý tới Điều dưỡng <strong>${staffName}</strong> kèm lời nhắc làm phiếu giấy theo quy định, đồng thời gửi BCC tới <strong>ĐD Nghĩa</strong> (nghiadn.pk@pnt.edu.vn).
        </div>
      `,
    });
  } catch (error: any) {
    console.error("🚨 [ApproveRoute] Lỗi khi xử lý duyệt:", error);
    return renderResultHtml({
      title: "Lỗi xử lý duyệt đơn",
      subtitle: error instanceof Error ? error.message : "Đã có lỗi xảy ra trong quá trình ghi dữ liệu.",
      status: "error",
    });
  }
}
