import type { SessionConfigOption } from "@features/sessions/stores/sessionStore";
import type { PermissionRequest } from "@features/sessions/utils/parseSessionLogs";

export interface PlanApproveOption {
  optionId: string;
  name: string;
  isBypass: boolean;
}

export type PlanApprovalState =
  | {
      source: "permission";
      toolCallId: string;
      approveOptions: PlanApproveOption[];
      defaultOptionId: string;
      rejectOptionId: string | null;
    }
  | {
      source: "mode";
      approveOptions: PlanApproveOption[];
      defaultOptionId: string;
      rejectOptionId?: undefined;
    };

const BYPASS_OPTION_ID = "bypassPermissions";
const PREFERRED_DEFAULT_OPTION_ID = "default";
const PLAN_MODE_ID = "plan";

function pickDefault(approve: PlanApproveOption[]): string {
  if (approve.length === 0) {
    throw new Error("pickDefault called with no approve options");
  }
  const preferred = approve.find(
    (o) => o.optionId === PREFERRED_DEFAULT_OPTION_ID,
  );
  if (preferred) return preferred.optionId;
  const nonBypass = approve.find((o) => !o.isBypass);
  return (nonBypass ?? approve[0]).optionId;
}

function findPermissionState(
  permissions: Map<string, PermissionRequest>,
): PlanApprovalState | null {
  for (const req of permissions.values()) {
    const toolCallId = req.toolCall?.toolCallId;
    if (!toolCallId) continue;
    if (req.toolCall?.kind !== "switch_mode") continue;

    const approveOptions: PlanApproveOption[] = req.options
      .filter((o) => o.kind === "allow_once" || o.kind === "allow_always")
      .map((o) => ({
        optionId: o.optionId,
        name: o.name,
        isBypass: o.optionId === BYPASS_OPTION_ID,
      }));
    if (approveOptions.length === 0) continue;

    const reject = req.options.find(
      (o) => o.kind === "reject_once" || o.kind === "reject_always",
    );

    return {
      source: "permission",
      toolCallId,
      approveOptions,
      defaultOptionId: pickDefault(approveOptions),
      rejectOptionId: reject?.optionId ?? null,
    };
  }
  return null;
}

function findModeOption(
  configOptions: SessionConfigOption[] | undefined,
): SessionConfigOption | undefined {
  return configOptions?.find((opt) => opt.category === "mode");
}

function findModeState(
  configOptions: SessionConfigOption[] | undefined,
): PlanApprovalState | null {
  const modeOption = findModeOption(configOptions);
  if (!modeOption) return null;
  if (modeOption.currentValue !== PLAN_MODE_ID) return null;

  const options = (modeOption.options ?? []) as {
    value: string;
    name: string;
  }[];
  const approveOptions: PlanApproveOption[] = options
    .filter((o) => o.value !== PLAN_MODE_ID)
    .map((o) => ({
      optionId: o.value,
      name: o.name,
      isBypass: o.value === BYPASS_OPTION_ID,
    }));
  if (approveOptions.length === 0) return null;

  return {
    source: "mode",
    approveOptions,
    defaultOptionId: pickDefault(approveOptions),
  };
}

/**
 * Returns the data needed to render the Plan view's Approve/Reject bar.
 *
 * The bar must be available whenever the session is in plan mode — not
 * just when an `ExitPlanMode` permission is pending. The agent processes
 * comment replies via `handlePlanFileException`, which allows Edit/Write
 * on plan files even while in plan mode WITHOUT ever calling
 * ExitPlanMode. That means during an active comment loop there is no
 * `switch_mode` permission pending, and the original permission-only
 * bar would (incorrectly) disappear.
 *
 * Precedence:
 *  - If a pending `switch_mode` permission exists, drive the bar from
 *    that (Approve resolves the permission with the chosen option;
 *    Reject responds with the permission's reject option).
 *  - Otherwise, if the session's `mode` configOption is `plan`, build
 *    the option list from its `options` array, excluding `plan` itself
 *    (Approve calls `setSessionConfigOption("mode", ...)`; Reject sends
 *    a feedback prompt and leaves mode unchanged).
 */
export function buildPlanApprovalState(args: {
  permissions: Map<string, PermissionRequest>;
  configOptions: SessionConfigOption[] | undefined;
}): PlanApprovalState | null {
  return (
    findPermissionState(args.permissions) ?? findModeState(args.configOptions)
  );
}
