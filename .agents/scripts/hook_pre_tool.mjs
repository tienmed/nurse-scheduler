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
  const args = payload?.toolCall?.args || {};

  // 1. Freeze Mode: Bảo vệ các tệp biến môi trường nhạy cảm
  const targetPath = String(args.Path || args.TargetFile || "");
  if (targetPath) {
    const baseName = path.basename(targetPath).toLowerCase();
    const frozenFiles = new Set([
      ".env",
      ".env.local",
      ".env.production",
      "email.env",
    ]);

    if (frozenFiles.has(baseName)) {
      respond({
        decision: "force_ask",
        reason: `[Safety-Guard / Freeze Mode] Tệp "${baseName}" chứa thông tin bí mật (Service Account, SMTP). Chỉ được phép chỉnh sửa khi người dùng yêu cầu rõ ràng.`,
      });
    }
  }

  // 2. Sheets Guard & Terminal Protection: Kiểm tra lệnh thực thi shell
  const cmd = String(args.CommandLine || "");
  if (cmd) {
    const isGitCommitOrSearch = /^\s*(?:git\s+(?:commit|log|diff|show)|rg\b|Select-String\b)/i.test(cmd);

    if (!isGitCommitOrSearch) {
      // Cảnh báo chạy lệnh setup:sheet có thể ghi đè/tái tạo bảng tính Google Sheets thật
      if (/\b(?:npm\s+run\s+setup:sheet|node\s+.*setup-google-sheet\.mjs)\b/i.test(cmd)) {
        respond({
          decision: "force_ask",
          reason:
            "[Sheets-Guard] Lệnh setup:sheet sẽ tái khởi tạo tiêu đề các tab trên Google Sheets thực tế. Vui lòng xác nhận trước khi thực hiện.",
        });
      }

      // Ngăn chặn lệnh gỡ bỏ tác vụ Windows Scheduler đột ngột
      if (/\bschtasks\s+\/delete\b/i.test(cmd)) {
        respond({
          decision: "deny",
          reason:
            "[Safety-Guard] Không được tự ý xóa tác vụ lập lịch Windows (schtasks /delete) của phòng khám.",
        });
      }
    }
  }

  respond({ decision: "allow" });
} catch {
  respond({ decision: "allow" });
}
