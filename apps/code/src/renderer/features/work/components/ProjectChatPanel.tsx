import { resolveChatDir, useChatDir } from "@features/chat/hooks/useChatDir";
import { useChatStore } from "@features/chat/stores/chatStore";
import { PromptInput } from "@features/message-editor/components/PromptInput";
import type { EditorHandle } from "@features/message-editor/types";
import { ReasoningLevelSelector } from "@features/sessions/components/ReasoningLevelSelector";
import { SessionView } from "@features/sessions/components/SessionView";
import { UnifiedModelSelector } from "@features/sessions/components/UnifiedModelSelector";
import { useSessionCallbacks } from "@features/sessions/hooks/useSessionCallbacks";
import { useSessionConnection } from "@features/sessions/hooks/useSessionConnection";
import { useSessionForTask } from "@features/sessions/stores/sessionStore";
import {
  type AgentAdapter,
  useSettingsStore,
} from "@features/settings/stores/settingsStore";
import { usePreviewConfig } from "@features/task-detail/hooks/usePreviewConfig";
import type {
  TaskCreationInput,
  TaskService,
} from "@features/task-detail/service/service";
import { useTasks } from "@features/tasks/hooks/useTasks";
import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";
import { ChatCircleText } from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { get as getDi } from "@renderer/di/container";
import { RENDERER_TOKENS } from "@renderer/di/tokens";
import type { Task } from "@shared/types";
import type { WorkProject } from "@shared/types/work-projects";
import { useProjectChatsStore } from "@stores/projectChatsStore";
import { logger } from "@utils/logger";
import { queryClient } from "@utils/queryClient";
import { toast } from "@utils/toast";
import { useCallback, useMemo, useRef, useState } from "react";

const log = logger.scope("project-chat-panel");

function newChatId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `chat-${Date.now()}`;
}

function buildProjectContext(project: WorkProject): string {
  const lines: string[] = [];
  lines.push(`# Project: ${project.name}`);
  lines.push(`Tagline: ${project.tagline}`);
  if (project.members.length > 0) {
    lines.push(`Members: ${project.members.map((m) => m.name).join(", ")}`);
  }

  const titleTile = project.tiles.find((t) => t.type === "title");
  if (titleTile && titleTile.type === "title") {
    lines.push("");
    lines.push(
      `This project canvas is a composable bento grid of tiles. The user can ask you to read, summarise, or draft updates for any tile. Tiles you can suggest the user add (they review each suggestion as a ghost tile before it's applied to the canvas):`,
    );
    lines.push(
      `- headline: a big PostHog metric with sparkline\n- insight: a linked PostHog dashboard/insight\n- file: a markdown doc embedded in the canvas\n- note: a sticky-note for thoughts\n- skill_output: the latest result of a saved skill`,
    );
  }

  for (const t of project.tiles) {
    if (t.type === "headline") {
      lines.push("");
      lines.push(`## Headline tile · ${t.label}`);
      lines.push(`Current value: ${t.fallbackValue} (${t.fallbackDelta})`);
      if (t.posthogUrl) lines.push(`Source: ${t.posthogUrl}`);
    } else if (t.type === "insight") {
      lines.push("");
      lines.push(`## Insight tile · ${t.title}`);
      if (t.description) lines.push(t.description);
      lines.push(`URL: ${t.url}`);
    } else if (t.type === "file") {
      lines.push("");
      lines.push(`## File · ${t.filename}`);
      lines.push(t.contents.slice(0, 800));
    } else if (t.type === "skill_output") {
      lines.push("");
      lines.push(`## Skill output · ${t.skillName}`);
      if (t.skillDescription) lines.push(t.skillDescription);
      if (t.lastRunOutput) {
        lines.push("Last run:");
        lines.push(t.lastRunOutput);
      }
    } else if (t.type === "note") {
      lines.push("");
      lines.push(`## Note`);
      lines.push(t.body);
    }
  }

  return lines.join("\n");
}

function ProjectChatLanding({ project }: { project: WorkProject }) {
  const editorRef = useRef<EditorHandle>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editorIsEmpty, setEditorIsEmpty] = useState(true);

  const addChat = useChatStore((s) => s.addChat);
  const setChatId = useProjectChatsStore((s) => s.setChatId);

  const lastUsedAdapter = useSettingsStore((s) => s.lastUsedAdapter);
  const setLastUsedAdapter = useSettingsStore((s) => s.setLastUsedAdapter);
  const setLastUsedReasoningEffort = useSettingsStore(
    (s) => s.setLastUsedReasoningEffort,
  );
  const adapter: AgentAdapter = lastUsedAdapter ?? "claude";

  const {
    modelOption,
    thoughtOption,
    isLoading: isPreviewLoading,
    setConfigOption,
  } = usePreviewConfig(adapter);

  const handleModelChange = useCallback(
    (value: string) => {
      if (modelOption) setConfigOption(modelOption.id, value);
    },
    [modelOption, setConfigOption],
  );

  const handleThoughtChange = useCallback(
    (value: string) => {
      if (thoughtOption) {
        setConfigOption(thoughtOption.id, value);
        setLastUsedReasoningEffort(value);
      }
    },
    [thoughtOption, setConfigOption, setLastUsedReasoningEffort],
  );

  const handleSubmit = useCallback(
    async (text: string) => {
      const userPrompt = text.trim();
      if (!userPrompt || isSubmitting) return;
      setIsSubmitting(true);

      const chatId = newChatId();
      const title = `${project.name} · chat`;
      const fullPrompt = `${buildProjectContext(project)}\n\n---\n\n${userPrompt}`;

      try {
        const repoPath = await resolveChatDir(chatId);

        const model =
          modelOption?.type === "select" ? modelOption.currentValue : undefined;
        const reasoningLevel =
          thoughtOption?.type === "select"
            ? thoughtOption.currentValue
            : undefined;

        const input: TaskCreationInput = {
          content: fullPrompt,
          taskDescription: title,
          repoPath,
          workspaceMode: "chat",
          adapter,
          model,
          reasoningLevel,
        };

        const taskService = getDi<TaskService>(RENDERER_TOKENS.TaskService);
        const result = await taskService.createTask(input, (output) => {
          addChat(output.task.id);
          setChatId(project.id, output.task.id);
          queryClient.setQueriesData<Task[]>(
            { queryKey: ["tasks", "list"] },
            (old) =>
              old
                ? [output.task, ...old.filter((t) => t.id !== output.task.id)]
                : [output.task],
          );
          void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        });

        if (!result.success) {
          toast.error("Failed to start chat", { description: result.error });
          log.error("Project chat creation failed", {
            projectId: project.id,
            failedStep: result.failedStep,
            error: result.error,
          });
        }
      } catch (error) {
        const description =
          error instanceof Error ? error.message : "Unknown error";
        toast.error("Failed to start chat", { description });
        log.error("Unexpected error starting project chat", {
          projectId: project.id,
          error,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting,
      project,
      adapter,
      modelOption,
      thoughtOption,
      addChat,
      setChatId,
    ],
  );

  const handleEditorEmptyChange = useCallback((isEmpty: boolean) => {
    setEditorIsEmpty(isEmpty);
  }, []);

  const handleSubmitClick = useCallback(() => {
    const text = editorRef.current?.getText() ?? "";
    void handleSubmit(text);
  }, [handleSubmit]);

  return (
    <Flex direction="column" height="100%">
      <Flex
        align="center"
        gap="2"
        px="3"
        py="2"
        className="shrink-0 border-(--gray-6) border-b text-(--gray-11)"
      >
        <ChatCircleText size={14} weight="duotone" />
        <Text
          as="span"
          weight="medium"
          className="text-(--gray-12) text-[13px]"
        >
          Ask about {project.name}
        </Text>
      </Flex>
      <Flex
        flexGrow="1"
        align="center"
        justify="end"
        direction="column"
        className="overflow-y-auto px-4 pb-4"
      >
        <Flex direction="column" gap="3" className="w-full max-w-[560px]">
          <Text as="div" className="text-(--gray-11) text-[13px]">
            Ask anything about {project.name} — I have its dashboards,
            automations, and files in context.
          </Text>
          <PromptInput
            ref={editorRef}
            sessionId={`project-chat-landing-${project.id}`}
            placeholder={`e.g. summarize today's waitlist signups for the launch standup`}
            editorHeight="default"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            autoFocus
            clearOnSubmit={false}
            submitDisabledExternal={editorIsEmpty || isSubmitting}
            enableCommands
            enableBashMode={false}
            modelSelector={
              <UnifiedModelSelector
                modelOption={modelOption}
                adapter={adapter}
                onAdapterChange={setLastUsedAdapter}
                disabled={isSubmitting}
                isConnecting={isPreviewLoading}
                onModelChange={handleModelChange}
              />
            }
            reasoningSelector={
              !isPreviewLoading && (
                <ReasoningLevelSelector
                  thoughtOption={thoughtOption}
                  adapter={adapter}
                  onChange={handleThoughtChange}
                  disabled={isSubmitting}
                />
              )
            }
            onEmptyChange={handleEditorEmptyChange}
            onSubmitClick={handleSubmitClick}
            onSubmit={handleSubmit}
          />
        </Flex>
      </Flex>
    </Flex>
  );
}

function ProjectChatSession({
  project,
  chatId,
}: {
  project: WorkProject;
  chatId: string;
}) {
  const { data: tasks } = useTasks();
  const repoPath = useChatDir(chatId);

  const taskFromList = useMemo(
    () => tasks?.find((t) => t.id === chatId),
    [tasks, chatId],
  );

  const { data: taskFromApi } = useAuthenticatedQuery<Task>(
    ["tasks", "detail", chatId],
    (client) => client.getTask(chatId) as unknown as Promise<Task>,
    { enabled: !taskFromList },
  );

  const task = taskFromList ?? taskFromApi;
  const session = useSessionForTask(chatId);

  useSessionConnection({
    taskId: chatId,
    task: task ?? ({ id: chatId } as never),
    session,
    repoPath: repoPath ?? null,
    isCloud: false,
  });

  const {
    handleSendPrompt,
    handleCancelPrompt,
    handleRetry,
    handleNewSession,
    handleBashCommand,
  } = useSessionCallbacks({
    taskId: chatId,
    task: task ?? ({ id: chatId } as never),
    session,
    repoPath: repoPath ?? null,
  });

  if (!task) {
    return (
      <Flex align="center" justify="center" height="100%">
        <Text className="text-(--gray-11) text-[13px]">Loading chat…</Text>
      </Flex>
    );
  }

  const events = session?.events ?? [];
  const isPromptPending = session?.isPromptPending ?? false;
  const promptStartedAt = session?.promptStartedAt;
  const isRunning = session?.status === "connected";
  const hasError = session?.status === "error" && !session?.idleKilled;
  const isInitializing =
    !session ||
    (session.status === "connecting" && events.length === 0) ||
    (session.status === "connected" &&
      events.length === 0 &&
      (isPromptPending || !!task.latest_run?.id));

  return (
    <Flex direction="column" height="100%">
      <Flex
        align="center"
        gap="2"
        px="3"
        py="2"
        className="shrink-0 border-(--gray-6) border-b text-(--gray-11)"
      >
        <ChatCircleText size={14} weight="duotone" />
        <Text
          as="span"
          weight="medium"
          className="truncate text-(--gray-12) text-[13px]"
        >
          {project.name}
        </Text>
      </Flex>
      <Box flexGrow="1" overflow="hidden">
        <SessionView
          events={events}
          taskId={chatId}
          task={task}
          isRunning={isRunning}
          isPromptPending={isPromptPending}
          promptStartedAt={promptStartedAt}
          onSendPrompt={handleSendPrompt}
          onBashCommand={handleBashCommand}
          onCancelPrompt={handleCancelPrompt}
          repoPath={repoPath ?? undefined}
          hasError={hasError}
          errorTitle={session?.errorTitle}
          errorMessage={session?.errorMessage ?? undefined}
          onRetry={handleRetry}
          onNewSession={handleNewSession}
          isInitializing={isInitializing}
          isCloud={false}
          compact
          isActiveSession
        />
      </Box>
    </Flex>
  );
}

export function ProjectChatPanel({ project }: { project: WorkProject }) {
  const chatId = useProjectChatsStore((s) => s.chatIdByProjectId[project.id]);

  if (!chatId) {
    return <ProjectChatLanding project={project} />;
  }
  return <ProjectChatSession project={project} chatId={chatId} />;
}
