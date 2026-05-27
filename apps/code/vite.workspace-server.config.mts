import { builtinModules, createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { mainAliases } from "./vite.shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]);

export default defineConfig({
  resolve: {
    alias: mainAliases,
    conditions: ["node"],
  },
  cacheDir: ".vite/cache-workspace-server",
  build: {
    target: "node18",
    sourcemap: true,
    minify: false,
    reportCompressedSize: false,
    outDir: path.join(__dirname, ".vite/build"),
    emptyOutDir: false,
    ssr: true,
    lib: {
      entry: require.resolve("@posthog/workspace-server/serve"),
      formats: ["cjs"],
    },
    rollupOptions: {
      output: {
        entryFileNames: "workspace-server.js",
      },
      external: (id) => {
        if (nodeBuiltins.has(id)) return true;
        if (id.startsWith("@posthog/")) return false;
        if (id.startsWith(".") || path.isAbsolute(id)) return false;
        return true;
      },
    },
  },
});
