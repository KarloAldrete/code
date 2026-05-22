import { useAuthStateValue } from "@features/auth/hooks/authQueries";
import { FolderPicker } from "@features/folder-picker/components/FolderPicker";
import { PromptInput } from "@features/message-editor/components/PromptInput";
import { useDraftStore } from "@features/message-editor/stores/draftStore";
import { useTaskInputHistoryStore } from "@features/message-editor/stores/taskInputHistoryStore";
import type { EditorHandle } from "@features/message-editor/types";
import { contentToXml } from "@features/message-editor/utils/content";
import { ReasoningLevelSelector } from "@features/sessions/components/ReasoningLevelSelector";
import { UnifiedModelSelector } from "@features/sessions/components/UnifiedModelSelector";
import { getCurrentModeFromConfigOptions } from "@features/sessions/stores/sessionStore";
import { useSettingsStore } from "@features/settings/stores/settingsStore";
import { ButtonGroup } from "@posthog/quill";
import { Flex, Text } from "@radix-ui/themes";
import { get } from "@renderer/di/container";
import { RENDERER_TOKENS } from "@renderer/di/tokens";
import { usePreviewConfig } from "@renderer/features/task-detail/hooks/usePreviewConfig";
import type { TaskService } from "@renderer/features/task-detail/service/service";
import { trpcClient, useTRPC } from "@renderer/trpc/client";
import { useSubscription } from "@trpc/tanstack-react-query";
import { logger } from "@utils/logger";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

const log = logger.scope("quick-entry-view");
const SESSION_ID = "quick-entry";

function hideWindow(): void {
  trpcClient.quickEntry.hide.mutate().catch((err) => {
    log.warn("Failed to hide quick entry window", { err });
  });
}

export function QuickEntryView() {
  const trpcReact = useTRPC();
  const editorRef = useRef<EditorHandle | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorIsEmpty, setEditorIsEmpty] = useState(true);

  const isAuthenticated = useAuthStateValue(
    (state) => state.status === "authenticated",
  );

  const {
    lastUsedAdapter,
    setLastUsedAdapter,
    lastUsedWorkspaceMode,
    defaultInitialTaskMode,
    lastUsedInitialTaskMode,
    setLastUsedReasoningEffort,
  } = useSettingsStore();

  const adapter = lastUsedAdapter ?? "claude";

  const {
    modeOption,
    modelOption,
    thoughtOption,
    isLoading: isPreviewLoading,
    setConfigOption,
  } = usePreviewConfig(adapter);

  // Seed default folder once from the most-recently-accessed repository.
  useEffect(() => {
    if (selectedDirectory) return;
    let cancelled = false;
    trpcClient.folders.getMostRecentlyAccessedRepository
      .query()
      .then((repo) => {
        if (cancelled || !repo) return;
        setSelectedDirectory(repo.path);
      })
      .catch(() => {
        // ignore — user can still pick manually
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDirectory]);

  // Populate command list for @ file mentions + / skills.
  useEffect(() => {
    let cancelled = false;
    trpcClient.skills.list.query().then((skills) => {
      if (cancelled) return;
      useDraftStore.getState().actions.setCommands(
        SESSION_ID,
        skills.map((s) => ({
          name: s.name,
          description: s.description,
        })),
      );
    });
    return () => {
      cancelled = true;
      useDraftStore.getState().actions.clearCommands(SESSION_ID);
    };
  }, []);

  useSubscription(
    trpcReact.quickEntry.onFocusInput.subscriptionOptions(undefined, {
      onData: () => {
        editorRef.current?.focus();
      },
    }),
  );

  useHotkeys(
    "escape",
    () => {
      hideWindow();
    },
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
  );

  const hasHistory = useTaskInputHistoryStore((s) => s.entries.length > 0);
  const hints = [
    "@ to add files",
    "/ for skills",
    hasHistory ? "↑↓ for history" : "",
  ]
    .filter(Boolean)
    .join(", ");

  const handleModeChange = useCallback(
    (value: string) => {
      if (modeOption) setConfigOption(modeOption.id, value);
    },
    [modeOption, setConfigOption],
  );

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

  const canSubmit =
    !!editorRef.current &&
    !!selectedDirectory &&
    !editorIsEmpty &&
    !isSubmitting;

  const handleSubmit = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || isSubmitting) return;

    if (!selectedDirectory) {
      setError("Pick a folder first");
      return;
    }
    if (!isAuthenticated) {
      setError("Sign in to PostHog Code first");
      return;
    }

    const content = editor.getContent();
    const xml = contentToXml(content).trim();
    if (!xml) return;

    const plainText = editor.getText()?.trim();
    if (plainText) {
      useTaskInputHistoryStore.getState().addPrompt(plainText);
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const workspaceMode =
        lastUsedWorkspaceMode === "cloud" ? "local" : lastUsedWorkspaceMode;
      const currentModel =
        modelOption?.type === "select" ? modelOption.currentValue : undefined;
      const currentReasoningLevel =
        thoughtOption?.type === "select"
          ? thoughtOption.currentValue
          : undefined;
      const adapterDefault = adapter === "codex" ? "auto" : "plan";
      const modeFallback =
        defaultInitialTaskMode === "last_used"
          ? (lastUsedInitialTaskMode ?? adapterDefault)
          : adapterDefault;
      const currentExecutionMode =
        getCurrentModeFromConfigOptions(
          modeOption ? [modeOption] : undefined,
        ) ?? modeFallback;

      const taskService = get<TaskService>(RENDERER_TOKENS.TaskService);
      const result = await taskService.createTask({
        content: xml,
        repoPath: selectedDirectory,
        workspaceMode,
        adapter,
        model: currentModel,
        reasoningLevel: currentReasoningLevel,
        executionMode: currentExecutionMode,
      });

      if (!result.success) {
        setError(result.error ?? "Failed to create task");
        log.error("Quick entry task creation failed", {
          failedStep: result.failedStep,
          error: result.error,
        });
        return;
      }

      const taskId = result.data.task.id;
      editor.clear();
      await trpcClient.quickEntry.openTaskInMain.mutate({ taskId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      log.error("Quick entry submit threw", { err });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    selectedDirectory,
    isAuthenticated,
    adapter,
    lastUsedWorkspaceMode,
    modelOption,
    thoughtOption,
    modeOption,
    defaultInitialTaskMode,
    lastUsedInitialTaskMode,
  ]);

  const getPromptHistory = useCallback(
    () => useTaskInputHistoryStore.getState().entries.map((e) => e.text),
    [],
  );

  if (!isAuthenticated) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="flex w-full max-w-[600px] items-center gap-3 rounded-(--radius-4) border border-(--gray-5) bg-(--gray-2) px-4 py-3 shadow-2xl">
          <Text className="flex-1 text-(--gray-12) text-sm">
            Sign in to PostHog Code to use quick entry.
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-3">
      <div className="flex w-full max-w-[600px] flex-col gap-2 rounded-(--radius-4) border border-(--gray-5) bg-(--gray-2) p-3 shadow-2xl">
        <Flex gap="2" align="center" className="min-w-0">
          <ButtonGroup>
            <FolderPicker
              value={selectedDirectory}
              onChange={setSelectedDirectory}
              placeholder="Select repository..."
            />
          </ButtonGroup>
        </Flex>

        <Flex direction="column" gap="0">
          <PromptInput
            ref={editorRef}
            sessionId={SESSION_ID}
            placeholder={`What do you want to ship? ${hints}`}
            editorHeight="default"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            autoFocus
            clearOnSubmit={false}
            submitDisabledExternal={!canSubmit}
            repoPath={selectedDirectory || undefined}
            modeOption={modeOption}
            onModeChange={handleModeChange}
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
            getPromptHistory={getPromptHistory}
            onEmptyChange={setEditorIsEmpty}
            onSubmitClick={() => {
              void handleSubmit();
            }}
            onSubmit={() => {
              if (canSubmit) void handleSubmit();
            }}
          />
        </Flex>

        {error && <Text className="px-1 text-(--red-10) text-xs">{error}</Text>}
      </div>
    </div>
  );
}
