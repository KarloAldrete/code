import type { InjectPromptEventPayload } from "@main/services/hedgemony/schemas";

export type PromptRoute =
  | "inject"
  | "suppress_hedgehog_follow_up"
  | "spawn_follow_up"
  | "failed";

const ACTIVE_RUN_STATUSES = new Set(["queued", "in_progress"]);

export function resolveHedgemonyPromptRoute(input: {
  payload: InjectPromptEventPayload;
  sessionStatus: string | null | undefined;
  latestRunStatus: string | null | undefined;
}): PromptRoute {
  if (input.sessionStatus === "connected") return "inject";

  const targetStatus = input.payload.targetRunStatus ?? input.latestRunStatus;
  if (
    input.payload.source === "hedgehog" &&
    targetStatus &&
    ACTIVE_RUN_STATUSES.has(targetStatus)
  ) {
    return "suppress_hedgehog_follow_up";
  }

  return input.payload.nestId ? "spawn_follow_up" : "failed";
}
