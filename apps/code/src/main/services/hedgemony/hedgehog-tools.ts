import { z } from "zod";
import type { AnthropicToolDefinition } from "../llm-gateway/schemas";

/**
 * The hedgehog's tool list. Slice 6 added the brood-management primitives;
 * Slice 8 added PR-graph orchestration (`link_pr_dependency`,
 * `unlink_pr_dependency`, `rebase_child`). The hedgehog still cannot author
 * code — these tools only declare relationships and route rebase prompts.
 *
 * `message_hoglet` is audit-only; Slice 7 (FeedbackRoutingService +
 * useHedgemonyPromptRouter hook) wires real prompt injection into live
 * sessions on the same channel.
 */
export const HEDGEHOG_TOOLS: AnthropicToolDefinition[] = [
  {
    name: "raise_hoglet",
    description:
      "Start a fresh TaskRun on an idle hoglet inside this nest. Use when the hoglet's latest run has terminated (completed/failed/cancelled) or no run exists. Include a short prompt explaining the next step.",
    input_schema: {
      type: "object",
      properties: {
        hoglet_id: {
          type: "string",
          description: "The id of the hoglet to raise.",
        },
        prompt: {
          type: "string",
          description:
            "Optional user message that becomes the first message of the new TaskRun. Should be concrete and concise.",
        },
      },
      required: ["hoglet_id"],
    },
  },
  {
    name: "kill_hoglet",
    description:
      "Cancel a hoglet's currently active TaskRun. Use when the hoglet is doing the wrong work or the nest goal has shifted.",
    input_schema: {
      type: "object",
      properties: {
        hoglet_id: {
          type: "string",
          description: "The id of the hoglet to kill.",
        },
        reason: {
          type: "string",
          description:
            "Why the hoglet is being killed; surfaced to the operator in the audit log.",
        },
      },
      required: ["hoglet_id", "reason"],
    },
  },
  {
    name: "message_hoglet",
    description:
      "Note an instruction you want delivered to a hoglet. In Slice 6 this writes an audit entry only — real prompt injection lands in a later slice. Use to record an intent; do not assume the hoglet will read it.",
    input_schema: {
      type: "object",
      properties: {
        hoglet_id: {
          type: "string",
          description: "The id of the hoglet the message is for.",
        },
        prompt: {
          type: "string",
          description: "The instruction body.",
        },
      },
      required: ["hoglet_id", "prompt"],
    },
  },
  {
    name: "write_audit_entry",
    description:
      "Write a compact, operator-visible audit entry to the nest chat. Use to explain why you took (or didn't take) a high-impact action.",
    input_schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "One- or two-sentence summary of the decision/observation.",
        },
        detail: {
          type: "string",
          description:
            "Optional longer explanation. Persisted at detail visibility — operators can expand to see it.",
        },
      },
      required: ["summary"],
    },
  },
  {
    name: "link_pr_dependency",
    description:
      "Declare that one hoglet's PR is stacked on top of another's. Use when child_task's branch was branched off parent_task's branch, so a merged parent should trigger a rebase on the child. Idempotent — calling twice with the same pair is harmless.",
    input_schema: {
      type: "object",
      properties: {
        parent_task_id: {
          type: "string",
          description:
            "The task_id whose PR is the BASE of the stack (the one that will merge first).",
        },
        child_task_id: {
          type: "string",
          description:
            "The task_id whose PR depends on the parent (the one that will need a rebase).",
        },
        reason: {
          type: "string",
          description:
            "Why you're declaring this dependency; surfaced to the operator in the audit log.",
        },
      },
      required: ["parent_task_id", "child_task_id", "reason"],
    },
  },
  {
    name: "unlink_pr_dependency",
    description:
      "Remove a previously-declared PR dependency edge. Use when you decide the child no longer depends on the parent (e.g. you reassigned scope or the relationship was wrong).",
    input_schema: {
      type: "object",
      properties: {
        edge_id: {
          type: "string",
          description: "The id of the dependency edge to remove.",
        },
        reason: {
          type: "string",
          description: "Why the edge is being removed.",
        },
      },
      required: ["edge_id", "reason"],
    },
  },
  {
    name: "rebase_child",
    description:
      "Proactively route a 'rebase your branch' prompt to a child hoglet, without waiting for the parent-merge poll. Use when you can see the parent has merged (its `pr_state` is `merged`) but the poll hasn't fired yet, or when the operator asked you to push a rebase manually.",
    input_schema: {
      type: "object",
      properties: {
        edge_id: {
          type: "string",
          description:
            "The id of the PR dependency edge whose child should be rebased.",
        },
        prompt: {
          type: "string",
          description:
            "Optional custom prompt to deliver to the child. Defaults to a standard rebase instruction that names the parent branch.",
        },
      },
      required: ["edge_id"],
    },
  },
];

export type HedgehogToolName =
  | "raise_hoglet"
  | "kill_hoglet"
  | "message_hoglet"
  | "write_audit_entry"
  | "link_pr_dependency"
  | "unlink_pr_dependency"
  | "rebase_child";

export const raiseHogletArgs = z.object({
  hoglet_id: z.string().min(1),
  prompt: z.string().trim().min(1).max(2000).optional(),
});

export const killHogletArgs = z.object({
  hoglet_id: z.string().min(1),
  reason: z.string().trim().min(1).max(2000),
});

export const messageHogletArgs = z.object({
  hoglet_id: z.string().min(1),
  prompt: z.string().trim().min(1).max(2000),
});

export const writeAuditEntryArgs = z.object({
  summary: z.string().trim().min(1).max(2000),
  detail: z.string().trim().min(1).max(8000).optional(),
});

export const linkPrDependencyArgs = z.object({
  parent_task_id: z.string().min(1),
  child_task_id: z.string().min(1),
  reason: z.string().trim().min(1).max(2000),
});

export const unlinkPrDependencyArgs = z.object({
  edge_id: z.string().min(1),
  reason: z.string().trim().min(1).max(2000),
});

export const rebaseChildArgs = z.object({
  edge_id: z.string().min(1),
  prompt: z.string().trim().min(1).max(2000).optional(),
});

export type RaiseHogletArgs = z.infer<typeof raiseHogletArgs>;
export type KillHogletArgs = z.infer<typeof killHogletArgs>;
export type MessageHogletArgs = z.infer<typeof messageHogletArgs>;
export type WriteAuditEntryArgs = z.infer<typeof writeAuditEntryArgs>;
export type LinkPrDependencyArgs = z.infer<typeof linkPrDependencyArgs>;
export type UnlinkPrDependencyArgs = z.infer<typeof unlinkPrDependencyArgs>;
export type RebaseChildArgs = z.infer<typeof rebaseChildArgs>;
