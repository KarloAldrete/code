import { z } from "zod";
import type { BuilderStateRepository } from "../../db/repositories/builder-state-repository";
import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import type { BuilderTickService } from "../../services/hedgemony/builder-tick-service";
import type { FederationService } from "../../services/hedgemony/federation-service";
import {
  bridge,
  builderState,
  createBridgeInput,
  HedgemonyEvent,
  listBridgesInput,
  listBridgesOutput,
  listOverlapsOutput,
  listProposalsInput,
  listProposalsOutput,
  mergeNestsInput,
  nest,
  overlapWatchEvent,
  proposal,
  proposalIdInput,
  proposalWatchEvent,
  removeBridgeInput,
  splitNestInput,
  updateBuilderStateInput,
} from "../../services/hedgemony/schemas";
import { publicProcedure, router } from "../trpc";

const getFederationService = () =>
  container.get<FederationService>(MAIN_TOKENS.FederationService);
const getBuilderTickService = () =>
  container.get<BuilderTickService>(MAIN_TOKENS.BuilderTickService);
const getBuilderStateRepository = () =>
  container.get<BuilderStateRepository>(MAIN_TOKENS.BuilderStateRepository);

const mergeNestsOutput = z.object({
  primary: nest,
  secondary: nest,
  movedHogletCount: z.number(),
});

const splitNestOutput = z.object({
  source: nest,
  spawned: nest,
  movedHogletCount: z.number(),
});

export const hedgemonyFederationRouter = router({
  proposals: router({
    list: publicProcedure
      .input(listProposalsInput.optional())
      .output(listProposalsOutput)
      .query(({ input }) =>
        getFederationService().listProposals({ status: input?.status }),
      ),

    accept: publicProcedure
      .input(proposalIdInput)
      .output(proposal)
      .mutation(({ input }) => getFederationService().acceptProposal(input)),

    dismiss: publicProcedure
      .input(proposalIdInput)
      .output(proposal)
      .mutation(({ input }) => getFederationService().dismissProposal(input)),

    snooze: publicProcedure
      .input(proposalIdInput)
      .output(proposal)
      .mutation(({ input }) => getFederationService().snoozeProposal(input)),

    watch: publicProcedure.subscription(async function* ({ signal }) {
      const service = getBuilderTickService();
      for await (const data of service.toIterable(
        HedgemonyEvent.ProposalChanged,
        { signal },
      )) {
        yield proposalWatchEvent.parse(data);
      }
    }),
  }),

  bridges: router({
    list: publicProcedure
      .input(listBridgesInput.optional())
      .output(listBridgesOutput)
      .query(({ input }) =>
        getFederationService().listBridges({ nestId: input?.nestId }),
      ),

    create: publicProcedure
      .input(createBridgeInput)
      .output(bridge)
      .mutation(({ input }) => getFederationService().createBridge(input)),

    remove: publicProcedure
      .input(removeBridgeInput)
      .output(z.void())
      .mutation(({ input }) => {
        getFederationService().removeBridge(input);
      }),
  }),

  overlaps: router({
    list: publicProcedure
      .output(listOverlapsOutput)
      .query(() => getFederationService().listOverlaps()),

    watch: publicProcedure.subscription(async function* ({ signal }) {
      const service = getBuilderTickService();
      for await (const data of service.toIterable(
        HedgemonyEvent.OverlapChanged,
        { signal },
      )) {
        yield overlapWatchEvent.parse(data);
      }
    }),
  }),

  nests: router({
    merge: publicProcedure
      .input(mergeNestsInput)
      .output(mergeNestsOutput)
      .mutation(({ input }) => getFederationService().mergeNests(input)),

    split: publicProcedure
      .input(splitNestInput)
      .output(splitNestOutput)
      .mutation(({ input }) => getFederationService().splitNest(input)),
  }),

  builderState: router({
    get: publicProcedure
      .output(builderState.nullable())
      .query(() => getBuilderStateRepository().get()),

    update: publicProcedure
      .input(updateBuilderStateInput)
      .output(builderState)
      .mutation(({ input }) =>
        getBuilderStateRepository().upsert({
          configJson: input.configJson ?? undefined,
        }),
      ),
  }),
});
