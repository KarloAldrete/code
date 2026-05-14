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

import type { BuilderStateRepository } from "../../db/repositories/builder-state-repository";
import type {
  NestMessage,
  NestMessageRepository,
} from "../../db/repositories/nest-message-repository";
import type {
  NestRepository,
  Nest as NestRow,
} from "../../db/repositories/nest-repository";
import type {
  Overlap,
  OverlapRepository,
} from "../../db/repositories/overlap-repository";
import type {
  PrDependency,
  PrDependencyRepository,
} from "../../db/repositories/pr-dependency-repository";
import type {
  Proposal,
  ProposalRepository,
} from "../../db/repositories/proposal-repository";
import { BuilderTickService } from "./builder-tick-service";

function makeNest(overrides: Partial<NestRow> = {}): NestRow {
  return {
    id: `nest-${crypto.randomUUID().slice(0, 8)}`,
    name: "Nest",
    goalPrompt: "",
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

interface Mocks {
  nests: NestRepository;
  nestMessages: NestMessageRepository;
  prDependencies: PrDependencyRepository;
  overlaps: OverlapRepository & { _rows: Overlap[] };
  proposals: ProposalRepository & { _rows: Proposal[] };
  builderState: BuilderStateRepository;
}

function makeMocks(setup: {
  nests: NestRow[];
  prDependencies?: PrDependency[];
  messagesByNest?: Record<string, Array<Partial<NestMessage>>>;
  builderConfig?: Record<string, unknown>;
}): Mocks {
  const overlapRows: Overlap[] = [];
  const proposalRows: Proposal[] = [];
  const nests = {
    findAll: vi.fn(() => setup.nests),
    findById: vi.fn(
      (id: string) => setup.nests.find((n) => n.id === id) ?? null,
    ),
  } as unknown as NestRepository;
  const nestMessages = {
    listByNestId: vi.fn((nestId: string) => {
      const seeds = setup.messagesByNest?.[nestId] ?? [];
      return seeds.map((seed) => ({
        id: seed.id ?? crypto.randomUUID(),
        nestId,
        kind: seed.kind ?? "audit",
        visibility: seed.visibility ?? "summary",
        sourceTaskId: seed.sourceTaskId ?? null,
        body: seed.body ?? "",
        payloadJson: seed.payloadJson ?? null,
        createdAt: seed.createdAt ?? "2026-05-13T00:00:00.000Z",
      })) as NestMessage[];
    }),
  } as unknown as NestMessageRepository;
  const prDependencies = {
    listForNest: vi.fn((nestId: string) =>
      (setup.prDependencies ?? []).filter((d) => d.nestId === nestId),
    ),
  } as unknown as PrDependencyRepository;
  const overlaps = {
    _rows: overlapRows,
    upsertOpen: vi.fn(
      (data: Parameters<OverlapRepository["upsertOpen"]>[0]) => {
        const [a, b] =
          data.nestAId < data.nestBId
            ? [data.nestAId, data.nestBId]
            : [data.nestBId, data.nestAId];
        const existing = overlapRows.find(
          (r) =>
            r.nestAId === a &&
            r.nestBId === b &&
            r.kind === data.kind &&
            r.resolvedAt === null,
        );
        if (existing) {
          existing.score = data.score;
          existing.evidenceJson = data.evidenceJson;
          existing.lastSeenAt = new Date().toISOString();
          return existing;
        }
        const row: Overlap = {
          id: `ov-${crypto.randomUUID().slice(0, 8)}`,
          nestAId: a,
          nestBId: b,
          kind: data.kind,
          score: data.score,
          evidenceJson: data.evidenceJson,
          firstSeenAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          resolvedAt: null,
        };
        overlapRows.push(row);
        return row;
      },
    ),
    resolveStaleBefore: vi.fn(() => 0),
    listOpen: vi.fn(() => overlapRows.filter((r) => r.resolvedAt === null)),
    listAll: vi.fn(() => overlapRows),
    resolve: vi.fn((id: string) => {
      const row = overlapRows.find((r) => r.id === id);
      if (row) row.resolvedAt = new Date().toISOString();
    }),
    findOpenForPair: vi.fn(),
  } as unknown as OverlapRepository & { _rows: Overlap[] };
  const proposals = {
    _rows: proposalRows,
    insert: vi.fn((data: Parameters<ProposalRepository["insert"]>[0]) => {
      const row: Proposal = {
        id: `prop-${crypto.randomUUID().slice(0, 8)}`,
        kind: data.kind,
        primaryNestId: data.primaryNestId ?? null,
        secondaryNestId: data.secondaryNestId ?? null,
        hogletId: data.hogletId ?? null,
        signalReportId: data.signalReportId ?? null,
        evidenceJson: data.evidenceJson,
        status: data.status ?? "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolvedAt: null,
      };
      proposalRows.push(row);
      return row;
    }),
    findOpenByKindAndPair: vi.fn(
      (
        kind: Proposal["kind"],
        primaryNestId: string,
        secondaryNestId: string | null,
      ) =>
        proposalRows.find(
          (p) =>
            p.kind === kind &&
            p.status === "open" &&
            ((p.primaryNestId === primaryNestId &&
              p.secondaryNestId === secondaryNestId) ||
              (p.primaryNestId === secondaryNestId &&
                p.secondaryNestId === primaryNestId)),
        ) ?? null,
    ),
    listOpen: vi.fn(() => proposalRows.filter((p) => p.status === "open")),
    listAll: vi.fn(() => proposalRows),
    findById: vi.fn(
      (id: string) => proposalRows.find((p) => p.id === id) ?? null,
    ),
    updateStatus: vi.fn(),
  } as unknown as ProposalRepository & { _rows: Proposal[] };
  const builderState = {
    get: vi.fn(() =>
      setup.builderConfig
        ? {
            id: "builder",
            lastTickAt: null,
            configJson: JSON.stringify(setup.builderConfig),
            createdAt: "",
            updatedAt: "",
          }
        : null,
    ),
    upsert: vi.fn(() => ({
      id: "builder",
      lastTickAt: null,
      configJson: null,
      createdAt: "",
      updatedAt: "",
    })),
  } as unknown as BuilderStateRepository;
  return {
    nests,
    nestMessages,
    prDependencies,
    overlaps,
    proposals,
    builderState,
  };
}

function buildService(mocks: Mocks): BuilderTickService {
  return new BuilderTickService(
    mocks.nests,
    mocks.nestMessages,
    mocks.prDependencies,
    mocks.overlaps,
    mocks.proposals,
    mocks.builderState,
  );
}

describe("BuilderTickService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is inert when fewer than two active nests exist", async () => {
    const mocks = makeMocks({ nests: [makeNest({ id: "a" })] });
    const service = buildService(mocks);
    await service.tick();
    expect(mocks.overlaps.upsertOpen).not.toHaveBeenCalled();
    expect(mocks.proposals.insert).not.toHaveBeenCalled();
  });

  it("writes a pr_graph overlap when two nests share a task in the dependency graph", async () => {
    const a = makeNest({ id: "a" });
    const b = makeNest({ id: "b" });
    const sharedTask = "task-shared";
    const mocks = makeMocks({
      nests: [a, b],
      prDependencies: [
        {
          id: "e1",
          nestId: "a",
          parentTaskId: sharedTask,
          childTaskId: "task-a-child",
          state: "pending",
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "e2",
          nestId: "b",
          parentTaskId: "task-b-parent",
          childTaskId: sharedTask,
          state: "pending",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    const service = buildService(mocks);
    await service.tick();
    expect(mocks.overlaps._rows).toHaveLength(1);
    expect(mocks.overlaps._rows[0].kind).toBe("pr_graph");
  });

  it("does not propose merge until streak reaches mergeProposeAfterTicks", async () => {
    const a = makeNest({ id: "a" });
    const b = makeNest({ id: "b" });
    const sharedTask = "task-shared";
    const mocks = makeMocks({
      nests: [a, b],
      prDependencies: [
        {
          id: "e1",
          nestId: "a",
          parentTaskId: sharedTask,
          childTaskId: "ax",
          state: "pending",
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "e2",
          nestId: "b",
          parentTaskId: sharedTask,
          childTaskId: "bx",
          state: "pending",
          createdAt: "",
          updatedAt: "",
        },
      ],
      builderConfig: { mergeProposeAfterTicks: 3 },
    });
    const service = buildService(mocks);
    service.setConfig({ mergeProposeAfterTicks: 3 });

    await service.tick();
    expect(mocks.proposals.insert).not.toHaveBeenCalled();
    await service.tick();
    expect(mocks.proposals.insert).not.toHaveBeenCalled();
    await service.tick();
    expect(mocks.proposals.insert).toHaveBeenCalledTimes(1);
    const inserted = (mocks.proposals.insert as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(inserted.kind).toBe("merge");
    expect(inserted.primaryNestId).toBe("a");
    expect(inserted.secondaryNestId).toBe("b");
  });

  it("dedupes: does not propose merge a second time while an open merge proposal exists", async () => {
    const a = makeNest({ id: "a" });
    const b = makeNest({ id: "b" });
    const mocks = makeMocks({
      nests: [a, b],
      prDependencies: [
        {
          id: "e1",
          nestId: "a",
          parentTaskId: "t-shared",
          childTaskId: "ax",
          state: "pending",
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "e2",
          nestId: "b",
          parentTaskId: "t-shared",
          childTaskId: "bx",
          state: "pending",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    const service = buildService(mocks);
    service.setConfig({ mergeProposeAfterTicks: 1 });

    await service.tick();
    expect(mocks.proposals.insert).toHaveBeenCalledTimes(1);
    await service.tick();
    expect(mocks.proposals.insert).toHaveBeenCalledTimes(1);
  });

  it("records chat_xref overlap when one nest's chat mentions the other nest's name", async () => {
    const a = makeNest({ id: "a", name: "Alpha" });
    const b = makeNest({ id: "b", name: "Beta" });
    const mocks = makeMocks({
      nests: [a, b],
      messagesByNest: {
        a: [{ body: "We should coordinate with Beta on this work." }],
      },
    });
    const service = buildService(mocks);
    await service.tick();
    const xref = mocks.overlaps._rows.find((r) => r.kind === "chat_xref");
    expect(xref).toBeDefined();
  });

  it("skips merged-into nests", async () => {
    const a = makeNest({ id: "a" });
    const b = makeNest({ id: "b", mergedIntoId: "a", status: "dormant" });
    const c = makeNest({ id: "c" });
    const mocks = makeMocks({ nests: [a, b, c] });
    const service = buildService(mocks);
    await service.tick();
    // With only 2 effective active nests (a, c) and no overlapping evidence,
    // nothing gets written.
    expect(mocks.overlaps.upsertOpen).not.toHaveBeenCalled();
  });
});
