import { defineLibPackage } from "@posthog/tsup-config";

export default defineLibPackage({
  external: ["react", "react-dom"],
});
