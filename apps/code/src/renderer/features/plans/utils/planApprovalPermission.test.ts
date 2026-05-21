import type { SessionConfigOption } from "@features/sessions/stores/sessionStore";
import type { PermissionRequest } from "@features/sessions/utils/parseSessionLogs";
import { describe, expect, it } from "vitest";
import { buildPlanApprovalState } from "./planApprovalPermission";

type AllowKind = "allow_once" | "allow_always";
type RejectKind = "reject_once" | "reject_always";

function makePermission(
  options: { optionId: string; name: string; kind: AllowKind | RejectKind }[],
  toolCallId = "tc-1",
): PermissionRequest {
  return {
    taskRunId: "task-1",
    receivedAt: 0,
    options,
    toolCall: {
      toolCallId,
      title: "Switch mode",
      kind: "switch_mode",
      content: [],
      locations: [],
      rawInput: {},
    },
  } as unknown as PermissionRequest;
}

function makeMap(reqs: PermissionRequest[]): Map<string, PermissionRequest> {
  return new Map(
    reqs.map((r) => [r.toolCall?.toolCallId ?? Math.random().toString(), r]),
  );
}

function makeModeConfigOption(
  currentValue: string,
  options: { value: string; name: string }[],
): SessionConfigOption {
  return {
    id: "mode",
    name: "Approval Preset",
    type: "select",
    currentValue,
    options,
    category: "mode",
  } as SessionConfigOption;
}

describe("buildPlanApprovalState", () => {
  it("returns null when neither a pending permission nor plan mode is active", () => {
    expect(
      buildPlanApprovalState({
        permissions: new Map(),
        configOptions: [
          makeModeConfigOption("default", [
            { value: "default", name: "Default" },
            { value: "plan", name: "Plan Mode" },
          ]),
        ],
      }),
    ).toBeNull();
  });

  it("returns null when there are no configOptions and no permission", () => {
    expect(
      buildPlanApprovalState({
        permissions: new Map(),
        configOptions: undefined,
      }),
    ).toBeNull();
  });

  describe("source: 'permission' (agent's ExitPlanMode request)", () => {
    it("returns ALL allow_* options when a switch_mode permission is pending", () => {
      const state = buildPlanApprovalState({
        permissions: makeMap([
          makePermission([
            {
              optionId: "bypassPermissions",
              name: "Yes, bypass",
              kind: "allow_always",
            },
            { optionId: "auto", name: 'Yes, "auto"', kind: "allow_always" },
            {
              optionId: "default",
              name: "Yes, manual",
              kind: "allow_once",
            },
            {
              optionId: "reject_with_feedback",
              name: "No",
              kind: "reject_once",
            },
          ]),
        ]),
        configOptions: undefined,
      });
      if (state?.source !== "permission")
        throw new Error("expected permission");
      expect(state.toolCallId).toBe("tc-1");
      expect(state.approveOptions.map((o) => o.optionId)).toEqual([
        "bypassPermissions",
        "auto",
        "default",
      ]);
      expect(state.rejectOptionId).toBe("reject_with_feedback");
    });

    it("prefers `default` over bypass for the safe default", () => {
      const state = buildPlanApprovalState({
        permissions: makeMap([
          makePermission([
            {
              optionId: "bypassPermissions",
              name: "Yes, bypass",
              kind: "allow_always",
            },
            { optionId: "default", name: "Yes, manual", kind: "allow_once" },
          ]),
        ]),
        configOptions: undefined,
      });
      expect(state?.defaultOptionId).toBe("default");
    });
  });

  describe("source: 'mode' (no pending permission, session is in plan mode)", () => {
    it("returns approve options drawn from the mode configOption (excluding `plan` itself)", () => {
      const state = buildPlanApprovalState({
        permissions: new Map(),
        configOptions: [
          makeModeConfigOption("plan", [
            { value: "default", name: "Default" },
            { value: "acceptEdits", name: "Accept Edits" },
            { value: "plan", name: "Plan Mode" },
            { value: "bypassPermissions", name: "Bypass Permissions" },
          ]),
        ],
      });
      expect(state?.source).toBe("mode");
      expect(state?.approveOptions.map((o) => o.optionId)).toEqual([
        "default",
        "acceptEdits",
        "bypassPermissions",
      ]);
    });

    it("returns null when current mode is NOT plan", () => {
      const state = buildPlanApprovalState({
        permissions: new Map(),
        configOptions: [
          makeModeConfigOption("default", [
            { value: "default", name: "Default" },
            { value: "plan", name: "Plan Mode" },
          ]),
        ],
      });
      expect(state).toBeNull();
    });

    it("flags bypassPermissions and prefers `default` for the safe default", () => {
      const state = buildPlanApprovalState({
        permissions: new Map(),
        configOptions: [
          makeModeConfigOption("plan", [
            { value: "default", name: "Default" },
            { value: "acceptEdits", name: "Accept Edits" },
            { value: "plan", name: "Plan Mode" },
            { value: "bypassPermissions", name: "Bypass Permissions" },
          ]),
        ],
      });
      expect(state?.defaultOptionId).toBe("default");
      expect(
        state?.approveOptions.find((o) => o.optionId === "bypassPermissions")
          ?.isBypass,
      ).toBe(true);
    });

    it("does NOT expose a rejectOptionId in mode-driven flow (Reject sends a prompt, not a permission response)", () => {
      const state = buildPlanApprovalState({
        permissions: new Map(),
        configOptions: [
          makeModeConfigOption("plan", [
            { value: "default", name: "Default" },
            { value: "plan", name: "Plan Mode" },
          ]),
        ],
      });
      expect(state?.rejectOptionId).toBeUndefined();
    });
  });

  describe("precedence", () => {
    it("prefers the pending permission over plan-mode derivation when both exist", () => {
      const state = buildPlanApprovalState({
        permissions: makeMap([
          makePermission([
            { optionId: "default", name: "Yes", kind: "allow_once" },
            { optionId: "reject_once", name: "No", kind: "reject_once" },
          ]),
        ]),
        configOptions: [
          makeModeConfigOption("plan", [
            { value: "default", name: "Default" },
            { value: "auto", name: "Auto" },
            { value: "plan", name: "Plan Mode" },
          ]),
        ],
      });
      expect(state?.source).toBe("permission");
      expect(state?.source === "permission" && state.toolCallId).toBe("tc-1");
    });
  });
});
