import fs from "node:fs";
import path from "node:path";

function respond(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

try {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) {
    respond({ decision: "allow" });
  }

  const payload = JSON.parse(raw);

  // Chỉ kiểm tra 1 lần duy nhất khi kết thúc bình thường (tránh lặp vô hạn)
  if (
    payload?.terminationReason !== "NO_TOOL_CALL" ||
    Number(payload?.executionNum ?? 1) !== 1
  ) {
    respond({ decision: "allow" });
  }

  const rootDir =
    Array.isArray(payload?.workspacePaths) && payload.workspacePaths[0]
      ? payload.workspacePaths[0]
      : path.resolve(process.cwd(), "..");

  const tempPattern = /^(?:test[-_].*|debug[-_].*|temp[-_].*)\.(?:js|ts|mjs|cjs|sql|json)$/i;
  const recentWindowMs = 20 * 60 * 1000;
  const now = Date.now();

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const leftoverFiles = [];

  for (const entry of entries) {
    if (!entry.isFile() || !tempPattern.test(entry.name)) continue;
    const fullPath = path.join(rootDir, entry.name);
    try {
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs <= recentWindowMs) {
        leftoverFiles.push(entry.name);
      }
    } catch {}
  }

  if (leftoverFiles.length > 0) {
    respond({
      decision: "continue",
      reason: `[Auto-Cleanup Check] Phát hiện tệp nháp kiểm thử vừa tạo tại thư mục gốc (${leftoverFiles.join(", ")}). Vui lòng dọn dẹp theo quy tắc GEMINI.md trước khi hoàn tất phản hồi.`,
    });
  }

  respond({ decision: "allow" });
} catch {
  respond({ decision: "allow" });
}
