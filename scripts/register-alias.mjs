import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const subPath = specifier.slice(2);
      const candidates = [
        path.join(projectRoot, "src", `${subPath}.ts`),
        path.join(projectRoot, "src", `${subPath}.tsx`),
        path.join(projectRoot, "src", subPath, "index.ts"),
        path.join(projectRoot, "src", subPath),
      ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
