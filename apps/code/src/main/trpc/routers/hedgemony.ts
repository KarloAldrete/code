import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import type { NestChatService } from "../../services/hedgemony/nest-chat-service";
import type { NestService } from "../../services/hedgemony/nest-service";
import {
  createNestInput,
  HedgemonyEvent,
  listNestChatInput,
  listNestChatOutput,
  listNestsOutput,
  nest,
  nestIdInput,
  updateNestInput,
} from "../../services/hedgemony/schemas";
import { publicProcedure, router } from "../trpc";

const getService = () => container.get<NestService>(MAIN_TOKENS.NestService);
const getNestChatService = () =>
  container.get<NestChatService>(MAIN_TOKENS.NestChatService);

export const hedgemonyRouter = router({
  nests: router({
    list: publicProcedure
      .output(listNestsOutput)
      .query(() => getService().list()),

    get: publicProcedure
      .input(nestIdInput)
      .output(nest)
      .query(({ input }) => getService().get(input)),

    create: publicProcedure
      .input(createNestInput)
      .output(nest)
      .mutation(({ input }) => getService().create(input)),

    update: publicProcedure
      .input(updateNestInput)
      .output(nest)
      .mutation(({ input }) => getService().update(input)),

    archive: publicProcedure
      .input(nestIdInput)
      .output(nest)
      .mutation(({ input }) => getService().archive(input)),

    unarchive: publicProcedure
      .input(nestIdInput)
      .output(nest)
      .mutation(({ input }) => getService().unarchive(input)),

    /**
     * Per-nest watch. Emits on status change, archive, and (later) hoglet
     * roster changes / hedgehog tick completion.
     */
    watch: publicProcedure.input(nestIdInput).subscription(async function* ({
      input,
      signal,
    }) {
      const service = getService();
      const iterable = service.toIterable(HedgemonyEvent.NestChanged, {
        signal,
      });
      for await (const data of iterable) {
        if (data.nestId === input.id) {
          yield data.event;
        }
      }
    }),
  }),
  nestChat: router({
    list: publicProcedure
      .input(listNestChatInput)
      .output(listNestChatOutput)
      .query(({ input }) => getNestChatService().list(input)),
  }),
});
