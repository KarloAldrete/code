import { Saga, type SagaLogger } from "@posthog/shared";
import { inject, injectable } from "inversify";
import type {
  Bridge,
  BridgeRepository,
} from "../../db/repositories/bridge-repository";
import type { HogletRepository } from "../../db/repositories/hoglet-repository";
import type { NestMessageRepository } from "../../db/repositories/nest-message-repository";
import type {
  NestRepository,
  Nest as NestRow,
} from "../../db/repositories/nest-repository";
import type { OverlapRepository } from "../../db/repositories/overlap-repository";
import type {
  Proposal,
  ProposalRepository,
} from "../../db/repositories/proposal-repository";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import {
  type CreateBridgeInput,
  HedgemonyEvent,
  type MergeNestsInput,
  type ProposalIdInput,
  type SplitNestInput,
} from "./schemas";
import { stringifyError } from "./utils";

const log = logger.scope("federation-service");

interface BaseDeps {
  nests: NestRepository;
  hoglets: HogletRepository;
  bridges: BridgeRepository;
  proposals: ProposalRepository;
  overlaps: OverlapRepository;
  nestMessages: NestMessageRepository;
}

export interface MergeNestsSagaInput extends MergeNestsInput {
  // No extra fields today — kept as a separate type so the saga signature is
  // stable if cross-process inputs diverge from the input zod schema later.
}

export interface MergeNestsSagaOutput {
  primary: NestRow;
  secondary: NestRow;
  movedHogletCount: number;
}

/**
 * Atomic merge of `secondary` into `primary`. Steps that must be reversible
 * (hoglet rebind, audit logs, tombstone) each carry a compensating action so
 * a partial failure (e.g. the audit-log write rejects) cleanly rolls every
 * earlier step back. Read-only validation steps run first so the saga fails
 * fast.
 */
export class MergeNestsSaga extends Saga<
  MergeNestsSagaInput,
  MergeNestsSagaOutput
> {
  readonly sagaName = "MergeNestsSaga";

  constructor(
    private readonly deps: BaseDeps,
    sagaLogger?: SagaLogger,
  ) {
    super(sagaLogger);
  }

  protected async execute(
    input: MergeNestsSagaInput,
  ): Promise<MergeNestsSagaOutput> {
    const { primary, secondary } = await this.readOnlyStep(
      "validate-pair",
      async () => {
        const p = this.deps.nests.findById(input.primaryNestId);
        const s = this.deps.nests.findById(input.secondaryNestId);
        if (!p)
          throw new Error(`primary nest not found: ${input.primaryNestId}`);
        if (!s)
          throw new Error(`secondary nest not found: ${input.secondaryNestId}`);
        if (p.id === s.id) throw new Error("cannot merge nest into itself");
        if (p.mergedIntoId)
          throw new Error("primary nest is already merged into another");
        if (s.mergedIntoId)
          throw new Error("secondary nest is already merged into another");
        if (p.status === "archived" || s.status === "archived")
          throw new Error("cannot merge archived nest");
        return { primary: p, secondary: s };
      },
    );

    const hogletsToMove = await this.readOnlyStep(
      "load-secondary-hoglets",
      async () => this.deps.hoglets.findAllForNest(secondary.id),
    );

    const movedHogletIds: string[] = [];
    await this.step({
      name: "rebind-hoglets",
      execute: async () => {
        for (const hoglet of hogletsToMove) {
          this.deps.hoglets.update(hoglet.id, { nestId: primary.id });
          movedHogletIds.push(hoglet.id);
        }
      },
      rollback: async () => {
        for (const hogletId of movedHogletIds) {
          this.deps.hoglets.update(hogletId, { nestId: secondary.id });
        }
      },
    });

    const auditMessageId = await this.step<string>({
      name: "write-merge-audit",
      execute: async () => {
        const message = this.deps.nestMessages.create({
          nestId: primary.id,
          kind: "audit",
          body: `Merged nest "${secondary.name}" into "${primary.name}". ${hogletsToMove.length} hoglet(s) rebound.`,
          payloadJson: JSON.stringify({
            type: "nest_merge",
            actor: "builder",
            primaryNestId: primary.id,
            secondaryNestId: secondary.id,
            movedHogletIds,
          }),
        });
        return message.id;
      },
      rollback: async (messageId) => {
        this.deps.nestMessages.deleteById(messageId);
      },
    });
    log.debug("merge audit recorded", { auditMessageId });

    const updatedSecondary = await this.step<NestRow>({
      name: "tombstone-secondary",
      execute: async () => {
        const updated = this.deps.nests.update(secondary.id, {
          status: "dormant",
          mergedIntoId: primary.id,
        });
        if (!updated) throw new Error("failed to tombstone secondary nest");
        return updated;
      },
      rollback: async () => {
        this.deps.nests.update(secondary.id, {
          status: secondary.status,
          mergedIntoId: null,
        });
      },
    });

    if (input.proposalId) {
      const proposalId = input.proposalId;
      await this.step({
        name: "mark-proposal-accepted",
        execute: async () => {
          this.deps.proposals.updateStatus(proposalId, "accepted");
        },
        rollback: async () => {
          this.deps.proposals.updateStatus(proposalId, "open");
        },
      });
    }

    const refreshedPrimary = this.deps.nests.findById(primary.id);
    if (!refreshedPrimary)
      throw new Error("primary nest disappeared mid-merge");

    return {
      primary: refreshedPrimary,
      secondary: updatedSecondary,
      movedHogletCount: hogletsToMove.length,
    };
  }
}

@injectable()
export class FederationService {
  constructor(
    @inject(MAIN_TOKENS.NestRepository)
    private readonly nests: NestRepository,
    @inject(MAIN_TOKENS.HogletRepository)
    private readonly hoglets: HogletRepository,
    @inject(MAIN_TOKENS.BridgeRepository)
    private readonly bridges: BridgeRepository,
    @inject(MAIN_TOKENS.ProposalRepository)
    private readonly proposals: ProposalRepository,
    @inject(MAIN_TOKENS.OverlapRepository)
    private readonly overlaps: OverlapRepository,
    @inject(MAIN_TOKENS.NestMessageRepository)
    private readonly nestMessages: NestMessageRepository,
  ) {}

  /** All proposals matching the (optional) status filter. */
  listProposals(input: { status?: Proposal["status"] }): Proposal[] {
    if (input.status === undefined) return this.proposals.listAll();
    if (input.status === "open") return this.proposals.listOpen();
    return this.proposals.listAll().filter((p) => p.status === input.status);
  }

  acceptProposal(input: ProposalIdInput): Proposal {
    const proposal = this.proposals.findById(input.id);
    if (!proposal) throw new Error(`Proposal not found: ${input.id}`);
    if (proposal.status !== "open") {
      throw new Error(
        `Proposal ${input.id} is not open (status=${proposal.status})`,
      );
    }
    return this.proposals.updateStatus(input.id, "accepted");
  }

  dismissProposal(input: ProposalIdInput): Proposal {
    const proposal = this.proposals.findById(input.id);
    if (!proposal) throw new Error(`Proposal not found: ${input.id}`);
    return this.proposals.updateStatus(input.id, "dismissed");
  }

  snoozeProposal(input: ProposalIdInput): Proposal {
    const proposal = this.proposals.findById(input.id);
    if (!proposal) throw new Error(`Proposal not found: ${input.id}`);
    if (proposal.status !== "open") {
      throw new Error(
        `Proposal ${input.id} is not open (status=${proposal.status})`,
      );
    }
    return this.proposals.updateStatus(input.id, "snoozed");
  }

  listBridges(input: { nestId?: string }): Bridge[] {
    if (input.nestId) return this.bridges.listOpenForNest(input.nestId);
    return this.bridges.listOpen();
  }

  createBridge(input: CreateBridgeInput): Bridge {
    if (input.nestAId === input.nestBId) {
      throw new Error("bridge endpoints must be different nests");
    }
    return this.bridges.insert({
      nestAId: input.nestAId,
      nestBId: input.nestBId,
      kind: input.kind,
      payloadJson: input.payloadJson,
      createdBy: input.createdBy,
    });
  }

  removeBridge(input: { id: string }): void {
    this.bridges.remove(input.id);
  }

  listOverlaps(): ReturnType<OverlapRepository["listOpen"]> {
    return this.overlaps.listOpen();
  }

  /**
   * Operator-confirmed merge. Routes through {@link MergeNestsSaga} so a
   * partial-failure rolls every step back atomically.
   */
  async mergeNests(input: MergeNestsInput): Promise<MergeNestsSagaOutput> {
    const saga = new MergeNestsSaga({
      nests: this.nests,
      hoglets: this.hoglets,
      bridges: this.bridges,
      proposals: this.proposals,
      overlaps: this.overlaps,
      nestMessages: this.nestMessages,
    });
    const result = await saga.run(input);
    if (!result.success) {
      log.error("mergeNests saga failed", {
        error: result.error,
        failedStep: result.failedStep,
        input,
      });
      throw new Error(
        `mergeNests failed at ${result.failedStep}: ${result.error}`,
      );
    }
    return result.data;
  }

  /**
   * Operator-confirmed split. Creates a new sibling nest and (optionally)
   * rebinds the listed hoglets into it. Light-weight enough to skip the
   * saga shell — the only meaningful failure mode is the create itself,
   * and a half-spawned nest with no hoglets isn't a broken invariant.
   */
  splitNest(input: SplitNestInput): {
    source: NestRow;
    spawned: NestRow;
    movedHogletCount: number;
  } {
    const source = this.nests.findById(input.sourceNestId);
    if (!source)
      throw new Error(`source nest not found: ${input.sourceNestId}`);
    const spawned = this.nests.create({
      name: input.newNestName,
      goalPrompt: input.newNestGoalPrompt,
      mapX: input.newMapX,
      mapY: input.newMapY,
      primaryRepository: source.primaryRepository,
    });
    let moved = 0;
    for (const hogletId of input.hogletIdsToMove) {
      const hoglet = this.hoglets.findById(hogletId);
      if (!hoglet || hoglet.nestId !== source.id) {
        log.warn("split: skipped hoglet not in source nest", {
          hogletId,
          source: source.id,
        });
        continue;
      }
      this.hoglets.update(hogletId, { nestId: spawned.id });
      moved++;
    }
    this.nestMessages.create({
      nestId: source.id,
      kind: "audit",
      body: `Split off new nest "${spawned.name}". ${moved} hoglet(s) moved.`,
      payloadJson: JSON.stringify({
        type: "nest_split",
        actor: "builder",
        sourceNestId: source.id,
        spawnedNestId: spawned.id,
        movedHogletCount: moved,
      }),
    });
    if (input.proposalId) {
      try {
        this.proposals.updateStatus(input.proposalId, "accepted");
      } catch (error) {
        log.warn("split: failed to mark proposal accepted", {
          proposalId: input.proposalId,
          error: stringifyError(error),
        });
      }
    }
    return { source, spawned, movedHogletCount: moved };
  }

  // Re-exported here so callers don't need to import HedgemonyEvent from
  // schemas. The router uses this when wiring subscriptions.
  static readonly Event = HedgemonyEvent;
}
