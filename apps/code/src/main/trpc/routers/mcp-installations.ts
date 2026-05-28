import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import {
  installCustomInput,
  installCustomOutput,
  listMcpInstallationsOutput,
  McpInstallationsServiceEvent,
} from "../../services/mcp-installations/schemas";
import type { McpInstallationsService } from "../../services/mcp-installations/service";
import { publicProcedure, router } from "../trpc";

const getService = () =>
  container.get<McpInstallationsService>(MAIN_TOKENS.McpInstallationsService);

export const mcpInstallationsRouter = router({
  list: publicProcedure
    .output(listMcpInstallationsOutput)
    .query(() => getService().list()),

  installCustom: publicProcedure
    .input(installCustomInput)
    .output(installCustomOutput)
    .mutation(({ input }) => getService().installCustom(input)),

  onInstalled: publicProcedure.subscription(async function* (opts) {
    const service = getService();
    for await (const data of service.toIterable(
      McpInstallationsServiceEvent.Installed,
      { signal: opts.signal },
    )) {
      yield data;
    }
  }),
});
