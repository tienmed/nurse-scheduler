import fs from "fs";
import path from "path";

export function getAppVersion(): string {
  try {
    const verPath = path.join(process.cwd(), "VER.md");
    const content = fs.readFileSync(verPath, "utf-8");
    const match = content.match(/## (v[\d.]+)/);
    return match ? match[1] : "v1.0.0";
  } catch (error) {
    console.error("Error reading version:", error);
    return "v1.0.0";
  }
}
