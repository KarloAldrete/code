import { z } from "zod";
import type { FeedbackEventRepository } from "../../db/repositories/feedback-event-repository";
import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import {
  FeedbackRoutingEvent,
  type FeedbackRoutingService,
} from "../../services/hedgemony/feedback-routing-service";
import type { GoalSpecDraftService } from "../../services/hedgemony/goal-spec-draft-service";
import type { HedgehogTickService } from "../../services/hedgemony/hedgehog-tick-service";
import type { HogletService } from "../../services/hedgemony/hoglet-service";
import type { NestChatService } from "../../services/hedgemony/nest-chat-service";
import type { NestService } from "../../services/hedgemony/nest-service";
import {
  adoptHogletInput,
  completeNestInput,
  createNestInput,
  dismissSignalHogletInput,
  feedbackEvent,
  forgetCompletedNestContextInput,
  goalDraftRespondInput,
  goalDraftResponse,
  HedgemonyEvent,
  hoglet,
  hogletWatchScope,
  injectPromptEventPayload,
  listFeedbackForNestInput,
  listFeedbackForNestOutput,
  listHogletsInput,
  listHogletsOutput,
  listNestChatInput,
  listNestChatOutput,
  listNestsOutput,
  nest,
  nestIdInput,
  nestMessage,
  recordAdhocHogletInput,
  recordBootstrapHandoffInput,
  recordRoutedFeedbackInput,
  recordSignalBackedHogletInput,
  releaseHogletInput,
  sendNestMessageInput,
  spawnFollowUpHogletInput,
  updateNestInput,
} from "../../services/hedgemony/schemas";
import { publicProcedure, router } from "../trpc";

const getService = () => container.get<NestService>(MAIN_TOKENS.NestService);
const getNestChatService = () =>
  container.get<NestChatService>(MAIN_TOKENS.NestChatService);
const getGoalSpecDraftService = () =>
  container.get<GoalSpecDraftService>(MAIN_TOKENS.GoalSpecDraftService);
const getHogletService = () =>
  container.get<HogletService>(MAIN_TOKENS.HogletService);
const getHedgehogTickService = () =>
  container.get<HedgehogTickService>(MAIN_TOKENS.HedgehogTickService);
const getFeedbackRoutingService = () =>
  container.get<FeedbackRoutingService>(MAIN_TOKENS.FeedbackRoutingService);
const getFeedbackEventRepository = () =>
  container.get<FeedbackEventRepository>(MAIN_TOKENS.FeedbackEventRepository);

export const hedgemonyRouter = router({
  goalDraft: router({
    respond: publicProcedure
      .input(goalDraftRespondInput)
      .output(goalDraftResponse)
      .mutation(({ input }) => getGoalSpecDraftService().respond(input)),
  }),
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

    complete: publicProcedure
      .input(completeNestInput)
      .output(nest)
      .mutation(({ input }) => getService().complete(input)),

    forgetCompletedContext: publicProcedure
      .input(forgetCompletedNestContextInput)
      .output(nest)
      .mutation(({ input }) => getService().forgetCompletedContext(input)),

    unarchive: publicProcedure
      .input(nestIdInput)
      .output(nest)
      .mutation(({ input }) => getService().unarchive(input)),

    spawnFollowUpHoglet: publicProcedure
      .input(spawnFollowUpHogletInput)
      .output(hoglet)
      .mutation(
        async ({ input }) => await getHogletService().spawnFollowUp(input),
      ),

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

    recordBootstrapHandoff: publicProcedure
      .input(recordBootstrapHandoffInput)
      .output(nestMessage)
      .mutation(({ input }) => {
        const message = getNestChatService().recordBootstrapHandoff(input);
        getService().emitMessageAppended(message);
        return message;
      }),

    send: publicProcedure
      .input(sendNestMessageInput)
      .output(nestMessage)
      .mutation(({ input }) => {
        const message = getNestChatService().send(input);
        getService().emitMessageAppended(message);
        // Operator chat is a tick trigger per the spec; fire-and-forget.
        getHedgehogTickService().enqueueTick(input.nestId, "operator_chat");
        return message;
      }),
  }),
  hoglets: router({
    recordAdhoc: publicProcedure
      .input(recordAdhocHogletInput)
      .output(hoglet)
      .mutation(({ input }) => getHogletService().recordAdhoc(input)),

    recordSignalBacked: publicProcedure
      .input(recordSignalBackedHogletInput)
      .output(hoglet)
      .mutation(
        async ({ input }) => await getHogletService().recordSignalBacked(input),
      ),

    adopt: publicProcedure
      .input(adoptHogletInput)
      .output(hoglet)
      .mutation(({ input }) => getHogletService().adopt(input)),

    release: publicProcedure
      .input(releaseHogletInput)
      .output(hoglet)
      .mutation(({ input }) => getHogletService().release(input)),

    dismissSignal: publicProcedure
      .input(dismissSignalHogletInput)
      .mutation(({ input }) => {
        getHogletService().dismissSignal(input);
      }),

    list: publicProcedure
      .input(listHogletsInput)
      .output(listHogletsOutput)
      .query(({ input }) => getHogletService().list(input)),

    /**
     * Per-scope watch. The floating holding panel subscribes with
     * `kind: "wild"` for ad-hoc hoglets, `kind: "signal_staging"` for
     * Inbox-backed signal hoglets, and each nest's brood cluster subscribes
     * with `kind: "nest", nestId`. The service emits with a `bucket`
     * discriminator that the router matches against the watch scope.
     */
    watch: publicProcedure
      .input(hogletWatchScope)
      .subscription(async function* ({ input, signal }) {
        const service = getHogletService();
        const iterable = service.toIterable(HedgemonyEvent.HogletChanged, {
          signal,
        });
        for await (const data of iterable) {
          const { bucket } = data;
          if (input.kind === "wild" && bucket.kind === "wild") {
            yield data.event;
          } else if (
            input.kind === "signal_staging" &&
            bucket.kind === "signal_staging"
          ) {
            yield data.event;
          } else if (
            input.kind === "nest" &&
            bucket.kind === "nest" &&
            bucket.nestId === input.nestId
          ) {
            yield data.event;
          }
        }
      }),
  }),
  feedback: router({
    /**
     * Live stream of `injectPrompt` events. The renderer hook
     * `useHedgemonyPromptRouter` subscribes once at app level and either
     * calls the existing `sendPromptToAgent` for connected sessions or
     * calls `nests.spawnFollowUpHoglet` for closed ones.
     */
    onInjectPrompt: publicProcedure.subscription(async function* ({ signal }) {
      const service = getFeedbackRoutingService();
      const iterable = service.toIterable(FeedbackRoutingEvent.InjectPrompt, {
        signal,
      });
      for await (const data of iterable) {
        yield data;
      }
    }),

    /** Drains any events emitted before the subscription attached. */
    getPendingInjects: publicProcedure
      .output(z.array(injectPromptEventPayload))
      .query(() => getFeedbackRoutingService().consumePending()),

    /**
     * Records the outcome of a routed feedback event. Inserts a
     * `hedgemony_feedback_event` row (idempotent on the dedupe index)
     * and writes a `feedback_routed` audit row to nest chat.
     */
    recordRouted: publicProcedure
      .input(recordRoutedFeedbackInput)
      .output(feedbackEvent)
      .mutation(({ input }) =>
        getFeedbackRoutingService().recordRoutedOutcome(input),
      ),

    listForNest: publicProcedure
      .input(listFeedbackForNestInput)
      .output(listFeedbackForNestOutput)
      .query(({ input }) =>
        getFeedbackEventRepository().listForNest(input.nestId, input.limit),
      ),
  }),
});
