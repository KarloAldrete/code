import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const STUB_URL = pathToFileURL(`${import.meta.dirname}/electron-stub.mjs`).href;
const SRC_DIR = path.resolve(import.meta.dirname, "..", "src");

const PATH_ALIASES = {
  "@main/": `${path.join(SRC_DIR, "main")}/`,
  "@renderer/": `${path.join(SRC_DIR, "renderer")}/`,
  "@shared/": `${path.join(SRC_DIR, "shared")}/`,
  "@features/": `${path.join(SRC_DIR, "renderer", "features")}/`,
  "@components/": `${path.join(SRC_DIR, "renderer", "components")}/`,
  "@stores/": `${path.join(SRC_DIR, "renderer", "stores")}/`,
  "@hooks/": `${path.join(SRC_DIR, "renderer", "hooks")}/`,
  "@utils/": `${path.join(SRC_DIR, "renderer", "utils")}/`,
  "@test/": `${path.join(SRC_DIR, "shared", "test")}/`,
};

// Some import targets exist as BOTH `foo.ts` AND `foo/` (sibling file +
// directory). Node ESM's default resolution picks the directory and looks for
// `index.json` — wrong. `bundler` moduleResolution (which tsconfig sets) and
// Vite prefer the `.ts` sibling. Replicate that by checking for the `.ts`
// file first and short-circuiting if it exists.
function preferFileSibling(absPath) {
  for (const ext of [".ts", ".tsx", ".mjs", ".js"]) {
    const candidate = `${absPath}${ext}`;
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  if (specifier === "electron") {
    return { url: STUB_URL, format: "module", shortCircuit: true };
  }
  for (const [prefix, target] of Object.entries(PATH_ALIASES)) {
    if (specifier.startsWith(prefix)) {
      const rel = specifier.slice(prefix.length);
      const abs = path.join(target, rel);
      const fileSibling = preferFileSibling(abs);
      if (fileSibling) {
        return {
          url: pathToFileURL(fileSibling).href,
          format: fileSibling.endsWith(".json") ? "json" : "module",
          shortCircuit: true,
        };
      }
      return nextResolve(abs, context);
    }
  }
  return nextResolve(specifier, context);
}
