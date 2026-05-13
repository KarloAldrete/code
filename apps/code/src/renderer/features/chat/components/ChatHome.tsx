import { DotPatternBackground } from "@components/DotPatternBackground";
import { PromptInput } from "@features/message-editor/components/PromptInput";
import type { EditorHandle } from "@features/message-editor/types";
import { ReasoningLevelSelector } from "@features/sessions/components/ReasoningLevelSelector";
import { UnifiedModelSelector } from "@features/sessions/components/UnifiedModelSelector";
import type { AgentAdapter } from "@features/settings/stores/settingsStore";
import { useSettingsStore } from "@features/settings/stores/settingsStore";
import { Flex } from "@radix-ui/themes";
import { get } from "@renderer/di/container";
import { RENDERER_TOKENS } from "@renderer/di/tokens";
import { usePreviewConfig } from "@renderer/features/task-detail/hooks/usePreviewConfig";
import type {
  TaskCreationInput,
  TaskService,
} from "@renderer/features/task-detail/service/service";
import { queryClient } from "@renderer/utils/queryClient";
import { toast } from "@renderer/utils/toast";
import type { Task } from "@shared/types";
import { useNavigationStore } from "@stores/navigationStore";
import { logger } from "@utils/logger";
import { useCallback, useRef, useState } from "react";
import { resolveChatDir } from "../hooks/useChatDir";
import { useChatStore } from "../stores/chatStore";

const log = logger.scope("chat-home");
const CHAT_HOME_SESSION_ID = "chat-home";

function newChatId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `chat-${Date.now()}`;
}

function deriveTitle(prompt: string): string {
  const firstLine = prompt.trim().split(/\r?\n/)[0] ?? "";
  const trimmed = firstLine.slice(0, 80).trim();
  return trimmed || "New chat";
}

export function ChatHome() {
  const editorRef = useRef<EditorHandle>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editorIsEmpty, setEditorIsEmpty] = useState(true);

  const addChat = useChatStore((s) => s.addChat);
  const navigateToChatConversation = useNavigationStore(
    (s) => s.navigateToChatConversation,
  );

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

      const title = deriveTitle(userPrompt);
      const chatId = newChatId();

      try {
        const repoPath = await resolveChatDir(chatId);

        const model =
          modelOption?.type === "select" ? modelOption.currentValue : undefined;
        const reasoningLevel =
          thoughtOption?.type === "select"
            ? thoughtOption.currentValue
            : undefined;

        const input: TaskCreationInput = {
          content: userPrompt,
          taskDescription: title,
          repoPath,
          workspaceMode: "chat",
          adapter,
          model,
          reasoningLevel,
        };

        const taskService = get<TaskService>(RENDERER_TOKENS.TaskService);
        const result = await taskService.createTask(input, (output) => {
          addChat(output.task.id);
          queryClient.setQueriesData<Task[]>(
            { queryKey: ["tasks", "list"] },
            (old) =>
              old
                ? [output.task, ...old.filter((t) => t.id !== output.task.id)]
                : [output.task],
          );
          void queryClient.invalidateQueries({ queryKey: ["tasks"] });
          navigateToChatConversation(output.task.id);
        });

        if (!result.success) {
          toast.error("Failed to start chat", { description: result.error });
          log.error("Chat creation failed", {
            failedStep: result.failedStep,
            error: result.error,
          });
        }
      } catch (error) {
        const description =
          error instanceof Error ? error.message : "Unknown error";
        toast.error("Failed to start chat", { description });
        log.error("Unexpected error starting chat", { error });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting,
      adapter,
      modelOption,
      thoughtOption,
      addChat,
      navigateToChatConversation,
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
    <div className="relative h-full w-full">
      <Flex
        align="center"
        justify="center"
        height="100%"
        className="relative px-4"
      >
        <DotPatternBackground className="h-[100.333%]" />
        <Flex
          direction="column"
          gap="2"
          style={{ zIndex: 1 }}
          className="relative w-full max-w-[600px]"
        >
          <PromptInput
            ref={editorRef}
            sessionId={CHAT_HOME_SESSION_ID}
            placeholder="Just chat — no environment or branch needed."
            editorHeight="large"
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
    </div>
  );
}
