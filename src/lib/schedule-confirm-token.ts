import { createHmac, timingSafeEqual } from "node:crypto";

function resolveConfirmSecret(explicitSecret?: string): string {
  const secret = (explicitSecret ?? process.env.AUTH_SECRET ?? "").trim();
  if (!secret) {
    throw new Error("Thiếu biến môi trường AUTH_SECRET để tạo/xác thực token chốt lịch.");
  }
  return secret;
}

/**
 * Tạo token HMAC-SHA256 không trạng thái cho tuần làm việc (weekStart: yyyy-MM-dd)
 * để dùng trong nút Xác nhận 1 chạm của email lịch tuần sau.
 */
export function createScheduleConfirmToken(weekStart: string, explicitSecret?: string): string {
  const secret = resolveConfirmSecret(explicitSecret);
  return createHmac("sha256", secret)
    .update(`nurseflow:schedule-confirm:${weekStart}`)
    .digest("hex");
}

/**
 * Xác thực token chốt lịch tuần bằng so sánh hằng thời gian.
 */
export function verifyScheduleConfirmToken(
  weekStart: string,
  token: string,
  explicitSecret?: string,
): boolean {
  if (!weekStart || !token) return false;
  const normalizedToken = token.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalizedToken)) return false;

  const expected = createScheduleConfirmToken(weekStart, explicitSecret);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(normalizedToken, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
