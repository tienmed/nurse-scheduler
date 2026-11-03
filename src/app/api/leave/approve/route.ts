import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { LEAVE_SHIFT_LABELS } from "@/lib/constants";
import { getAppData, invalidateAppDataCache, writeAppDataKeysToSheets } from "@/lib/repository";
import { sendLeaveApprovedNotificationEmail, getUpcoming7DaysApprovedLeaves } from "@/lib/email-service";
import type { LeaveShift, LeaveRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

function isShiftConflictOrSame(s1: LeaveShift, s2: LeaveShift): boolean {
  if (s1 === "full-day" || s2 === "full-day") return true;
  return s1 === s2;
}

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
 * Rà soát kỹ lưỡng lịch đăng ký nghỉ phép:
 * - Nếu lịch đã có và đã được duyệt trước đó -> Thông báo đã duyệt và TUYỆT ĐỐI KHÔNG GỬI LẠI EMAIL.
 * - Nếu có ca mới chưa duyệt -> Cập nhật Google Sheets và chỉ gửi email xác thực cho các ca mới được duyệt.
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

    // [QWEN3] RÀ SOÁT LẠI TOÀN BỘ LỊCH ĐĂNG KÝ NGHỈ PHÉP TRONG HỆ THỐNG
    // Lấy các ca khác của nhân sự này đã được duyệt từ trước
    const otherApprovedLeaves = data.leaveRequests.filter(
      (l) =>
        l.staffId === matchingLeaves[0].staffId &&
        l.status === "approved" &&
        !matchingLeaves.some((m) => m.id === l.id),
    );

    const alreadyApprovedSlots: LeaveRecord[] = [];
    const newlyApprovedSlots: LeaveRecord[] = [];

    for (const m of matchingLeaves) {
      // 1. Nếu chính ca này đã ở trạng thái approved (bấm lại link duyệt lần 2)
      if (m.status === "approved") {
        alreadyApprovedSlots.push(m);
        continue;
      }

      // 2. Nếu đã có một ca khác của cùng nhân sự vào ngày đó đã được duyệt chính thức trước đó
      const hasPriorApproved = otherApprovedLeaves.some(
        (prior) => prior.date === m.date && isShiftConflictOrSame(prior.shift, m.shift),
      );

      if (hasPriorApproved) {
        alreadyApprovedSlots.push(m);
      } else {
        newlyApprovedSlots.push(m);
      }
    }

    // KỊCH BẢN 1: TẤT CẢ CÁC CA ĐÃ CÓ TRÊN LỊCH VÀ ĐÃ ĐƯỢC PHÊ DUYỆT TRƯỚC ĐÓ
    // -> Báo đã duyệt và TUYỆT ĐỐI KHÔNG GỬI EMAIL
    if (newlyApprovedSlots.length === 0) {
      // Đồng bộ trạng thái các bản ghi trong phiếu hiện tại thành approved (nếu còn pending)
      let hasUpdate = false;
      matchingLeaves.forEach((l) => {
        if (l.status !== "approved") {
          l.status = "approved";
          hasUpdate = true;
        }
      });

      if (hasUpdate) {
        await writeAppDataKeysToSheets(data, ["leaveRequests"]);
        invalidateAppDataCache();
      }

      const rowsHtml = matchingLeaves
        .map((l) => {
          let dateStr = l.date;
          try {
            dateStr = format(parseISO(l.date), "dd/MM/yyyy (EEEE)", { locale: vi });
          } catch {}
          return `
            <tr>
              <td style="font-weight:600;">${dateStr}</td>
              <td>${LEAVE_SHIFT_LABELS[l.shift] || l.shift}</td>
              <td><span style="color:#059669;font-weight:bold;">✓ Đã được phê duyệt trước đó</span></td>
            </tr>
          `;
        })
        .join("");

      return renderResultHtml({
        title: "Lịch nghỉ đã được duyệt trước đó",
        subtitle: `Lịch đăng ký nghỉ phép của Điều dưỡng ${staffName} đã có trên hệ thống và đã được phê duyệt từ trước.`,
        status: "warning",
        detailsHtml: `
          <div class="details-box">
            <table>
              <thead><tr><th>Ngày</th><th>Buổi</th><th>Trạng thái lịch</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `,
        noticeHtml: `
          <div class="notice">
            <strong>Không gửi lại email:</strong> Do các ca nghỉ này đã có trên lịch và đã được xác nhận trước đó, hệ thống giữ nguyên trạng thái và không gửi lại email thông báo để tránh trùng lặp.
          </div>
        `,
      });
    }

    // KỊCH BẢN 2: CÓ CA MỚI CẦN DUYỆT CHÍNH THỨC
    // Cập nhật trạng thái thành approved
    matchingLeaves.forEach((leave) => {
      leave.status = "approved";
    });

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

    // [QWEN3] Chỉ gửi email phản hồi đối với những ca MỚI ĐƯỢC DUYỆT THỰC SỰ
    if (staff?.email && newlyApprovedSlots.length > 0) {
      const emailItems = newlyApprovedSlots.map((l) => ({
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

    // Render kết quả duyệt thành công
    const rowsHtml = matchingLeaves
      .map((l) => {
        let dateStr = l.date;
        try {
          dateStr = format(parseISO(l.date), "dd/MM/yyyy (EEEE)", { locale: vi });
        } catch {}

        const isNewly = newlyApprovedSlots.some((ns) => ns.id === l.id);
        const statusBadge = isNewly
          ? `<span style="color:#059669;font-weight:bold;">✅ Vừa duyệt thành công</span>`
          : `<span style="color:#64748b;font-weight:semibold;">✓ Đã duyệt trước đó</span>`;

        return `
          <tr>
            <td style="font-weight:600;">${dateStr}</td>
            <td>${LEAVE_SHIFT_LABELS[l.shift] || l.shift}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      })
      .join("");

    return renderResultHtml({
      title: "Phê duyệt thành công! ✅",
      subtitle: `Bạn đã duyệt chính thức ${newlyApprovedSlots.length} ca nghỉ phép mới cho Điều dưỡng ${staffName}.`,
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
          <strong>Đã gửi email xác nhận:</strong> Hệ thống đã tự động gửi email thông báo xác thực tới Điều dưỡng <strong>${staffName}</strong> (chỉ gửi các ca vừa được duyệt mới) kèm lời nhắc làm phiếu giấy theo quy định, đồng thời gửi BCC tới <strong>ĐD Nghĩa</strong> (nghiadn.pk@pnt.edu.vn).
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