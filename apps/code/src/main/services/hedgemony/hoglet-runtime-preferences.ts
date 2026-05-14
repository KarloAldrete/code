import { type ExecutionMode, executionModeSchema } from "../../../shared/types";
import { decrypt } from "../../utils/encryption";
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
  type NestLoadout,
} from "./schemas";

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
  executionMode?: ExecutionMode;
}

export interface ResolvedHogletRuntime {
  runtimeAdapter: HogletRuntimeAdapter;
  model: string;
  reasoningEffort: HedgemonyReasoningEffort;
  executionMode: ExecutionMode;
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
    return {
      runtimeAdapter: runtimeAdapter.success ? runtimeAdapter.data : undefined,
      model:
        typeof state.lastUsedModel === "string"
          ? state.lastUsedModel
          : undefined,
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
): ExecutionMode {
  return adapter === "codex" ? "auto" : "plan";
}

function resolvePreferredExecutionMode(
  defaultInitialTaskMode: unknown,
  lastUsedInitialTaskMode: unknown,
  adapter: HogletRuntimeAdapter | undefined,
): ExecutionMode | undefined {
  if (defaultInitialTaskMode === "last_used") {
    const parsed = executionModeSchema.safeParse(lastUsedInitialTaskMode);
    if (parsed.success) return parsed.data;
  }
  return adapter ? defaultExecutionModeForAdapter(adapter) : undefined;
}
