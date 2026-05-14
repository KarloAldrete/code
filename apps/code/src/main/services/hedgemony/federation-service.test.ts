import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/logger.js", () => ({
  logger: {
    scope: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

import type { BridgeRepository } from "../../db/repositories/bridge-repository";
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
import { MergeNestsSaga } from "./federation-service";

function makeNest(overrides: Partial<NestRow> = {}): NestRow {
  return {
    id: "nest-1",
    name: "Checkout lift",
    goalPrompt: "Improve checkout conversion.",
    definitionOfDone: null,
    mapX: 0,
    mapY: 0,
    status: "active",
    health: "ok",
    targetMetricId: null,
    loadoutJson: null,
    primaryRepository: null,
    mergedIntoId: null,
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
    ...overrides,
  };
}

function makeMockNestRepository(initial: NestRow[]): NestRepository & {
  _rows: Map<string, NestRow>;
} {
  const rows = new Map<string, NestRow>(initial.map((n) => [n.id, { ...n }]));
  const repo = {
    _rows: rows,
    findById: vi.fn((id: string) => rows.get(id) ?? null),
    findAll: vi.fn(() => [...rows.values()]),
    findAllVisible: vi.fn(() =>
      [...rows.values()].filter((n) => n.status !== "archived"),
    ),
    create: vi.fn(),
    update: vi.fn((id: string, patch: Partial<NestRow>) => {
      const existing = rows.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch };
      rows.set(id, updated);
      return updated;
    }),
    archive: vi.fn(),
    unarchive: vi.fn(),
  };
  return repo as unknown as NestRepository & { _rows: Map<string, NestRow> };
}

function makeMockHogletRepository(): HogletRepository & {
  _hoglets: Array<{ id: string; nestId: string | null }>;
} {
  const hoglets: Array<{ id: string; nestId: string | null }> = [
    { id: "h1", nestId: "nest-2" },
    { id: "h2", nestId: "nest-2" },
  ];
  const repo = {
    _hoglets: hoglets,
    findById: vi.fn(),
    findAllForNest: vi.fn((nestId: string) =>
      hoglets.filter((h) => h.nestId === nestId),
    ),
    update: vi.fn((id: string, patch: { nestId?: string | null }) => {
      const found = hoglets.find((h) => h.id === id);
      if (found && "nestId" in patch && patch.nestId !== undefined) {
        found.nestId = patch.nestId;
      }
      return found;
    }),
  };
  return repo as unknown as HogletRepository & {
    _hoglets: Array<{ id: string; nestId: string | null }>;
  };
}

function makeMockProposalRepository(initial?: Proposal): ProposalRepository & {
  _statuses: Map<string, string>;
} {
  const statuses = new Map<string, string>(
    initial ? [[initial.id, initial.status]] : [],
  );
  const repo = {
    _statuses: statuses,
    insert: vi.fn(),
    findById: vi.fn((id: string) => {
      if (!statuses.has(id)) return null;
      return {
        id,
        kind: "merge" as const,
        primaryNestId: null,
        secondaryNestId: null,
        hogletId: null,
        signalReportId: null,
        evidenceJson: "{}",
        status: statuses.get(id) as Proposal["status"],
        createdAt: "",
        updatedAt: "",
        resolvedAt: null,
      };
    }),
    findOpenByKindAndPair: vi.fn(() => null),
    listOpen: vi.fn(() => []),
    listAll: vi.fn(() => []),
    updateStatus: vi.fn((id: string, status: string) => {
      statuses.set(id, status);
      return {
        id,
        kind: "merge",
        primaryNestId: null,
        secondaryNestId: null,
        hogletId: null,
        signalReportId: null,
        evidenceJson: "{}",
        status,
        createdAt: "",
        updatedAt: "",
        resolvedAt: null,
      };
    }),
  };
  return repo as unknown as ProposalRepository & {
    _statuses: Map<string, string>;
  };
}

function makeMockNestMessageRepository(): NestMessageRepository & {
  _created: string[];
  _deleted: string[];
} {
  const created: string[] = [];
  const deleted: string[] = [];
  const repo = {
    _created: created,
    _deleted: deleted,
    listByNestId: vi.fn(() => []),
    create: vi.fn(() => {
      const id = `msg-${crypto.randomUUID().slice(0, 8)}`;
      created.push(id);
      return { id };
    }),
    deleteById: vi.fn((id: string) => {
      deleted.push(id);
    }),
    compactCompletedContext: vi.fn(),
  };
  return repo as unknown as NestMessageRepository & {
    _created: string[];
    _deleted: string[];
  };
}

describe("MergeNestsSaga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: rebinds hoglets, writes audit, tombstones secondary", async () => {
    const nests = makeMockNestRepository([
      makeNest({ id: "nest-1", name: "Primary" }),
      makeNest({ id: "nest-2", name: "Secondary" }),
    ]);
    const hoglets = makeMockHogletRepository();
    const proposals = makeMockProposalRepository();
    const nestMessages = makeMockNestMessageRepository();

    const saga = new MergeNestsSaga({
      nests,
      hoglets,
      bridges: {} as unknown as BridgeRepository,
      proposals,
      overlaps: {} as unknown as OverlapRepository,
      nestMessages,
    });

    const result = await saga.run({
      primaryNestId: "nest-1",
      secondaryNestId: "nest-2",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.movedHogletCount).toBe(2);
    expect(hoglets._hoglets.every((h) => h.nestId === "nest-1")).toBe(true);
    expect(nests._rows.get("nest-2")?.mergedIntoId).toBe("nest-1");
    expect(nests._rows.get("nest-2")?.status).toBe("dormant");
    expect(nestMessages._created).toHaveLength(1);
    expect(nestMessages._deleted).toHaveLength(0);
  });

  it("rolls back hoglet rebinds when tombstone step fails", async () => {
    const nests = makeMockNestRepository([
      makeNest({ id: "nest-1", name: "Primary" }),
      makeNest({ id: "nest-2", name: "Secondary" }),
    ]);
    const hoglets = makeMockHogletRepository();
    const proposals = makeMockProposalRepository();
    const nestMessages = makeMockNestMessageRepository();

    // Make `tombstone-secondary` blow up by failing the second `update` call.
    let updateCallCount = 0;
    nests.update = vi.fn((id: string, patch: Partial<NestRow>) => {
      updateCallCount++;
      if (updateCallCount === 1) {
        // This is the tombstone call — fail it.
        throw new Error("synthetic tombstone failure");
      }
      // Rollback calls all succeed.
      const existing = (
        nests as unknown as { _rows: Map<string, NestRow> }
      )._rows.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch };
      (nests as unknown as { _rows: Map<string, NestRow> })._rows.set(
        id,
        updated,
      );
      return updated;
    }) as NestRepository["update"];

    const saga = new MergeNestsSaga({
      nests,
      hoglets,
      bridges: {} as unknown as BridgeRepository,
      proposals,
      overlaps: {} as unknown as OverlapRepository,
      nestMessages,
    });

    const result = await saga.run({
      primaryNestId: "nest-1",
      secondaryNestId: "nest-2",
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.failedStep).toBe("tombstone-secondary");

    // Hoglets must be back where they started.
    expect(hoglets._hoglets.every((h) => h.nestId === "nest-2")).toBe(true);
    // The audit message must have been deleted (rollback).
    expect(nestMessages._deleted).toHaveLength(1);
  });

  it("refuses to merge an archived nest", async () => {
    const nests = makeMockNestRepository([
      makeNest({ id: "nest-1", status: "archived" }),
      makeNest({ id: "nest-2" }),
    ]);
    const saga = new MergeNestsSaga({
      nests,
      hoglets: makeMockHogletRepository(),
      bridges: {} as unknown as BridgeRepository,
      proposals: makeMockProposalRepository(),
      overlaps: {} as unknown as OverlapRepository,
      nestMessages: makeMockNestMessageRepository(),
    });

    const result = await saga.run({
      primaryNestId: "nest-1",
      secondaryNestId: "nest-2",
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.failedStep).toBe("validate-pair");
  });

  it("refuses to merge a nest into itself", async () => {
    const nests = makeMockNestRepository([makeNest({ id: "nest-1" })]);
    const saga = new MergeNestsSaga({
      nests,
      hoglets: makeMockHogletRepository(),
      bridges: {} as unknown as BridgeRepository,
      proposals: makeMockProposalRepository(),
      overlaps: {} as unknown as OverlapRepository,
      nestMessages: makeMockNestMessageRepository(),
    });
    const result = await saga.run({
      primaryNestId: "nest-1",
      secondaryNestId: "nest-1",
    });
    expect(result.success).toBe(false);
  });

  it("rolls back proposal status when proposalId step fails to commit", async () => {
    const nests = makeMockNestRepository([
      makeNest({ id: "nest-1" }),
      makeNest({ id: "nest-2" }),
    ]);
    const hoglets = makeMockHogletRepository();
    const proposals = makeMockProposalRepository({
      id: "prop-1",
      kind: "merge",
      primaryNestId: "nest-1",
      secondaryNestId: "nest-2",
      hogletId: null,
      signalReportId: null,
      evidenceJson: "{}",
      status: "open",
      createdAt: "",
      updatedAt: "",
      resolvedAt: null,
    });
    const nestMessages = makeMockNestMessageRepository();

    // Force the saga to fail after the proposal status update step: the
    // post-step `findById` returning null is the natural fail point.
    const realFindById = nests.findById;
    let primaryRefreshIntercepted = false;
    nests.findById = vi.fn((id: string) => {
      // Only intercept the *very last* findById call (the post-merge refresh
      // looking up the primary nest). At that point the proposal has been
      // updated; if we return null, the saga should bail and roll back the
      // proposal status change.
      if (
        !primaryRefreshIntercepted &&
        id === "nest-1" &&
        (
          proposals as unknown as { _statuses: Map<string, string> }
        )._statuses.get("prop-1") === "accepted"
      ) {
        primaryRefreshIntercepted = true;
        return null;
      }
      return realFindById(id);
    });

    const saga = new MergeNestsSaga({
      nests,
      hoglets,
      bridges: {} as unknown as BridgeRepository,
      proposals,
      overlaps: {} as unknown as OverlapRepository,
      nestMessages,
    });

    const result = await saga.run({
      primaryNestId: "nest-1",
      secondaryNestId: "nest-2",
      proposalId: "prop-1",
    });

    expect(result.success).toBe(false);
    // Proposal must have been rolled back to open.
    expect(proposals._statuses.get("prop-1")).toBe("open");
    // Hoglets rolled back.
    expect(hoglets._hoglets.every((h) => h.nestId === "nest-2")).toBe(true);
  });
});
