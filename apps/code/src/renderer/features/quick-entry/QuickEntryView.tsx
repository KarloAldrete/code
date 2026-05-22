import { useAuthStateValue } from "@features/auth/hooks/authQueries";
import { PromptInput } from "@features/message-editor/components/PromptInput";
import type { EditorHandle } from "@features/message-editor/types";
import { contentToXml } from "@features/message-editor/utils/content";
import { useSettingsStore } from "@features/settings/stores/settingsStore";
import {
  CaretDown,
  Folder as FolderIcon,
  Lightning,
} from "@phosphor-icons/react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  MenuLabel,
} from "@posthog/quill";
import { Flex, Text } from "@radix-ui/themes";
import { get } from "@renderer/di/container";
import { RENDERER_TOKENS } from "@renderer/di/tokens";
import type { TaskService } from "@renderer/features/task-detail/service/service";
import { trpcClient, useTRPC } from "@renderer/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { logger } from "@utils/logger";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

const log = logger.scope("quick-entry-view");

function hideWindow(): void {
  trpcClient.quickEntry.hide.mutate().catch((err) => {
    log.warn("Failed to hide quick entry window", { err });
  });
}

export function QuickEntryView() {
  const trpcReact = useTRPC();
  const editorRef = useRef<EditorHandle | null>(null);
  const [selectedRepoPath, setSelectedRepoPath] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = useAuthStateValue(
    (state) => state.status === "authenticated",
  );

  const lastUsedWorkspaceMode = useSettingsStore(
    (s) => s.lastUsedWorkspaceMode,
  );
  const lastUsedAdapter = useSettingsStore((s) => s.lastUsedAdapter);
  const lastUsedModel = useSettingsStore((s) => s.lastUsedModel);
  const lastUsedReasoningEffort = useSettingsStore(
    (s) => s.lastUsedReasoningEffort,
  );

  const { data: recentRepos = [] } = useQuery({
    ...trpcReact.quickEntry.getRecentRepos.queryOptions({ limit: 8 }),
  });

  useEffect(() => {
    if (selectedRepoPath) return;
    const first = recentRepos[0];
    if (first) setSelectedRepoPath(first.path);
  }, [recentRepos, selectedRepoPath]);

  const selectedRepo =
    recentRepos.find((r) => r.path === selectedRepoPath) ?? null;

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

  const handleSubmit = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || isSubmitting) return;

    const content = editor.getContent();
    const xml = contentToXml(content).trim();
    if (!xml) return;

    if (!selectedRepoPath) {
      setError("Pick a folder first");
      return;
    }
    if (!isAuthenticated) {
      setError("Sign in to PostHog Code first");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const workspaceMode =
        lastUsedWorkspaceMode === "cloud" ? "local" : lastUsedWorkspaceMode;
      const taskService = get<TaskService>(RENDERER_TOKENS.TaskService);
      const result = await taskService.createTask({
        content: xml,
        repoPath: selectedRepoPath,
        workspaceMode,
        adapter: lastUsedAdapter,
        model: lastUsedModel ?? undefined,
        reasoningLevel: lastUsedReasoningEffort ?? undefined,
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
    selectedRepoPath,
    isAuthenticated,
    lastUsedWorkspaceMode,
    lastUsedAdapter,
    lastUsedModel,
    lastUsedReasoningEffort,
  ]);

  const repoDisplay = selectedRepo
    ? selectedRepo.name
    : recentRepos.length === 0
      ? "No folders yet"
      : "Pick a folder";

  if (!isAuthenticated) {
    return (
      <div className="h-full w-full p-4">
        <div className="flex h-full w-full items-center gap-3 rounded-(--radius-4) border border-(--gray-5) bg-(--gray-2) px-4 py-3 shadow-2xl">
          <Lightning
            size={20}
            weight="fill"
            className="shrink-0 text-(--orange-9)"
          />
          <Text className="flex-1 text-(--gray-12) text-sm">
            Sign in to PostHog Code to use quick entry.
          </Text>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              trpcClient.quickEntry.openTaskInMain.mutate({ taskId: "" })
            }
          >
            Open app
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-3">
      <div className="flex h-full w-full flex-col gap-1 rounded-(--radius-4) border border-(--gray-5) bg-(--gray-2) px-3 py-2 shadow-2xl">
        <Flex align="center" gap="3" className="min-w-0 flex-1">
          <Lightning
            size={18}
            weight="fill"
            className="shrink-0 text-(--orange-9)"
          />
          <div className="min-w-0 flex-1">
            <PromptInput
              ref={editorRef}
              sessionId="quick-entry"
              placeholder="What can I help you with today?"
              autoFocus
              clearOnSubmit
              onSubmit={() => {
                void handleSubmit();
              }}
              onSubmitClick={() => {
                void handleSubmit();
              }}
              isLoading={isSubmitting}
              submitDisabledExternal={!selectedRepoPath || isSubmitting}
              submitTooltipOverride={
                !selectedRepoPath ? "Pick a folder first" : "Send"
              }
              editorHeight="default"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={recentRepos.length === 0}
              >
                <FolderIcon size={14} />
                <Text className="max-w-[160px] truncate">{repoDisplay}</Text>
                <CaretDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <MenuLabel>Recent folders</MenuLabel>
              {recentRepos.map((repo) => (
                <DropdownMenuItem
                  key={repo.id}
                  onSelect={() => setSelectedRepoPath(repo.path)}
                >
                  <Flex direction="column" gap="0" className="min-w-0">
                    <Text className="truncate text-(--gray-12) text-sm">
                      {repo.name}
                    </Text>
                    <Text className="truncate text-(--gray-9) text-xs">
                      {repo.path}
                    </Text>
                  </Flex>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Flex>
        {error && <Text className="px-2 text-(--red-10) text-xs">{error}</Text>}
      </div>
    </div>
  );
}
