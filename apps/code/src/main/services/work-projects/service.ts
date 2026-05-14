import type {
  CreateProjectInput,
  NewTileInput,
  ProjectIconId,
  Tile,
  TileSize,
  WorkProject,
  WorkProjectsEvents,
} from "@shared/types/work-projects";
import Store from "electron-store";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { getUserDataDir } from "../../utils/env";
import { logger } from "../../utils/logger";
import { TypedEventEmitter } from "../../utils/typed-event-emitter";
import type { LlmGatewayService } from "../llm-gateway/service";
import { SEED_PROJECTS } from "./seeds";

const log = logger.scope("work-projects-service");

const PROJECT_ICONS = [
  "rocket",
  "microphone",
  "megaphone",
  "lightbulb",
  "compass",
  "target",
  "flask",
] as const satisfies readonly ProjectIconId[];

const AUTO_NAME_SYSTEM = `You name PostHog Code projects. Given the user's
opening prompt, reply with ONLY a JSON object — no prose, no markdown — with
keys: "name" (≤3 words, Title Case), "tagline" (≤8 words, sentence case, no
trailing period), "iconId" (one of: rocket, microphone, megaphone, lightbulb,
compass, target, flask — pick the closest match for the topic).`;

interface WorkProjectsStoreSchema {
  seeded: boolean;
  projects: Record<string, WorkProject>;
  /** Stable ordering of project ids (newest first when user-created). */
  order: string[];
}

function newId(prefix: string): string {
  const rand =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${rand}`;
}

function defaultSizeFor(type: NewTileInput["type"]): TileSize {
  switch (type) {
    case "title":
      return "full";
    case "headline":
      return "md";
    case "insight":
      return "md";
    case "file":
      return "md";
    case "skill_output":
      return "md";
    case "note":
      return "sm";
  }
}

@injectable()
export class WorkProjectsService extends TypedEventEmitter<WorkProjectsEvents> {
  private readonly store: Store<WorkProjectsStoreSchema>;

  constructor(
    @inject(MAIN_TOKENS.LlmGatewayService)
    private readonly llmGateway: LlmGatewayService,
  ) {
    super();
    this.store = new Store<WorkProjectsStoreSchema>({
      name: "work-projects",
      cwd: getUserDataDir(),
      defaults: { seeded: false, projects: {}, order: [] },
    });

    this.ensureSeeded();
  }

  private async deriveProjectMeta(fromPrompt: string): Promise<{
    name: string;
    tagline: string;
    iconId: ProjectIconId;
  } | null> {
    try {
      const result = await this.llmGateway.prompt(
        [{ role: "user", content: fromPrompt }],
        {
          system: AUTO_NAME_SYSTEM,
          model: "claude-haiku-4-5",
          maxTokens: 150,
        },
      );
      const raw = result.content.trim();
      // Tolerate accidental markdown fences.
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start < 0 || end <= start) return null;
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
        name?: unknown;
        tagline?: unknown;
        iconId?: unknown;
      };
      const name =
        typeof parsed.name === "string" && parsed.name.trim().length > 0
          ? parsed.name.trim().slice(0, 48)
          : null;
      const tagline =
        typeof parsed.tagline === "string" && parsed.tagline.trim().length > 0
          ? parsed.tagline.trim().replace(/\.+$/, "").slice(0, 80)
          : null;
      const iconId =
        typeof parsed.iconId === "string" &&
        (PROJECT_ICONS as readonly string[]).includes(parsed.iconId)
          ? (parsed.iconId as ProjectIconId)
          : null;
      if (!name || !tagline || !iconId) return null;
      return { name, tagline, iconId };
    } catch (error) {
      log.warn("Auto-name LLM call failed", { error });
      return null;
    }
  }

  private ensureSeeded(): void {
    if (this.store.get("seeded")) return;
    const projects: Record<string, WorkProject> = {};
    const order: string[] = [];
    for (const p of SEED_PROJECTS) {
      projects[p.id] = p;
      order.push(p.id);
    }
    this.store.set("projects", projects);
    this.store.set("order", order);
    this.store.set("seeded", true);
    log.info("Seeded work projects", { count: order.length });
  }

  private getProjects(): Record<string, WorkProject> {
    return this.store.get("projects");
  }

  private getOrder(): string[] {
    return this.store.get("order");
  }

  private persist(
    projects: Record<string, WorkProject>,
    order: string[],
  ): void {
    this.store.set("projects", projects);
    this.store.set("order", order);
  }

  private emitProjectChanged(projectId: string): void {
    this.emit("project-changed", { projectId });
    this.emit("projects-changed", undefined);
  }

  private mutateProject(
    projectId: string,
    mutator: (project: WorkProject) => WorkProject | null,
  ): WorkProject | null {
    const projects = { ...this.getProjects() };
    const current = projects[projectId];
    if (!current) {
      log.warn("Project not found", { projectId });
      return null;
    }
    const next = mutator(current);
    if (!next) return current;
    const stamped: WorkProject = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    projects[projectId] = stamped;
    this.persist(projects, this.getOrder());
    this.emitProjectChanged(projectId);
    return stamped;
  }

  list(): WorkProject[] {
    const projects = this.getProjects();
    const order = this.getOrder();
    return order.map((id) => projects[id]).filter((p): p is WorkProject => !!p);
  }

  get(projectId: string): WorkProject | null {
    return this.getProjects()[projectId] ?? null;
  }

  async create(input: CreateProjectInput): Promise<WorkProject> {
    const id = newId("project");
    const now = new Date().toISOString();
    const trimmedPrompt = input.fromPrompt?.trim();

    // Default values first; if we have a starter prompt, ask the LLM gateway
    // for a derived name/tagline/icon and overlay them. Falls back gracefully.
    let name = input.name?.trim() || "Untitled project";
    let tagline = input.tagline?.trim() || "Just started";
    let iconId: ProjectIconId = input.iconId ?? "lightbulb";

    if (trimmedPrompt && !input.name && !input.tagline) {
      const derived = await this.deriveProjectMeta(trimmedPrompt);
      if (derived) {
        name = derived.name;
        tagline = derived.tagline;
        iconId = derived.iconId;
        log.info("Auto-named project from prompt", { id, name, iconId });
      }
    }

    const titleTile: Tile = {
      id: newId("tile"),
      type: "title",
      size: "full",
      state: "live",
      origin: "seed",
      iconId,
      name,
      tagline,
    };

    const project: WorkProject = {
      id,
      name,
      tagline,
      iconId,
      members: [],
      tiles: [titleTile],
      createdAt: now,
      updatedAt: now,
      ...(trimmedPrompt ? { pendingPrompt: trimmedPrompt } : {}),
    };

    const projects = { ...this.getProjects(), [id]: project };
    const order = [id, ...this.getOrder()];
    this.persist(projects, order);
    this.emitProjectChanged(id);
    return project;
  }

  setNextSteps(projectId: string, prompts: string[]): WorkProject | null {
    return this.mutateProject(projectId, (project) => {
      const cleaned = prompts
        .map((p) => (typeof p === "string" ? p.trim() : ""))
        .filter((p) => p.length > 0)
        .slice(0, 3);
      if (cleaned.length === 0) {
        if (!project.nextSteps) return null;
        const { nextSteps: _drop, ...rest } = project;
        return rest as WorkProject;
      }
      return { ...project, nextSteps: cleaned };
    });
  }

  clearNextSteps(projectId: string): WorkProject | null {
    return this.mutateProject(projectId, (project) => {
      if (!project.nextSteps) return null;
      const { nextSteps: _drop, ...rest } = project;
      return rest as WorkProject;
    });
  }

  clearPendingPrompt(projectId: string): WorkProject | null {
    return this.mutateProject(projectId, (project) => {
      if (!project.pendingPrompt) return null;
      const { pendingPrompt: _drop, ...rest } = project;
      return rest as WorkProject;
    });
  }

  delete(projectId: string): void {
    const projects = { ...this.getProjects() };
    if (!projects[projectId]) return;
    delete projects[projectId];
    const order = this.getOrder().filter((id) => id !== projectId);
    this.persist(projects, order);
    this.emit("projects-changed", undefined);
  }

  addTile(
    projectId: string,
    input: NewTileInput,
    options: { state?: Tile["state"]; origin?: Tile["origin"] } = {},
  ): WorkProject | null {
    return this.mutateProject(projectId, (project) => {
      const tile: Tile = {
        ...input,
        id: newId("tile"),
        size: input.size ?? defaultSizeFor(input.type),
        state: options.state ?? "live",
        origin: options.origin ?? "user",
      } as Tile;
      return { ...project, tiles: [...project.tiles, tile] };
    });
  }

  removeTile(projectId: string, tileId: string): WorkProject | null {
    return this.mutateProject(projectId, (project) => {
      const tiles = project.tiles.filter((t) => t.id !== tileId);
      if (tiles.length === project.tiles.length) return null;
      return { ...project, tiles };
    });
  }

  updateTileSize(
    projectId: string,
    tileId: string,
    size: TileSize,
  ): WorkProject | null {
    return this.mutateProject(projectId, (project) => {
      const tiles = project.tiles.map((t) =>
        t.id === tileId ? ({ ...t, size } as Tile) : t,
      );
      return { ...project, tiles };
    });
  }

  moveTile(
    projectId: string,
    tileId: string,
    toIndex: number,
  ): WorkProject | null {
    return this.mutateProject(projectId, (project) => {
      const fromIndex = project.tiles.findIndex((t) => t.id === tileId);
      if (fromIndex < 0) return null;
      const clampedIndex = Math.max(
        0,
        Math.min(toIndex, project.tiles.length - 1),
      );
      if (fromIndex === clampedIndex) return null;
      const tiles = project.tiles.slice();
      const [moved] = tiles.splice(fromIndex, 1);
      tiles.splice(clampedIndex, 0, moved);
      return { ...project, tiles };
    });
  }

  updateTitleTile(
    projectId: string,
    patch: { name?: string; tagline?: string; iconId?: WorkProject["iconId"] },
  ): WorkProject | null {
    return this.mutateProject(projectId, (project) => {
      let mutated = false;
      const tiles = project.tiles.map((t) => {
        if (t.type !== "title") return t;
        mutated = true;
        const next = { ...t };
        if (patch.name !== undefined) next.name = patch.name;
        if (patch.tagline !== undefined) next.tagline = patch.tagline;
        if (patch.iconId !== undefined) next.iconId = patch.iconId;
        return next;
      });
      if (!mutated) return null;
      const projectPatch: Partial<WorkProject> = {};
      if (patch.name !== undefined) projectPatch.name = patch.name;
      if (patch.tagline !== undefined) projectPatch.tagline = patch.tagline;
      if (patch.iconId !== undefined) projectPatch.iconId = patch.iconId;
      return { ...project, ...projectPatch, tiles };
    });
  }

  updateNoteTile(
    projectId: string,
    tileId: string,
    patch: {
      body?: string;
      tone?: "yellow" | "blue" | "green" | "pink" | "neutral";
    },
  ): WorkProject | null {
    return this.mutateProject(projectId, (project) => {
      const tiles = project.tiles.map((t) => {
        if (t.id !== tileId || t.type !== "note") return t;
        return {
          ...t,
          ...(patch.body !== undefined ? { body: patch.body } : {}),
          ...(patch.tone !== undefined ? { tone: patch.tone } : {}),
        };
      });
      return { ...project, tiles };
    });
  }

  updateFileTile(
    projectId: string,
    tileId: string,
    patch: { filename?: string; contents?: string },
  ): WorkProject | null {
    return this.mutateProject(projectId, (project) => {
      const tiles = project.tiles.map((t) => {
        if (t.id !== tileId || t.type !== "file") return t;
        return {
          ...t,
          ...(patch.filename !== undefined ? { filename: patch.filename } : {}),
          ...(patch.contents !== undefined ? { contents: patch.contents } : {}),
        };
      });
      return { ...project, tiles };
    });
  }

  applyPending(projectId: string, tileId: string): WorkProject | null {
    return this.mutateProject(projectId, (project) => {
      const tile = project.tiles.find((t) => t.id === tileId);
      if (!tile) return null;
      if (tile.state === "pending_remove") {
        return {
          ...project,
          tiles: project.tiles.filter((t) => t.id !== tileId),
        };
      }
      if (tile.state === "pending_add" || tile.state === "pending_edit") {
        return {
          ...project,
          tiles: project.tiles.map((t) =>
            t.id === tileId ? ({ ...t, state: "live" } as Tile) : t,
          ),
        };
      }
      return null;
    });
  }

  rejectPending(projectId: string, tileId: string): WorkProject | null {
    return this.mutateProject(projectId, (project) => {
      const tile = project.tiles.find((t) => t.id === tileId);
      if (!tile) return null;
      if (tile.state === "pending_add") {
        return {
          ...project,
          tiles: project.tiles.filter((t) => t.id !== tileId),
        };
      }
      if (tile.state === "pending_remove" || tile.state === "pending_edit") {
        return {
          ...project,
          tiles: project.tiles.map((t) =>
            t.id === tileId ? ({ ...t, state: "live" } as Tile) : t,
          ),
        };
      }
      return null;
    });
  }

  /** Test-only helper. */
  resetForTest(): void {
    this.store.clear();
    this.ensureSeeded();
  }
}
