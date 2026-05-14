import { GitHubRepoPicker } from "@features/folder-picker/components/GitHubRepoPicker";
import { useFunSpeak } from "@features/fun-mode/hooks/useFunSpeak";
import type { TaskService } from "@features/task-detail/service/service";
import {
  useUserGithubRepositories,
  useUserRepositoryIntegration,
} from "@hooks/useIntegrations";
import { Button, Text, TextArea } from "@radix-ui/themes";
import { get as getFromContainer } from "@renderer/di/container";
import { RENDERER_TOKENS } from "@renderer/di/tokens";
import { trpcClient } from "@renderer/trpc/client";
import { ANALYTICS_EVENTS } from "@shared/types/analytics";
import { track } from "@utils/analytics";
import { logger } from "@utils/logger";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useHogletStore, WILD_BUCKET } from "../stores/hogletStore";
import { CommandConsole } from "./CommandConsole";

const log = logger.scope("spawn-hoglet-panel");

export interface SpawnHogletPanelProps {
  onClose: () => void;
}

export function SpawnHogletPanel({ onClose }: SpawnHogletPanelProps) {
  const t = useFunSpeak();
  const [prompt, setPrompt] = useState("");
  const [selectedRepository, setSelectedRepository] = useState<string | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRepoPickerOpen, setIsRepoPickerOpen] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState("");

  const {
    repositories,
    isLoadingRepos,
    isRefreshingRepos,
    refreshRepositories,
  } = useUserRepositoryIntegration();
  const {
    repositories: visibleCloudRepositories,
    isPending: cloudRepositoriesLoading,
    hasMore: cloudRepositoriesHasMore,
    loadMore: loadMoreCloudRepositories,
  } = useUserGithubRepositories(repoSearchQuery, isRepoPickerOpen);

  const handleRepositorySelect = useCallback((repo: string | null) => {
    setSelectedRepository(repo ? repo.toLowerCase() : null);
  }, []);

  const handleRepoPickerOpenChange = useCallback((nextOpen: boolean) => {
    setIsRepoPickerOpen(nextOpen);
    if (!nextOpen) {
      setRepoSearchQuery("");
    }
  }, []);

  const handleRefreshRepositories = useCallback(() => {
    void refreshRepositories().catch((e) => {
      toast.error("Failed to refresh repositories", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    });
  }, [refreshRepositories]);

  const trimmedPrompt = prompt.trim();
  const canSubmit =
    trimmedPrompt.length > 0 && selectedRepository !== null && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || submitting || !selectedRepository) return;
    setSubmitting(true);
    setError(null);
    try {
      const taskService = getFromContainer<TaskService>(
        RENDERER_TOKENS.TaskService,
      );
      const result = await taskService.createTask({
        content: trimmedPrompt,
        workspaceMode: "cloud",
        repository: selectedRepository,
        cloudPrAuthorshipMode: "bot",
        cloudRunSource: "manual",
      });

      if (!result.success) {
        const message = result.error ?? "Failed to spawn hoglet";
        log.error("Task creation failed", {
          failedStep: result.failedStep,
          error: result.error,
        });
        setError(message);
        setSubmitting(false);
        return;
      }

      const taskId = result.data.task.id;
      const hoglet = await trpcClient.hedgemony.hoglets.recordAdhoc.mutate({
        taskId,
      });

      useHogletStore.getState().upsert(WILD_BUCKET, hoglet);
      track(ANALYTICS_EVENTS.HEDGEMONY_HOGLET_SPAWNED, { source: "adhoc" });
      onClose();
    } catch (e) {
      log.error("Failed to spawn wild hoglet", { error: e });
      setError(e instanceof Error ? e.message : "Failed to spawn hoglet");
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) onClose();
  };

  return (
    <CommandConsole
      consoleKey="spawn-hoglet"
      size="wide"
      style={{ maxHeight: "min(80%, 560px)" }}
    >
      <CommandConsole.Header
        eyebrow={t("Hedgehouse")}
        title={t("Send out a wild hog")}
        subtitle="Dispatched from the town hall of the wilds — lands in the holding area, no nest required."
        onClose={handleClose}
        closeDisabled={submitting}
      />

      <CommandConsole.Body scroll>
        <div>
          <Text
            as="label"
            htmlFor="hoglet-prompt"
            size="2"
            mb="1"
            weight="medium"
            className="block"
          >
            {t("Prompt")}
          </Text>
          <TextArea
            id="hoglet-prompt"
            placeholder="Describe what this agent should do."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            autoFocus
            disabled={submitting}
          />
        </div>

        <div>
          <Text as="div" size="2" mb="1" weight="medium" className="block">
            {t("Repository")}
          </Text>
          <GitHubRepoPicker
            value={selectedRepository}
            onChange={handleRepositorySelect}
            repositories={
              isRepoPickerOpen ? visibleCloudRepositories : repositories
            }
            isLoading={
              isLoadingRepos || (isRepoPickerOpen && cloudRepositoriesLoading)
            }
            isRefreshing={isRefreshingRepos}
            onRefresh={handleRefreshRepositories}
            open={isRepoPickerOpen}
            onOpenChange={handleRepoPickerOpenChange}
            searchQuery={repoSearchQuery}
            onSearchQueryChange={setRepoSearchQuery}
            hasMore={cloudRepositoriesHasMore}
            onLoadMore={loadMoreCloudRepositories}
            placeholder="Select repository..."
            size="2"
            side="top"
            disabled={submitting}
          />
        </div>

        {error && (
          <Text size="2" color="red">
            {error}
          </Text>
        )}
      </CommandConsole.Body>

      <CommandConsole.Footer>
        <Button
          variant="soft"
          color="gray"
          disabled={submitting}
          onClick={handleClose}
        >
          {t("Cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          loading={submitting}
        >
          {t("Send wild hog")}
        </Button>
      </CommandConsole.Footer>
    </CommandConsole>
  );
}
