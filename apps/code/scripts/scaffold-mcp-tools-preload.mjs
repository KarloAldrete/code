import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Redirects `electron` imports to a local stub so the scaffold script can
// import the tRPC router (which transitively touches Electron-bound modules)
// without an Electron runtime present.
register(
  "./scaffold-mcp-tools-loader.mjs",
  pathToFileURL(`${import.meta.dirname}/`),
);
