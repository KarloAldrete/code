import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import {
  CustomInstructionsServiceEvent,
  readCustomInstructionsOutput,
  writeCustomInstructionsInput,
  writeCustomInstructionsOutput,
} from "../../services/custom-instructions/schemas";
import type { CustomInstructionsService } from "../../services/custom-instructions/service";
import { publicProcedure, router } from "../trpc";

const getService = () =>
  container.get<CustomInstructionsService>(
    MAIN_TOKENS.CustomInstructionsService,
  );

export const customInstructionsRouter = router({
  read: publicProcedure
    .output(readCustomInstructionsOutput)
    .query(() => ({ customInstructions: getService().read() })),

  write: publicProcedure
    .input(writeCustomInstructionsInput)
    .output(writeCustomInstructionsOutput)
    .mutation(({ input }) => {
      getService().write(input.instructions);
      return { ok: true as const };
    }),

  onChanged: publicProcedure.subscription(async function* (opts) {
    const service = getService();
    for await (const data of service.toIterable(
      CustomInstructionsServiceEvent.Changed,
      { signal: opts.signal },
    )) {
      yield data;
    }
  }),
});
