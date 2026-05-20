import type { AvailableCommand, ContentBlock } from "@agentclientprotocol/sdk";
import { getSessionService } from "@features/sessions/service/service";
import { sessionStoreSetters } from "@features/sessions/stores/sessionStore";
import { ANALYTICS_EVENTS, type FeedbackType } from "@shared/types/analytics";
import { track } from "@utils/analytics";
import { logger } from "@utils/logger";
import { toast } from "@utils/toast";

const log = logger.scope("code-commands");

interface CommandContext {
  taskId: string;
  repoPath: string | null | undefined;
  session: {
    taskRunId?: string;
    logUrl?: string;
    events: unknown[];
  } | null;
  taskRun: { id?: string; log_url?: string } | null;
}

interface CodeCommand {
  name: string;
  description: string;
  input?: { hint: string };
  execute: (
    args: string | undefined,
    context: CommandContext,
  ) => Promise<void> | void;
}

function makeFeedbackCommand(
  name: string,
  feedbackType: FeedbackType,
  label: string,
): CodeCommand {
  return {
    name,
    description: `Capture ${label.toLowerCase()} feedback`,
    input: { hint: "optional comment" },
    execute(args, ctx) {
      track(ANALYTICS_EVENTS.TASK_FEEDBACK, {
        task_id: ctx.taskId,
        task_run_id: ctx.session?.taskRunId ?? ctx.taskRun?.id,
        log_url: ctx.session?.logUrl ?? ctx.taskRun?.log_url,
        event_count: ctx.session?.events.length ?? 0,
        feedback_type: feedbackType,
        feedback_comment: args?.trim() || undefined,
      });
      toast.success(`${label} feedback captured`);
    },
  };
}

const longRunningTaskCommand: CodeCommand = {
  name: "long-running-task",
  description:
    "Plan and run an auto-iterating task with a measurable success criterion",
  input: { hint: "what should the agent work on?" },
  async execute(args, ctx) {
    const session = sessionStoreSetters.getSessionByTaskId(ctx.taskId);
    if (session?.isCloud) {
      toast.error(
        "Long-running tasks aren't supported on cloud sessions yet — run locally.",
      );
      return;
    }
    const description = args?.trim() ?? "";
    const visibleText = description
      ? `Plan a long-running task: ${description}`
      : "Plan a long-running task (please ask me what to work on).";
    const blocks: ContentBlock[] = [
      { type: "text", text: visibleText },
      {
        type: "text",
        text: "Follow the long-running task workflow from your system prompt: explore the relevant code first, ask clarifying questions via AskUserQuestion only when intent is genuinely ambiguous, then emit the proposal as a single <long-running-task-config>{...}</long-running-task-config> block. Do NOT begin iterating until the user approves the proposal.",
        _meta: { ui: { hidden: true } },
      },
    ];
    try {
      await getSessionService().sendPrompt(ctx.taskId, blocks);
    } catch (err) {
      log.error("Failed to start long-running task planning", { err });
      toast.error("Failed to start long-running task planning");
    }
  },
};

const commands: CodeCommand[] = [
  makeFeedbackCommand("good", "good", "Positive"),
  makeFeedbackCommand("bad", "bad", "Negative"),
  makeFeedbackCommand("feedback", "general", "General"),
  longRunningTaskCommand,
];

export const CODE_COMMANDS: AvailableCommand[] = commands.map((cmd) => ({
  name: cmd.name,
  description: cmd.description,
  input: cmd.input,
}));

const commandMap = new Map(commands.map((cmd) => [cmd.name, cmd]));

export async function tryExecuteCodeCommand(
  text: string,
  context: CommandContext,
): Promise<boolean> {
  const match = text.match(/^\/(\S+)(?:\s+(.*))?$/);
  if (!match) return false;

  const cmd = commandMap.get(match[1]);
  if (!cmd) return false;

  await cmd.execute(match[2], context);
  return true;
}
