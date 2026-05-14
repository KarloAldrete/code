import { inject, injectable } from "inversify";
import type { HedgehogStateRepository } from "../../db/repositories/hedgehog-state-repository";
import type { PrDependencyRepository } from "../../db/repositories/pr-dependency-repository";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import type { GitService } from "../git/service";
import type { PromptWithToolsOutput } from "../llm-gateway/schemas";
import type { LlmGatewayService } from "../llm-gateway/service";
import type { CloudTaskClient } from "./cloud-task-client";
import type { FeedbackRoutingService } from "./feedback-routing-service";
import { HEDGEHOG_HANDLERS } from "./hedgehog-handlers/registry";
import {
  type HedgehogToolDeps,
  TickBudget,
  type TickContext,
  type WriteNestMessageInput,
} from "./hedgehog-handlers/types";
import { stringifyError } from "./hedgehog-handlers/utils";
import {
  appendScratchpad,
  buildUserPrompt,
  HEDGEHOG_SYSTEM_PROMPT,
  type HogletPrState,
  type HogletWithState,
  type ScratchpadEntry,
} from "./hedgehog-prompts";
import { HEDGEHOG_TOOLS } from "./hedgehog-tools";
import type { HogletService } from "./hoglet-service";
import type { NestChatService } from "./nest-chat-service";
import type { NestService } from "./nest-service";
import type { PrGraphService } from "./pr-graph-service";
import {
  DEFAULT_HOGLET_MODEL,
  HedgemonyEvent,
  type Hoglet,
  type HogletChangedEvent,
  type Nest,
  type NestChangedEvent,
  type NestLoadout,
  nestLoadout,
} from "./schemas";

const log = logger.scope("hedgehog-tick-service");

const MIN_TICK_INTERVAL_MS = 30_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 2 * 60_000;
const SCHEDULER_POLL_INTERVAL_MS = 60_000;
const HEDGEHOG_MODEL = DEFAULT_HOGLET_MODEL;
const HEDGEHOG_EFFORT = "max";
const MAX_TOKENS = 4_000;

function getHeartbeatIntervalMs(): number {
  const envOverride = process.env.HEDGEMONY_HEARTBEAT_INTERVAL_MS;
  if (envOverride) {
    const parsed = Number.parseInt(envOverride, 10);
    if (!Number.isNaN(parsed) && parsed >= 60_000 && parsed <= 600_000) {
      return parsed;
    }
  }
  return DEFAULT_HEARTBEAT_INTERVAL_MS;
}

function parseLoadout(loadoutJson: string | null): NestLoadout {
  if (!loadoutJson) return {};
  try {
    return nestLoadout.parse(JSON.parse(loadoutJson));
  } catch {
    return {};
  }
}

/**
 * Slice 6 of Hedgemony — the hedgehog. A per-nest ephemeral orchestrator that
 * ticks on (heartbeat | new hoglet event | operator chat message), assembles
 * fresh context from sqlite, calls Claude with the constrained tool list, and
 * dispatches each tool_use block back to a service method. State persists in
 * `hedgemony_hedgehog_state` so force-quit mid-tick recovers cleanly.
 *
 * NOT a Task. NOT a long-running agent. The service singleton owns the
 * scheduler and dispatch; each tick is a one-shot function over `(nest,
 * hoglets, recent chat, scratchpad)`.
 */
@injectable()
export class HedgehogTickService {
  private started = false;
  private readonly inFlight = new Set<string>();
  private readonly lastEnqueuedAt = new Map<string, number>();
  private heartbeatHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    @inject(MAIN_TOKENS.LlmGatewayService)
    private readonly llm: LlmGatewayService,
    @inject(MAIN_TOKENS.NestService)
    private readonly nestService: NestService,
    @inject(MAIN_TOKENS.HogletService)
    private readonly hogletService: HogletService,
    @inject(MAIN_TOKENS.NestChatService)
    private readonly nestChat: NestChatService,
    @inject(MAIN_TOKENS.HedgehogStateRepository)
    private readonly stateRepo: HedgehogStateRepository,
    @inject(MAIN_TOKENS.CloudTaskClient)
    private readonly cloudTasks: CloudTaskClient,
    @inject(MAIN_TOKENS.PrDependencyRepository)
    private readonly prDependencies: PrDependencyRepository,
    @inject(MAIN_TOKENS.PrGraphService)
    private readonly prGraph: PrGraphService,
    @inject(MAIN_TOKENS.GitService)
    private readonly git: GitService,
    @inject(MAIN_TOKENS.FeedbackRoutingService)
    private readonly feedbackRouting: FeedbackRoutingService,
  ) {}

  /**
   * Idempotent. Subscribes to nest/hoglet events, starts the heartbeat, and
   * resets any DB rows stuck in `ticking` (left over from a force-quit).
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    // Reset any `ticking` rows from a previous boot so we don't render a
    // stuck glow forever.
    const reset = this.stateRepo.resetStuckTicks();
    for (const row of reset) {
      this.nestService.emitHedgehogTick(row.nestId, {
        state: "idle",
        lastTickAt: row.lastTickAt,
      });
    }

    this.nestService.on(HedgemonyEvent.NestChanged, (data) =>
      this.handleNestEvent(data),
    );
    this.hogletService.on(HedgemonyEvent.HogletChanged, (data) =>
      this.handleHogletEvent(data),
    );

    this.heartbeatHandle = setInterval(() => {
      this.runHeartbeat().catch((error) =>
        log.error("heartbeat tick failed", { error }),
      );
    }, SCHEDULER_POLL_INTERVAL_MS);

    log.info("HedgehogTickService started", {
      schedulerPollIntervalMs: SCHEDULER_POLL_INTERVAL_MS,
      defaultHeartbeatIntervalMs: getHeartbeatIntervalMs(),
    });
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.heartbeatHandle) {
      clearInterval(this.heartbeatHandle);
      this.heartbeatHandle = null;
    }
    log.info("HedgehogTickService stopped");
  }

  /**
   * Schedule a tick for `nestId`. Debounces within `MIN_TICK_INTERVAL_MS`,
   * no-ops if a tick is already in flight. Returns the (fire-and-forget)
   * promise for tests and callers that want to await completion.
   */
  enqueueTick(nestId: string, reason: string): Promise<void> {
    if (!this.started) {
      // Allow direct calls from tests without start().
      log.debug("enqueueTick before start()", { nestId, reason });
    }
    const now = Date.now();
    const last = this.lastEnqueuedAt.get(nestId) ?? 0;
    if (now - last < MIN_TICK_INTERVAL_MS) {
      log.debug("tick debounced", {
        nestId,
        reason,
        elapsedMs: now - last,
      });
      return Promise.resolve();
    }
    if (this.inFlight.has(nestId)) {
      log.debug("tick already in flight", { nestId, reason });
      return Promise.resolve();
    }
    this.lastEnqueuedAt.set(nestId, now);
    return this.runTick(nestId, reason).catch((error) => {
      log.error("tick failed", { nestId, reason, error });
    });
  }

  private handleNestEvent(data: NestChangedEvent): void {
    const event = data.event;
    if (event.kind === "message_appended") {
      if (event.message.kind === "user_message") {
        // Operator chat → trigger tick.
        void this.enqueueTick(data.nestId, "operator_chat");
      }
      return;
    }
    if (event.kind === "status" && event.nest.status === "active") {
      // Newly created/unarchived → kick off an initial tick.
      void this.enqueueTick(data.nestId, "nest_status_active");
    }
  }

  private handleHogletEvent(data: HogletChangedEvent): void {
    if (data.bucket.kind !== "nest") return;
    // Adoption / release inside a nest is a good trigger.
    void this.enqueueTick(data.bucket.nestId, "hoglet_roster_changed");
  }

  private async runHeartbeat(): Promise<void> {
    const globalInterval = getHeartbeatIntervalMs();
    const activeNests = this.nestService
      .list()
      .filter((n) => n.status === "active");
    for (const nest of activeNests) {
      const loadout = parseLoadout(nest.loadoutJson);
      const interval = loadout.heartbeatIntervalMs ?? globalInterval;
      const state = this.stateRepo.findByNestId(nest.id);
      const last = state?.lastTickAt ? new Date(state.lastTickAt).getTime() : 0;
      if (Date.now() - last < interval) continue;
      await this.enqueueTick(nest.id, "heartbeat");
    }
  }

  private async runTick(nestId: string, reason: string): Promise<void> {
    if (this.inFlight.has(nestId)) return;
    this.inFlight.add(nestId);
    try {
      await this.tick(nestId, reason);
    } finally {
      this.inFlight.delete(nestId);
    }
  }

  /**
   * The full tick lifecycle. Public for tests; production callers should use
   * `enqueueTick` so debouncing and the in-flight lock apply.
   */
  async tick(nestId: string, reason: string): Promise<void> {
    const nest = (() => {
      try {
        return this.nestService.get({ id: nestId });
      } catch {
        return null;
      }
    })();
    if (!nest || nest.status !== "active") {
      log.debug("tick skipped — nest missing or inactive", { nestId });
      return;
    }

    // Move state → ticking, emit so the glow turns on.
    this.stateRepo.upsert({ nestId, state: "ticking" });
    this.nestService.emitHedgehogTick(nestId, {
      state: "ticking",
      lastTickAt: this.stateRepo.findByNestId(nestId)?.lastTickAt ?? null,
    });

    const newScratchpadEntries: ScratchpadEntry[] = [];
    const budget = new TickBudget();
    const deps = this.buildHandlerDeps();

    try {
      const context = await this.buildContext(nest, budget);
      const recentChat = this.nestChat.list({ nestId, detail: false });
      const scratchpad = this.loadScratchpad(nestId);
      const userPrompt = buildUserPrompt({
        nest,
        hoglets: context.hoglets,
        recentChat,
        scratchpad,
        triggerReason: reason,
        prDependencies: context.prDependencies,
        loadout: context.loadout,
      });

      const response = await this.llm.promptWithTools(
        [{ role: "user", content: userPrompt }],
        {
          system: HEDGEHOG_SYSTEM_PROMPT,
          maxTokens: MAX_TOKENS,
          model: HEDGEHOG_MODEL,
          effort: HEDGEHOG_EFFORT,
          tools: HEDGEHOG_TOOLS,
          toolChoice: { type: "auto" },
        },
      );

      newScratchpadEntries.push(...this.summariseLlmResponse(reason, response));

      for (const block of response.toolUseBlocks) {
        const handler = HEDGEHOG_HANDLERS.get(
          block.name as Parameters<typeof HEDGEHOG_HANDLERS.get>[0],
        );
        if (!handler) {
          log.warn("unknown tool name from hedgehog", { name: block.name });
          newScratchpadEntries.push({
            ts: new Date().toISOString(),
            kind: "decision",
            summary: `Ignored unknown tool ${block.name}`,
          });
          continue;
        }
        const result = await handler.handle(context, block, deps);
        newScratchpadEntries.push({
          ts: new Date().toISOString(),
          kind: "decision",
          summary: result.scratchpadSummary,
        });
      }

      // Free-form text from the model also gets a single scratchpad note so
      // the next tick can see her reasoning.
      const combinedText = response.textBlocks
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .join("\n");
      if (combinedText.length > 0) {
        this.writeNestMessage(nestId, {
          kind: "hedgehog_message",
          body: combinedText,
          visibility: "summary",
          payloadJson: { tickReason: reason, stopReason: response.stopReason },
        });
      }
    } catch (error) {
      log.error("tick body errored", { nestId, reason, error });
      newScratchpadEntries.push({
        ts: new Date().toISOString(),
        kind: "observation",
        summary: `Tick errored: ${stringifyError(error)}`,
      });
      this.writeNestMessage(nestId, {
        kind: "audit",
        body: `Hedgehog tick errored: ${stringifyError(error)}`,
        visibility: "summary",
        payloadJson: { tickReason: reason, type: "tick_error" },
      });
    } finally {
      const scratchpad = this.loadScratchpad(nestId);
      const nextScratchpad = appendScratchpad(scratchpad, newScratchpadEntries);
      const lastTickAt = new Date().toISOString();
      this.stateRepo.upsert({
        nestId,
        state: "idle",
        lastTickAt,
        serializedStateJson: JSON.stringify({ scratchpad: nextScratchpad }),
      });
      this.nestService.emitHedgehogTick(nestId, {
        state: "idle",
        lastTickAt,
      });
    }
  }

  private buildHandlerDeps(): HedgehogToolDeps {
    return {
      cloudTasks: this.cloudTasks,
      prGraph: this.prGraph,
      feedbackRouting: this.feedbackRouting,
      hogletService: this.hogletService,
      writeNestMessage: (nestId, input) => this.writeNestMessage(nestId, input),
    };
  }

  private async buildContext(
    nest: Nest,
    budget: TickBudget,
  ): Promise<TickContext> {
    const loadout = parseLoadout(nest.loadoutJson);
    const hoglets = this.hogletService
      .list({ nestId: nest.id })
      .filter((h): h is Hoglet => !h.deletedAt);
    const enriched: HogletWithState[] = [];
    const prStateCache = new Map<string, HogletPrState>();
    for (const hoglet of hoglets) {
      try {
        const { latestRun } = await this.cloudTasks.getTaskWithLatestRun(
          hoglet.taskId,
        );
        const prUrlCandidate = latestRun?.output?.pr_url;
        const prUrl =
          typeof prUrlCandidate === "string" && prUrlCandidate.length > 0
            ? prUrlCandidate
            : null;
        const prState = prUrl
          ? await this.resolvePrState(prUrl, prStateCache)
          : null;
        enriched.push({
          hoglet,
          taskRunStatus: latestRun?.status ?? "no_run",
          latestRunId: latestRun?.id ?? null,
          branch: latestRun?.branch ?? null,
          prUrl,
          prState,
        });
      } catch (error) {
        log.warn("could not load task state — flagging as unknown", {
          taskId: hoglet.taskId,
          error: stringifyError(error),
        });
        enriched.push({
          hoglet,
          taskRunStatus: "unknown",
          latestRunId: null,
          branch: null,
          prUrl: null,
          prState: null,
        });
      }
    }
    const prDeps = this.prDependencies.listForNest(nest.id);
    return { nest, hoglets: enriched, budget, prDependencies: prDeps, loadout };
  }

  private async resolvePrState(
    prUrl: string,
    cache: Map<string, HogletPrState>,
  ): Promise<HogletPrState> {
    const cached = cache.get(prUrl);
    if (cached !== undefined) return cached;
    try {
      const status = await this.git.getPrDetailsByUrl(prUrl);
      const resolved: HogletPrState = status
        ? status.merged
          ? "merged"
          : status.draft
            ? "draft"
            : status.state === "closed"
              ? "closed"
              : "open"
        : "unknown";
      cache.set(prUrl, resolved);
      return resolved;
    } catch (error) {
      log.debug("getPrDetailsByUrl failed inside hedgehog tick", {
        prUrl,
        error: stringifyError(error),
      });
      cache.set(prUrl, "unknown");
      return "unknown";
    }
  }

  private loadScratchpad(nestId: string): ScratchpadEntry[] {
    const row = this.stateRepo.findByNestId(nestId);
    if (!row?.serializedStateJson) return [];
    try {
      const parsed = JSON.parse(row.serializedStateJson) as {
        scratchpad?: ScratchpadEntry[];
      };
      return Array.isArray(parsed.scratchpad) ? parsed.scratchpad : [];
    } catch (error) {
      log.warn("scratchpad json corrupt, ignoring", { nestId, error });
      return [];
    }
  }

  private summariseLlmResponse(
    reason: string,
    response: PromptWithToolsOutput,
  ): ScratchpadEntry[] {
    return [
      {
        ts: new Date().toISOString(),
        kind: "observation",
        summary: `Tick ran (reason=${reason}, model=${response.model}, stop=${response.stopReason ?? "?"}, tools=${response.toolUseBlocks.length}, in=${response.usage.inputTokens}, out=${response.usage.outputTokens}).`,
      },
    ];
  }

  private writeNestMessage(nestId: string, input: WriteNestMessageInput): void {
    const message = this.nestChat.recordHedgehogMessage({
      nestId,
      kind: input.kind,
      body: input.body,
      visibility: input.visibility ?? "summary",
      sourceTaskId: input.sourceTaskId ?? null,
      payloadJson: input.payloadJson ?? null,
    });
    this.nestService.emitMessageAppended(message);
  }
}
