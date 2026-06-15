import type { FeedbackType } from "@posthog/shared/analytics-events";

export function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return idx >= 0 ? trimmed.slice(idx + 1) || trimmed : trimmed;
}

export interface ParsedCommandLine {
  name: string;
  args: string | undefined;
}

const COMMAND_LINE_REGEX = /^\/(\S+)(?:\s+(.*))?$/;
const FAST_COMMAND_REGEX = /^\/fast(?=$|[\s<])\s*([\s\S]*)$/;
const FAST_COMMAND_TIER_ALIASES = new Map([
  ["fast", "fast"],
  ["on", "fast"],
  ["enable", "fast"],
  ["enabled", "fast"],
  ["flex", "flex"],
  ["standard", "standard"],
  ["off", "standard"],
  ["disable", "standard"],
  ["disabled", "standard"],
]);

export type FastCommandServiceTier = "standard" | "fast" | "flex";

export interface ParsedFastCommand {
  serviceTier: FastCommandServiceTier;
  content: string;
  commandOnly: boolean;
}

export function parseCommandLine(text: string): ParsedCommandLine | null {
  const match = text.match(COMMAND_LINE_REGEX);
  if (!match) return null;
  return { name: match[1], args: match[2] };
}

export function parseFastCommand(text: string): ParsedFastCommand | null {
  const match = text.trimStart().match(FAST_COMMAND_REGEX);
  if (!match) return null;

  let serviceTier: FastCommandServiceTier = "fast";
  let content = (match[1] ?? "").trimStart();
  const firstTokenMatch = content.match(/^(\S+)([\s\S]*)$/);

  if (firstTokenMatch) {
    const explicitTier = FAST_COMMAND_TIER_ALIASES.get(
      firstTokenMatch[1].toLowerCase(),
    ) as FastCommandServiceTier | undefined;
    if (explicitTier) {
      serviceTier = explicitTier;
      content = firstTokenMatch[2].trimStart();
    }
  }

  return {
    serviceTier,
    content,
    commandOnly: content.trim().length === 0,
  };
}

export interface FeedbackEventInput {
  taskId: string;
  taskRunId?: string;
  logUrl?: string;
  eventCount: number;
  feedbackType: FeedbackType;
  comment?: string;
}

export interface FeedbackEventPayload {
  task_id: string;
  task_run_id: string | undefined;
  log_url: string | undefined;
  event_count: number;
  feedback_type: FeedbackType;
  feedback_comment: string | undefined;
}

export function buildFeedbackEventPayload(
  input: FeedbackEventInput,
): FeedbackEventPayload {
  return {
    task_id: input.taskId,
    task_run_id: input.taskRunId,
    log_url: input.logUrl,
    event_count: input.eventCount,
    feedback_type: input.feedbackType,
    feedback_comment: input.comment?.trim() || undefined,
  };
}
