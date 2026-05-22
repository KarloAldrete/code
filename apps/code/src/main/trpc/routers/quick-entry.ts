import { z } from "zod";
import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import {
  QuickEntryServiceEvent,
  type QuickEntryServiceEvents,
} from "../../services/quick-entry/schemas";
import type { QuickEntryService } from "../../services/quick-entry/service";
import { publicProcedure, router } from "../trpc";

const getService = () =>
  container.get<QuickEntryService>(MAIN_TOKENS.QuickEntryService);

function subscribeToQuickEntryEvent<K extends keyof QuickEntryServiceEvents>(
  event: K,
) {
  return publicProcedure.subscription(async function* (opts) {
    const service = getService();
    const iterable = service.toIterable(event, { signal: opts.signal });
    for await (const data of iterable) {
      yield data;
    }
  });
}

export const quickEntryRouter = router({
  toggle: publicProcedure.mutation(() => {
    getService().toggle();
  }),

  show: publicProcedure.mutation(() => {
    getService().show();
  }),

  hide: publicProcedure.mutation(() => {
    getService().hide();
  }),

  openTaskInMain: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(({ input }) => {
      getService().openTaskInMain(input.taskId);
    }),

  getRecentRepos: publicProcedure
    .input(
      z.object({ limit: z.number().int().positive().optional() }).optional(),
    )
    .query(({ input }) => {
      return getService().getRecentRepos(input?.limit);
    }),

  onFocusInput: subscribeToQuickEntryEvent(QuickEntryServiceEvent.FocusInput),
  onHide: subscribeToQuickEntryEvent(QuickEntryServiceEvent.Hide),
});
