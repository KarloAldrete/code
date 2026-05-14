import { decrypt } from "../../utils/encryption";
import { logger } from "../../utils/logger";
import { rendererStore } from "../../utils/store";
import {
  clampReasoningEffortForAdapter,
  DEFAULT_HOGLET_ENVIRONMENT,
  DEFAULT_HOGLET_RUNTIME_ADAPTER,
  defaultModelForAdapter,
  defaultReasoningEffortForAdapter,
  type HedgemonyReasoningEffort,
  type HogletRuntimeAdapter,
  hedgemonyReasoningEffort,
  hogletRuntimeAdapter,
  modelIdentifierSchema,
  type NestLoadout,
  type PersistedExecutionMode,
  persistedExecutionModeSchema,
} from "./schemas";

const log = logger.scope("hoglet-runtime-preferences");

interface RendererSettingsState {
  lastUsedAdapter?: unknown;
  lastUsedModel?: unknown;
  lastUsedReasoningEffort?: unknown;
  defaultInitialTaskMode?: unknown;
  lastUsedInitialTaskMode?: unknown;
}

export interface UserTaskPreferences {
  runtimeAdapter?: HogletRuntimeAdapter;
  model?: string;
  reasoningEffort?: HedgemonyReasoningEffort;
  executionMode?: PersistedExecutionMode;
}

export interface ResolvedHogletRuntime {
  runtimeAdapter: HogletRuntimeAdapter;
  model: string;
  reasoningEffort: HedgemonyReasoningEffort;
  executionMode: PersistedExecutionMode;
  environment: "local" | "cloud";
}

export function readUserTaskPreferences(): UserTaskPreferences {
  if (!rendererStore.has("settings-storage")) return {};
  const encrypted = rendererStore.get("settings-storage");
  if (typeof encrypted !== "string") return {};
  const decrypted = decrypt(encrypted);
  if (!decrypted) return {};

  try {
    const parsed = JSON.parse(decrypted) as { state?: RendererSettingsState };
    const state = parsed.state ?? {};
    const runtimeAdapter = hogletRuntimeAdapter.safeParse(
      state.lastUsedAdapter,
    );
    const reasoningEffort = hedgemonyReasoningEffort.safeParse(
      state.lastUsedReasoningEffort,
    );
    const executionMode = resolvePreferredExecutionMode(
      state.defaultInitialTaskMode,
      state.lastUsedInitialTaskMode,
      runtimeAdapter.success ? runtimeAdapter.data : undefined,
    );
    const modelParse = modelIdentifierSchema.safeParse(state.lastUsedModel);
    if (!modelParse.success && state.lastUsedModel !== undefined) {
      log.warn("lastUsedModel rejected; using adapter default", {
        issues: modelParse.error.issues.map((issue) => issue.code),
      });
    }
    return {
      runtimeAdapter: runtimeAdapter.success ? runtimeAdapter.data : undefined,
      model: modelParse.success ? modelParse.data : undefined,
      reasoningEffort: reasoningEffort.success
        ? reasoningEffort.data
        : undefined,
      executionMode,
    };
  } catch {
    return {};
  }
}

export function resolveHogletRuntime(
  loadout: NestLoadout,
  preferences: UserTaskPreferences,
): ResolvedHogletRuntime {
  const runtimeAdapter =
    loadout.runtimeAdapter ??
    preferences.runtimeAdapter ??
    DEFAULT_HOGLET_RUNTIME_ADAPTER;
  const preferredModel =
    preferences.runtimeAdapter === runtimeAdapter
      ? preferences.model
      : undefined;
  const model =
    loadout.model ?? preferredModel ?? defaultModelForAdapter(runtimeAdapter);
  const reasoningEffort = clampReasoningEffortForAdapter(
    loadout.reasoningEffort ??
      preferences.reasoningEffort ??
      defaultReasoningEffortForAdapter(runtimeAdapter),
    runtimeAdapter,
  );
  const executionMode =
    loadout.executionMode ??
    preferences.executionMode ??
    defaultExecutionModeForAdapter(runtimeAdapter);
  return {
    runtimeAdapter,
    model,
    reasoningEffort,
    executionMode,
    environment: loadout.environment ?? DEFAULT_HOGLET_ENVIRONMENT,
  };
}

export function defaultExecutionModeForAdapter(
  adapter: HogletRuntimeAdapter,
): PersistedExecutionMode {
  return adapter === "codex" ? "auto" : "plan";
}

function resolvePreferredExecutionMode(
  defaultInitialTaskMode: unknown,
  lastUsedInitialTaskMode: unknown,
  adapter: HogletRuntimeAdapter | undefined,
): PersistedExecutionMode | undefined {
  if (defaultInitialTaskMode === "last_used") {
    const parsed = persistedExecutionModeSchema.safeParse(
      lastUsedInitialTaskMode,
    );
    if (parsed.success) return parsed.data;
    if (lastUsedInitialTaskMode !== undefined) {
      log.warn(
        "lastUsedInitialTaskMode rejected for hedgemony (bypassPermissions or unknown); using adapter default",
        { value: lastUsedInitialTaskMode },
      );
    }
  }
  return adapter ? defaultExecutionModeForAdapter(adapter) : undefined;
}
