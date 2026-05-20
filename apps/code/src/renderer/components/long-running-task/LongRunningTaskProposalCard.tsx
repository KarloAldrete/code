import { getSessionService } from "@features/sessions/service/service";
import { Button, Flex, Text, TextArea, TextField } from "@radix-ui/themes";
import { trpcClient } from "@renderer/trpc/client";
import { useLongRunningTaskStore } from "@stores/longRunningTaskStore";
import { logger } from "@utils/logger";
import { toast } from "@utils/toast";
import { useCallback, useEffect, useState } from "react";

const log = logger.scope("long-running-task-proposal");

interface LongRunningTaskProposalCardProps {
  taskId: string;
  taskRunId: string;
}

export function LongRunningTaskProposalCard({
  taskId,
  taskRunId,
}: LongRunningTaskProposalCardProps) {
  const proposal = useLongRunningTaskStore(
    (s) => s.proposalsByTaskRunId[taskRunId],
  );
  const clearProposal = useLongRunningTaskStore((s) => s.clearProposal);

  const [goal, setGoal] = useState("");
  const [successCriterion, setSuccessCriterion] = useState("");
  const [maxIterations, setMaxIterations] = useState(20);
  const [marker, setMarker] = useState("<TASK_COMPLETE>");
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!proposal) return;
    setGoal(proposal.goal);
    setSuccessCriterion(proposal.successCriterion);
    setMaxIterations(proposal.maxIterations);
    setMarker(proposal.marker);
    setEditing(false);
  }, [proposal]);

  const start = useCallback(async () => {
    if (!proposal) return;
    setSubmitting(true);
    try {
      await trpcClient.agent.startLongRunningTask.mutate({
        sessionId: taskRunId,
        goal: goal.trim(),
        successCriterion: successCriterion.trim(),
        marker: marker.trim(),
        maxIterations,
      });
      clearProposal(taskRunId);
      const kickoff =
        "Configuration approved. Begin work toward the goal now. " +
        `Run the verification command(s) for the success criterion after each meaningful change. ` +
        `Output \`${marker.trim()}\` on its own line only after you have actually observed the criterion satisfied.`;
      await getSessionService().sendPrompt(taskId, kickoff);
    } catch (err) {
      log.error("Failed to start long-running task", { err });
      toast.error("Failed to start long-running task");
    } finally {
      setSubmitting(false);
    }
  }, [
    proposal,
    taskRunId,
    taskId,
    goal,
    successCriterion,
    marker,
    maxIterations,
    clearProposal,
  ]);

  const dismiss = useCallback(() => {
    clearProposal(taskRunId);
  }, [taskRunId, clearProposal]);

  if (!proposal) return null;

  const canStart =
    goal.trim().length > 0 &&
    successCriterion.trim().length > 0 &&
    marker.trim().length > 0 &&
    maxIterations > 0;

  return (
    <Flex
      direction="column"
      gap="3"
      className="rounded-md border-2 border-iris-6 bg-iris-2 p-4"
    >
      <Flex align="center" justify="between">
        <Text size="2" weight="medium" className="text-iris-12">
          Start long-running task?
        </Text>
        <Text size="1" className="text-iris-11">
          Auto-continues until verification passes or {maxIterations}{" "}
          iterations.
        </Text>
      </Flex>

      {editing ? (
        <Flex direction="column" gap="2">
          <FieldLabel>Goal</FieldLabel>
          <TextArea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
          />
          <FieldLabel>Success criterion (objectively measurable)</FieldLabel>
          <TextArea
            value={successCriterion}
            onChange={(e) => setSuccessCriterion(e.target.value)}
            rows={2}
          />
          <Flex gap="3">
            <Flex direction="column" gap="1" className="flex-1">
              <FieldLabel>Completion marker</FieldLabel>
              <TextField.Root
                value={marker}
                onChange={(e) => setMarker(e.target.value)}
              />
            </Flex>
            <Flex direction="column" gap="1" style={{ width: 120 }}>
              <FieldLabel>Max iterations</FieldLabel>
              <TextField.Root
                type="number"
                min={1}
                max={200}
                value={maxIterations}
                onChange={(e) =>
                  setMaxIterations(
                    Math.max(1, Math.min(200, Number(e.target.value) || 0)),
                  )
                }
              />
            </Flex>
          </Flex>
        </Flex>
      ) : (
        <Flex direction="column" gap="2">
          <FieldRow label="Goal" value={goal} />
          <FieldRow label="Success criterion" value={successCriterion} />
          {proposal.approach && (
            <FieldRow label="Approach" value={proposal.approach} />
          )}
          <FieldRow label="Marker" value={marker} mono />
          <FieldRow label="Max iterations" value={String(maxIterations)} mono />
        </Flex>
      )}

      <Flex gap="2" justify="end">
        <Button
          size="2"
          variant="soft"
          color="gray"
          onClick={dismiss}
          disabled={submitting}
        >
          Cancel
        </Button>
        {editing ? (
          <Button
            size="2"
            variant="soft"
            onClick={() => setEditing(false)}
            disabled={submitting}
          >
            Done editing
          </Button>
        ) : (
          <Button
            size="2"
            variant="soft"
            onClick={() => setEditing(true)}
            disabled={submitting}
          >
            Edit
          </Button>
        )}
        <Button
          size="2"
          onClick={start}
          disabled={submitting || !canStart}
          loading={submitting}
        >
          Start
        </Button>
      </Flex>
    </Flex>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text size="1" className="text-iris-11">
      {children}
    </Text>
  );
}

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Flex direction="column" gap="1">
      <Text size="1" className="text-iris-11">
        {label}
      </Text>
      <Text
        size="2"
        className={mono ? "font-mono text-iris-12" : "text-iris-12"}
      >
        {value}
      </Text>
    </Flex>
  );
}
