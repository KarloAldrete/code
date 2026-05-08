import { ActionSelector } from "@components/ActionSelector";
import { toSelectorOptions } from "@components/permissions/types";
import { getSessionService } from "@features/sessions/service/service";
import {
  type PlanAnnotationDraft,
  usePlanAnnotationDraftsStore,
} from "@features/sessions/stores/planAnnotationDraftsStore";
import { usePendingPermissionsForTask } from "@features/sessions/stores/sessionStore";
import { buildPlanAnnotationsPrompt } from "@features/sessions/utils/planAnnotationPrompts";
import { ChatTeardropDots, PaperPlaneTilt, Trash } from "@phosphor-icons/react";
import {
  Box,
  Button,
  Flex,
  IconButton,
  Separator,
  Text,
  TextArea,
} from "@radix-ui/themes";
import { useCallback, useMemo, useState } from "react";

interface PlanReviewSidebarProps {
  taskId: string;
  toolCallId: string;
  onSubmitted?: () => void;
}

export function PlanReviewSidebar({
  taskId,
  toolCallId,
  onSubmitted,
}: PlanReviewSidebarProps) {
  const drafts = usePlanAnnotationDraftsStore((s) =>
    (s.drafts[taskId] ?? []).filter((d) => d.toolCallId === toolCallId),
  );
  const removeDraft = usePlanAnnotationDraftsStore((s) => s.removeDraft);

  const pendingPermissions = usePendingPermissionsForTask(taskId);
  const permission = pendingPermissions.get(toolCallId);

  const sortedDrafts = useMemo(
    () => [...drafts].sort((a, b) => a.startLine - b.startLine),
    [drafts],
  );

  const clearScopedDrafts = useCallback(() => {
    for (const draft of sortedDrafts) {
      removeDraft(taskId, draft.id);
    }
  }, [removeDraft, taskId, sortedDrafts]);

  const handleSendComments = useCallback(async () => {
    if (sortedDrafts.length === 0 || !permission) return;
    const prompt = buildPlanAnnotationsPrompt(sortedDrafts);
    await getSessionService().respondToPermission(
      taskId,
      toolCallId,
      "reject_with_feedback",
      prompt,
    );
    clearScopedDrafts();
    onSubmitted?.();
  }, [
    sortedDrafts,
    permission,
    taskId,
    toolCallId,
    clearScopedDrafts,
    onSubmitted,
  ]);

  const handleSelectorSelect = useCallback(
    async (
      optionId: string,
      customInput?: string,
      answers?: Record<string, string>,
    ) => {
      if (!permission) return;
      await getSessionService().respondToPermission(
        taskId,
        toolCallId,
        optionId,
        customInput,
        answers,
      );
      clearScopedDrafts();
      onSubmitted?.();
    },
    [permission, taskId, toolCallId, clearScopedDrafts, onSubmitted],
  );

  const handleSelectorCancel = useCallback(async () => {
    if (!permission) return;
    await getSessionService().cancelPermission(taskId, toolCallId);
  }, [permission, taskId, toolCallId]);

  return (
    <Flex
      direction="column"
      className="h-full w-[360px] border-(--gray-6) border-l"
    >
      <Flex
        align="center"
        gap="2"
        className="border-(--gray-6) border-b px-4 py-2"
      >
        <ChatTeardropDots size={14} className="text-(--gray-11)" />
        <Text className="text-(--gray-11) text-sm">
          {sortedDrafts.length === 0
            ? "Review plan"
            : `${sortedDrafts.length} comment${sortedDrafts.length === 1 ? "" : "s"}`}
        </Text>
      </Flex>

      <Box className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {sortedDrafts.length === 0 ? (
          <Box className="px-2 py-3">
            <Text size="1" color="gray">
              Hover any block in the plan and click the + to leave an inline
              comment. On submit, the plan will be rejected and your feedback
              will be sent to the agent in a single batch.
            </Text>
          </Box>
        ) : (
          <Flex direction="column" gap="2">
            {sortedDrafts.map((draft) => (
              <DraftRow
                key={draft.id}
                taskId={taskId}
                draft={draft}
                onDelete={() => removeDraft(taskId, draft.id)}
              />
            ))}
          </Flex>
        )}
      </Box>

      <Separator size="4" />

      <Box className="flex-shrink-0 p-3">
        {sortedDrafts.length > 0 && (
          <Box className="mb-3">
            <Button
              size="2"
              variant="solid"
              onClick={handleSendComments}
              disabled={!permission}
              className="w-full"
            >
              <PaperPlaneTilt size={14} weight="bold" />
              Send {sortedDrafts.length} comment
              {sortedDrafts.length === 1 ? "" : "s"}
            </Button>
          </Box>
        )}

        {permission ? (
          <ActionSelector
            title="Implementation Plan"
            question={
              sortedDrafts.length > 0
                ? "Or pick an option below:"
                : "Approve this plan to proceed?"
            }
            options={toSelectorOptions(permission.options)}
            onSelect={handleSelectorSelect}
            onCancel={handleSelectorCancel}
          />
        ) : (
          <Text size="1" color="gray">
            This plan has been resolved.
          </Text>
        )}
      </Box>
    </Flex>
  );
}

function DraftRow({
  taskId,
  draft,
  onDelete,
}: {
  taskId: string;
  draft: PlanAnnotationDraft;
  onDelete: () => void;
}) {
  const updateDraft = usePlanAnnotationDraftsStore((s) => s.updateDraft);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(draft.text);

  const lineRef =
    draft.startLine === draft.endLine
      ? `Line ${draft.startLine}`
      : `Lines ${draft.startLine}-${draft.endLine}`;

  const save = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== draft.text) {
      updateDraft(taskId, draft.id, trimmed);
    } else if (!trimmed) {
      setValue(draft.text);
    }
    setEditing(false);
  };

  return (
    <Box className="rounded-md border border-(--gray-6) bg-(--gray-2) p-2">
      <Flex align="center" justify="between" gap="2" className="mb-1">
        <Text size="1" color="gray" className="font-medium">
          {lineRef}
        </Text>
        <IconButton
          size="1"
          variant="ghost"
          color="gray"
          onClick={onDelete}
          aria-label="Delete comment"
        >
          <Trash size={12} />
        </IconButton>
      </Flex>
      {editing ? (
        <TextArea
          size="1"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.currentTarget.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              setValue(draft.text);
              setEditing(false);
            }
          }}
          className="min-h-[60px]"
        />
      ) : (
        <Text
          as="div"
          size="1"
          className="cursor-text whitespace-pre-wrap text-(--gray-12)"
          onClick={() => setEditing(true)}
        >
          {draft.text}
        </Text>
      )}
    </Box>
  );
}
