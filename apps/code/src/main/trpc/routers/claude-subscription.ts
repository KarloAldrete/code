import { readFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { z } from "zod";
import {
  getUseClaudeSubscription,
  setUseClaudeSubscription,
} from "../../services/settingsStore";
import { logger } from "../../utils/logger";
import { publicProcedure, router } from "../trpc";

const log = logger.scope("claude-subscription-router");

const statusOutput = z.object({
  signedIn: z.boolean(),
  accountEmail: z.string().nullable(),
});

async function readClaudeStatus(): Promise<z.infer<typeof statusOutput>> {
  const credPath = path.join(os.homedir(), ".claude.json");
  try {
    const raw = await readFile(credPath, "utf8");
    const parsed = JSON.parse(raw) as {
      oauthAccount?: { emailAddress?: string };
    };
    const email = parsed.oauthAccount?.emailAddress ?? null;
    return { signedIn: true, accountEmail: email };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "ENOENT"
    ) {
      return { signedIn: false, accountEmail: null };
    }
    log.warn("Failed to read ~/.claude.json", { error: err });
    return { signedIn: false, accountEmail: null };
  }
}

export const claudeSubscriptionRouter = router({
  getEnabled: publicProcedure
    .output(z.boolean())
    .query(() => getUseClaudeSubscription()),

  setEnabled: publicProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(({ input }) => {
      setUseClaudeSubscription(input.enabled);
    }),

  getStatus: publicProcedure
    .output(statusOutput)
    .query(() => readClaudeStatus()),
});
