import { useFolders } from "@features/folders/hooks/useFolders";
import { Box, Button, Flex, Text, TextArea } from "@radix-ui/themes";
import { get } from "@renderer/di/container";
import { RENDERER_TOKENS } from "@renderer/di/tokens";
import type {
  TaskCreationInput,
  TaskService,
} from "@renderer/features/task-detail/service/service";
import { trpcClient } from "@renderer/trpc/client";
import { toast } from "@renderer/utils/toast";
import { useNavigationStore } from "@stores/navigationStore";
import { useWorkSkillsStore } from "@stores/workSkillsStore";
import { logger } from "@utils/logger";
import { useCallback, useState } from "react";
import { buildSkillGeneratorPrompt } from "../utils/buildSkillGeneratorPrompt";

const log = logger.scope("work-generate");

function deriveSkillName(prompt: string): string {
  const firstLine = prompt.trim().split(/\r?\n/)[0] ?? "";
  const trimmed = firstLine.slice(0, 60).trim();
  return trimmed || "Untitled skill";
}

function newSkillId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `skill-${Date.now()}`;
}

async function resolveRepoPath(folders: string[]): Promise<string> {
  if (folders.length > 0) return folders[0];
  return trpcClient.os.getHomeDir.query();
}

export function WorkGenerateView() {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addSkill = useWorkSkillsStore((s) => s.addSkill);
  const updateSkill = useWorkSkillsStore((s) => s.updateSkill);
  const navigateToWorkSkill = useNavigationStore((s) => s.navigateToWorkSkill);

  const { folders, isLoaded: foldersLoaded } = useFolders();

  const canSubmit = prompt.trim().length > 0 && !isSubmitting && foldersLoaded;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);

    const userPrompt = prompt.trim();
    const skillId = newSkillId();
    const skillName = deriveSkillName(userPrompt);

    addSkill({ id: skillId, name: skillName, prompt: userPrompt });

    try {
      const folderPaths = folders.map((f) => f.path);
      const repoPath = await resolveRepoPath(folderPaths);
      const wrappedPrompt = buildSkillGeneratorPrompt(userPrompt);

      const input: TaskCreationInput = {
        content: wrappedPrompt,
        repoPath,
        workspaceMode: "local",
      };

      const taskService = get<TaskService>(RENDERER_TOKENS.TaskService);
      const result = await taskService.createTask(input, (output) => {
        updateSkill(skillId, { taskId: output.task.id });
        navigateToWorkSkill(skillId);
      });

      if (!result.success) {
        toast.error("Failed to start skill generation", {
          description: result.error,
        });
        log.error("Skill generation failed", {
          failedStep: result.failedStep,
          error: result.error,
        });
      }
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to start skill generation", { description });
      log.error("Unexpected error during skill generation", { error });
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, prompt, addSkill, updateSkill, navigateToWorkSkill, folders]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      className="h-full w-full"
      px="4"
    >
      <Box className="w-full max-w-[640px]">
        <Box mb="3" className="text-center">
          <Text
            as="div"
            weight="medium"
            className="text-(--gray-12) text-[18px]"
          >
            Hello, normie. Let's help you win today...
          </Text>
          <Text as="div" className="mt-1 text-(--gray-11) text-[13px]">
            Describe what the skill should do.
          </Text>
        </Box>

        <Box className="rounded-(--radius-3) border border-(--gray-5) bg-(--color-panel-solid) p-3 shadow-sm">
          <TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Each Monday morning, summarise last week's deploys and any incidents."
            rows={5}
            size="3"
            disabled={isSubmitting}
            autoFocus
          />
          <Flex justify="end" align="center" gap="2" mt="3">
            <Text className="text-(--gray-10) text-[12px]">
              ⌘+Enter to submit
            </Text>
            <Button
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              loading={isSubmitting}
            >
              Generate skill
            </Button>
          </Flex>
        </Box>
      </Box>
    </Flex>
  );
}
