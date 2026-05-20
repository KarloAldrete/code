import { randomUUID } from "node:crypto";
import type { AgentSideConnection } from "@agentclientprotocol/sdk";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { POSTHOG_NOTIFICATIONS } from "../../../acp-extensions";
import { getLatestAssistantText } from "../plan/utils";
import type { LongRunningTaskState, Session } from "../types";

export const DEFAULT_MARKER = "<TASK_COMPLETE>";
export const DEFAULT_MAX_ITERATIONS = 20;

export const StartLongRunningTaskParamsSchema = z.object({
  goal: z.string().min(1),
  successCriterion: z.string().min(1),
  marker: z.string().min(1).default(DEFAULT_MARKER),
  maxIterations: z
    .number()
    .int()
    .positive()
    .max(200)
    .default(DEFAULT_MAX_ITERATIONS),
});

export type StartLongRunningTaskParams = z.infer<
  typeof StartLongRunningTaskParamsSchema
>;

function makeUserMessage(sessionId: string, text: string): SDKUserMessage {
  return {
    type: "user",
    message: { role: "user", content: [{ type: "text", text }] },
    session_id: sessionId,
    parent_tool_use_id: null,
    uuid: randomUUID(),
  };
}

export function buildContinuationMessage(task: LongRunningTaskState): string {
  return [
    `Continue working toward the goal. Iterations used: ${task.iterations}/${task.maxIterations}.`,
    `Goal: ${task.goal}`,
    `Success criterion (must be objectively verified before stopping): ${task.successCriterion}`,
    `When — and only when — you have actually run the verification and observed success, output the exact marker on its own line: ${task.marker}`,
    `If the verification fails or is incomplete, keep iterating. Do NOT output the marker speculatively.`,
  ].join("\n");
}

export function buildWrapUpMessage(task: LongRunningTaskState): string {
  return [
    `You have used all ${task.maxIterations} iterations without satisfying the success criterion (${task.successCriterion}).`,
    `Stop iterating. In a single final response, summarize:`,
    `- What you accomplished`,
    `- What still remains`,
    `- Any blockers or impossibilities you encountered`,
    `Do NOT output the marker ${task.marker}.`,
  ].join("\n");
}

export function makeContinuationUserMessage(
  sessionId: string,
  text: string,
): SDKUserMessage {
  return makeUserMessage(sessionId, text);
}

export async function broadcastLongRunningTaskUpdate(
  client: AgentSideConnection,
  sessionId: string,
  task: LongRunningTaskState | null,
): Promise<void> {
  await client.extNotification(POSTHOG_NOTIFICATIONS.LONG_RUNNING_TASK_UPDATE, {
    sessionId,
    active: task !== null,
    goal: task?.goal ?? null,
    successCriterion: task?.successCriterion ?? null,
    marker: task?.marker ?? null,
    iterations: task?.iterations ?? 0,
    maxIterations: task?.maxIterations ?? 0,
  });
}

export type LoopDecision =
  | { kind: "exit" }
  | { kind: "continue"; text: string }
  | { kind: "wrap_up"; text: string };

interface LongRunningTaskHostSession {
  longRunningTask: LongRunningTaskState | null;
  cancelled: boolean;
  notificationHistory: Session["notificationHistory"];
}

interface DecideOptions {
  /**
   * Number of user-driven prompts queued behind the current turn. If > 0,
   * the loop yields to the user instead of auto-continuing. Adapters that
   * don't queue concurrent prompts (codex) pass 0.
   */
  pendingUserMessageCount: number;
}

/**
 * Decide what to do after an end-of-turn signal when a long-running task is
 * active. Mutates `session.longRunningTask` in place (iterations++, clearing
 * on exit) and returns the next continuation text for continue/wrap_up.
 * Caller is responsible for routing the text through whatever turn mechanism
 * its adapter uses (pushing into session.input for claude, building a new
 * PromptRequest for codex).
 */
export async function decideLongRunningTaskStep(
  session: LongRunningTaskHostSession,
  sessionId: string,
  client: AgentSideConnection,
  options: DecideOptions,
): Promise<LoopDecision> {
  const task = session.longRunningTask;
  if (!task || session.cancelled) {
    return { kind: "exit" };
  }

  const lastText = getLatestAssistantText(session.notificationHistory) ?? "";

  if (lastText.includes(task.marker)) {
    session.longRunningTask = null;
    await broadcastLongRunningTaskUpdate(client, sessionId, null);
    return { kind: "exit" };
  }

  if (task.iterations >= task.maxIterations) {
    const text = buildWrapUpMessage(task);
    session.longRunningTask = null;
    await broadcastLongRunningTaskUpdate(client, sessionId, null);
    return { kind: "wrap_up", text };
  }

  if (options.pendingUserMessageCount > 0) {
    return { kind: "exit" };
  }

  task.iterations += 1;
  await broadcastLongRunningTaskUpdate(client, sessionId, task);
  return { kind: "continue", text: buildContinuationMessage(task) };
}

const PROPOSAL_TAG_RE =
  /<long-running-task-config>\s*([\s\S]*?)\s*<\/long-running-task-config>/i;

export const ProposalSchema = z.object({
  goal: z.string().min(1).max(2000),
  successCriterion: z.string().min(1).max(2000),
  marker: z.string().min(1).max(200).default(DEFAULT_MARKER),
  maxIterations: z
    .number()
    .int()
    .positive()
    .max(200)
    .default(DEFAULT_MAX_ITERATIONS),
  approach: z.string().max(4000).optional(),
});

export type Proposal = z.infer<typeof ProposalSchema>;

export function extractProposal(text: string): Proposal | null {
  const match = text.match(PROPOSAL_TAG_RE);
  if (!match) return null;
  const raw = match[1].trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = ProposalSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

interface ProposalSessionView {
  longRunningTask: LongRunningTaskState | null;
  notificationHistory: Session["notificationHistory"];
}

export async function maybeBroadcastProposal(
  session: ProposalSessionView,
  sessionId: string,
  client: AgentSideConnection,
): Promise<void> {
  if (session.longRunningTask) return;
  const lastText = getLatestAssistantText(session.notificationHistory);
  if (!lastText) return;
  const proposal = extractProposal(lastText);
  if (!proposal) return;
  await client.extNotification(
    POSTHOG_NOTIFICATIONS.LONG_RUNNING_TASK_PROPOSAL,
    {
      sessionId,
      proposalId: randomUUID(),
      goal: proposal.goal,
      successCriterion: proposal.successCriterion,
      marker: proposal.marker,
      maxIterations: proposal.maxIterations,
      approach: proposal.approach ?? null,
    },
  );
}
