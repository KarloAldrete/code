import { inject, injectable } from "inversify";
import type { HogletRepository } from "../../db/repositories/hoglet-repository";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import { TypedEventEmitter } from "../../utils/typed-event-emitter";
import {
  type AdoptHogletInput,
  HedgemonyEvent,
  type HedgemonyEvents,
  type Hoglet,
  type HogletWatchEvent,
  type ListHogletsInput,
  type RecordAdhocHogletInput,
  type ReleaseHogletInput,
} from "./schemas";

const log = logger.scope("hoglet-service");

/** Safety cap from notes/hedgemony/backend-integration.md. */
export const MAX_WILD_HOGLETS = 25;

/**
 * Owns the `hedgemony_hoglet` sidecar invariant. Hoglet creation is anchored
 * on cloud Task creation (driven by the renderer's TaskCreationSaga); this
 * service writes only the local sidecar row + emits an event. Chat/audit
 * is intentionally not coupled here — observers narrate creation later.
 */
@injectable()
export class HogletService extends TypedEventEmitter<HedgemonyEvents> {
  constructor(
    @inject(MAIN_TOKENS.HogletRepository)
    private readonly hoglets: HogletRepository,
  ) {
    super();
  }

  list(input: ListHogletsInput): Hoglet[] {
    if (input.wildOnly) return this.hoglets.findAllWild();
    if (input.nestId) return this.hoglets.findAllForNest(input.nestId);
    throw new Error("hoglets.list requires wildOnly or nestId");
  }

  recordAdhoc(input: RecordAdhocHogletInput): Hoglet {
    const existing = this.hoglets.findByTaskId(input.taskId);
    if (existing) {
      log.warn("Adhoc hoglet already exists for taskId", {
        taskId: input.taskId,
        hogletId: existing.id,
      });
      return existing;
    }

    const wildCount = this.hoglets.countWild();
    if (wildCount >= MAX_WILD_HOGLETS) {
      throw new Error("wild_hoglet_cap_reached");
    }

    const created = this.hoglets.create({
      taskId: input.taskId,
      nestId: null,
      signalReportId: null,
    });
    log.info("Adhoc hoglet recorded", {
      id: created.id,
      taskId: created.taskId,
    });
    this.emitChange(null, { kind: "upsert", hoglet: created });
    return created;
  }

  adopt(input: AdoptHogletInput): Hoglet {
    const existing = this.hoglets.findById(input.hogletId);
    if (!existing) throw new Error("hoglet_not_found");
    if (existing.deletedAt) throw new Error("hoglet_deleted");
    if (existing.nestId === input.nestId) return existing;
    if (existing.nestId !== null) {
      // Slice-3 scope: nest→nest direct transfer is deferred. Future slices
      // add PR dependency edges and hedgehog scratchpad state that would need
      // explicit migration; operator must release first.
      throw new Error("hoglet_already_adopted");
    }

    const updated = this.hoglets.update(input.hogletId, {
      nestId: input.nestId,
    });
    if (!updated) throw new Error("hoglet_update_failed");

    // Old bucket is wild (signal-backed hoglets get their own bucket kind in
    // Slice 4, but Slice 3 hoglets always have signal_report_id = null).
    this.emitChange(null, { kind: "removed", hogletId: updated.id });
    this.emitChange(updated.nestId, { kind: "upsert", hoglet: updated });
    log.info("Hoglet adopted", { id: updated.id, nestId: updated.nestId });
    return updated;
  }

  release(input: ReleaseHogletInput): Hoglet {
    const existing = this.hoglets.findById(input.hogletId);
    if (!existing) throw new Error("hoglet_not_found");
    if (existing.deletedAt) throw new Error("hoglet_deleted");
    if (existing.nestId === null) return existing;

    const previousNestId = existing.nestId;
    const updated = this.hoglets.update(input.hogletId, { nestId: null });
    if (!updated) throw new Error("hoglet_update_failed");

    this.emitChange(previousNestId, {
      kind: "removed",
      hogletId: updated.id,
    });
    // TODO(slice-4): signal-backed hoglets re-enter their own staging bucket,
    // not the wild bucket. Slice 3 only handles wild ↔ nest.
    this.emitChange(null, { kind: "upsert", hoglet: updated });
    log.info("Hoglet released", { id: updated.id, fromNest: previousNestId });
    return updated;
  }

  private emitChange(nestId: string | null, event: HogletWatchEvent): void {
    this.emit(HedgemonyEvent.HogletChanged, { nestId, event });
  }
}
