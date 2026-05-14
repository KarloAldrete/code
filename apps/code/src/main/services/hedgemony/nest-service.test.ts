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

import type { NestRepository } from "../../db/repositories/nest-repository";
import type { NestChatService } from "./nest-chat-service";
import { NestService } from "./nest-service";
import { HedgemonyEvent, type Nest } from "./schemas";

type NestPatch = Parameters<NestRepository["update"]>[1];
type CreateNestData = Parameters<NestRepository["create"]>[0];

function makeNest(overrides: Partial<Nest> = {}): Nest {
  const now = "2026-05-13T00:00:00.000Z";
  return {
    id: crypto.randomUUID(),
    name: "Checkout lift",
    goalPrompt: "Improve checkout conversion",
    definitionOfDone: null,
    mapX: 0,
    mapY: 0,
    status: "active",
    health: "ok",
    targetMetricId: null,
    loadoutJson: "{}",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMockNestRepository() {
  const nests = new Map<string, Nest>();

  const repo = {
    _nests: nests,
    findById: vi.fn((id: string) => nests.get(id) ?? null),
    findAll: vi.fn(() => [...nests.values()]),
    findAllVisible: vi.fn(() =>
      [...nests.values()].filter((nest) => nest.status !== "archived"),
    ),
    create: vi.fn((data: CreateNestData) => {
      const nest = makeNest({
        ...data,
        definitionOfDone: data.definitionOfDone ?? null,
      });
      nests.set(nest.id, nest);
      return nest;
    }),
    update: vi.fn((id: string, data: NestPatch) => {
      const existing = nests.get(id);
      if (!existing) return null;
      const updated = {
        ...existing,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      nests.set(id, updated);
      return updated;
    }),
    archive: vi.fn((id: string) => repo.update(id, { status: "archived" })),
    unarchive: vi.fn((id: string) => repo.update(id, { status: "active" })),
  };

  return repo as typeof repo & NestRepository;
}

function createMockNestChatService() {
  return {
    recordCreationContext: vi.fn(),
  } as unknown as NestChatService & {
    recordCreationContext: ReturnType<typeof vi.fn>;
  };
}

describe("NestService", () => {
  let nestRepository: ReturnType<typeof createMockNestRepository>;
  let nestChat: ReturnType<typeof createMockNestChatService>;
  let service: NestService;

  beforeEach(() => {
    nestRepository = createMockNestRepository();
    nestChat = createMockNestChatService();
    service = new NestService(nestRepository, nestChat);
  });

  it("creates a nest, records creation context, and emits a CRUD watch event", () => {
    const listener = vi.fn();
    service.on(HedgemonyEvent.NestChanged, listener);

    const input = {
      name: "Checkout lift",
      goalPrompt: "Improve checkout conversion",
      definitionOfDone: "Conversion improves and docs are updated",
      mapX: 42,
      mapY: -7,
      creationMode: "guided" as const,
    };

    const nest = service.create(input);

    expect(nestRepository.create).toHaveBeenCalledWith({
      name: input.name,
      goalPrompt: input.goalPrompt,
      definitionOfDone: input.definitionOfDone,
      mapX: input.mapX,
      mapY: input.mapY,
    });
    expect(nestChat.recordCreationContext).toHaveBeenCalledWith(nest, input);
    expect(nest).toMatchObject({
      name: "Checkout lift",
      goalPrompt: "Improve checkout conversion",
      definitionOfDone: "Conversion improves and docs are updated",
      mapX: 42,
      mapY: -7,
      status: "active",
      health: "ok",
      loadoutJson: "{}",
    });
    expect(listener).toHaveBeenCalledWith({
      nestId: nest.id,
      event: { kind: "status", nest },
    });
  });

  it("updates nest fields without recreating the row", () => {
    const nest = service.create({
      name: "Original",
      goalPrompt: "Original goal",
      mapX: 1,
      mapY: 2,
    });

    const updated = service.update({
      id: nest.id,
      name: "Renamed",
      goalPrompt: "Sharper goal",
      definitionOfDone: "Merged PRs cover the path",
      mapX: 10,
      mapY: 20,
    });

    expect(updated.id).toBe(nest.id);
    expect(updated).toMatchObject({
      name: "Renamed",
      goalPrompt: "Sharper goal",
      definitionOfDone: "Merged PRs cover the path",
      mapX: 10,
      mapY: 20,
    });
    expect(nestRepository.create).toHaveBeenCalledTimes(1);
    expect(service.get({ id: nest.id })).toEqual(updated);
  });

  it("archives by status, hides archived nests from list, and keeps history queryable", () => {
    const keep = service.create({
      name: "Keep",
      goalPrompt: "Keep active",
      mapX: 0,
      mapY: 0,
    });
    const archive = service.create({
      name: "Archive",
      goalPrompt: "Archive this",
      mapX: 1,
      mapY: 1,
    });

    const archived = service.archive({ id: archive.id });

    expect(archived.status).toBe("archived");
    expect(service.list().map((nest) => nest.id)).toEqual([keep.id]);
    expect(service.get({ id: archive.id })).toMatchObject({
      id: archive.id,
      status: "archived",
    });
  });

  it("unarchives a soft-archived nest", () => {
    const nest = service.create({
      name: "Archive",
      goalPrompt: "Archive this",
      mapX: 1,
      mapY: 1,
    });
    service.archive({ id: nest.id });

    expect(service.unarchive({ id: nest.id })).toMatchObject({
      id: nest.id,
      status: "active",
    });
  });

  it("throws when a nest lookup or mutation misses", () => {
    expect(() => service.get({ id: "missing" })).toThrowError(
      "Nest not found: missing",
    );
    expect(() => service.update({ id: "missing", name: "Nope" })).toThrowError(
      "Nest not found: missing",
    );
    expect(() => service.archive({ id: "missing" })).toThrowError(
      "Nest not found: missing",
    );
    expect(() => service.unarchive({ id: "missing" })).toThrowError(
      "Nest not found: missing",
    );
  });
});
