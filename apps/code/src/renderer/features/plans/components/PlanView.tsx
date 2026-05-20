import {
  baseComponents,
  MarkdownRenderer,
} from "@features/editor/components/MarkdownRenderer";
import { usePendingPermissionsForTask } from "@features/sessions/hooks/useSession";
import { getSessionService } from "@features/sessions/service/service";
import type { PermissionRequest } from "@features/sessions/utils/parseSessionLogs";
import { CheckCircle, ListChecks, X } from "@phosphor-icons/react";
import { Button } from "@posthog/quill";
import { Box, Flex, Text } from "@radix-ui/themes";
import { trpc, trpcClient } from "@renderer/trpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { logger } from "@utils/logger";
import { useCallback, useEffect, useMemo, useState } from "react";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";
import { remarkPlanThreads } from "../remark/remarkPlanThreads";
import { usePlanAgentActivityStore } from "../stores/planAgentActivityStore";
import { extractThreadKeys } from "../utils/extractThreadKeys";
import { handlePlanDeletion } from "../utils/handlePlanDeletion";
import { PlanBlockGutter } from "./PlanBlockGutter";
import { PlanThread } from "./PlanThread";

const log = logger.scope("plan-view");

interface PlanViewProps {
  taskId: string;
  filePath: string;
}

interface PlanThreadElementProps {
  "data-block-text"?: string;
  "data-occurrence"?: string | number;
  "data-messages"?: string;
  "data-resolved"?: string;
}

function parseOccurrence(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "plan-thread": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & PlanThreadElementProps,
        HTMLElement
      >;
    }
  }
}

interface PendingPlanPermission {
  toolCallId: string;
  approveOptionId: string;
  rejectOptionId: string | null;
}

function findPendingPlanPermission(
  permissions: Map<string, PermissionRequest>,
): PendingPlanPermission | null {
  for (const req of permissions.values()) {
    const toolCallId = req.toolCall?.toolCallId;
    if (!toolCallId) continue;
    if (req.toolCall?.kind !== "switch_mode") continue;

    // First option is the user's previous mode (or `auto` by default) —
    // see buildExitPlanModePermissionOptions in @posthog/agent.
    const approve = req.options.find(
      (o) => o.kind === "allow_once" || o.kind === "allow_always",
    );
    if (!approve) continue;

    const reject = req.options.find(
      (o) => o.kind === "reject_once" || o.kind === "reject_always",
    );

    return {
      toolCallId,
      approveOptionId: approve.optionId,
      rejectOptionId: reject?.optionId ?? null,
    };
  }
  return null;
}

interface PlanApprovalBarProps {
  taskId: string;
  permission: PendingPlanPermission;
}

function PlanApprovalBar({ taskId, permission }: PlanApprovalBarProps) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);

  const respond = useCallback(
    async (optionId: string, customInput?: string) => {
      try {
        await getSessionService().respondToPermission(
          taskId,
          permission.toolCallId,
          optionId,
          customInput,
        );
      } catch (err) {
        log.warn("Failed to respond to plan approval", { err });
      }
    },
    [taskId, permission.toolCallId],
  );

  const handleApprove = useCallback(async () => {
    setPending("approve");
    await respond(permission.approveOptionId);
    setPending(null);
  }, [respond, permission.approveOptionId]);

  const handleReject = useCallback(async () => {
    if (!permission.rejectOptionId) return;
    setPending("reject");
    await respond(permission.rejectOptionId, rejectReason.trim() || undefined);
    setPending(null);
    setShowRejectInput(false);
    setRejectReason("");
  }, [respond, permission.rejectOptionId, rejectReason]);

  return (
    <Box className="sticky top-0 z-10 border-(--gray-5) border-b bg-(--color-background) px-12 py-3">
      <Flex direction="column" gap="2">
        <Flex align="center" justify="between" gap="3">
          <Text className="text-(--gray-11) text-sm">
            The agent is waiting for plan approval.
          </Text>
          <Flex gap="2">
            {permission.rejectOptionId && (
              <Button
                size="sm"
                onClick={() => setShowRejectInput((v) => !v)}
                disabled={!!pending}
              >
                <X />
                Reject
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleApprove}
              disabled={!!pending}
            >
              <CheckCircle />
              {pending === "approve" ? "Approving…" : "Approve plan"}
            </Button>
          </Flex>
        </Flex>
        {showRejectInput && permission.rejectOptionId && (
          <Flex direction="column" gap="2">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Tell the agent what to do differently (optional)…"
              className="min-h-[60px] w-full resize-none rounded border border-(--gray-6) bg-(--color-background) p-2 text-(--gray-12) text-[13px] leading-normal outline-none"
            />
            <Flex gap="2">
              <Button
                size="sm"
                variant="primary"
                onClick={handleReject}
                disabled={!!pending}
              >
                {pending === "reject" ? "Sending…" : "Send rejection"}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setShowRejectInput(false);
                  setRejectReason("");
                }}
              >
                Cancel
              </Button>
            </Flex>
          </Flex>
        )}
      </Flex>
    </Box>
  );
}

export function PlanView({ taskId, filePath }: PlanViewProps) {
  const queryClient = useQueryClient();
  const planQuery = useQuery(
    trpc.plans.read.queryOptions({ filePath }, { staleTime: 0 }),
  );

  const pendingPermissions = usePendingPermissionsForTask(taskId);
  const planPermission = useMemo(
    () => findPendingPlanPermission(pendingPermissions),
    [pendingPermissions],
  );

  useEffect(() => {
    void trpcClient.plans.ensureWatching.mutate().catch((err) => {
      log.warn("Failed to ensure plans watcher started", { err });
    });
  }, []);

  useSubscription(
    trpc.plans.onChanged.subscriptionOptions(undefined, {
      onData: (payload) => {
        if (payload.filePath === filePath) {
          queryClient.invalidateQueries(
            trpc.plans.read.queryFilter({ filePath }),
          );
        }
      },
    }),
  );

  useSubscription(
    trpc.plans.onDeleted.subscriptionOptions(undefined, {
      onData: (payload) => {
        handlePlanDeletion({
          deletedPath: payload.filePath,
          currentPath: filePath,
          clearCache: () => {
            queryClient.setQueryData(trpc.plans.read.queryKey({ filePath }), {
              content: null,
            });
          },
          onCleared: () => {
            queryClient.invalidateQueries(
              trpc.plans.read.queryFilter({ filePath }),
            );
          },
        });
      },
    }),
  );

  const remarkPlugins = useMemo<PluggableList>(
    () => [remarkGfm, remarkPlanThreads],
    [],
  );

  // Garbage-collect the activity-store queue whenever the plan content
  // changes. Resolve-then-rewrite flows can remove a thread block
  // without ever posting an `[A]:` reply inside it, which would
  // otherwise leak the entry. Sweeping by "which thread keys still
  // exist in the file" is StrictMode-safe (no race with unmount).
  const syncActivityQueue = usePlanAgentActivityStore((s) => s.syncQueue);
  const planContent = planQuery.data?.content ?? null;
  useEffect(() => {
    if (planContent === null) return;
    syncActivityQueue(extractThreadKeys(planContent, filePath));
  }, [planContent, filePath, syncActivityQueue]);

  const components = useMemo(() => {
    const wrap = <Tag extends keyof typeof baseComponents>(tag: Tag) => {
      const Original = baseComponents[tag];
      return function Wrapped(props: Record<string, unknown>) {
        const blockText = props["data-plan-block"] as string | undefined;
        const occurrence = parseOccurrence(props["data-occurrence"]);
        const {
          "data-plan-block": _unusedBlock,
          "data-occurrence": _unusedOcc,
          ...rest
        } = props;
        return (
          <PlanBlockGutter
            blockText={blockText}
            occurrence={occurrence}
            filePath={filePath}
            taskId={taskId}
          >
            {Original
              ? (Original as (p: unknown) => React.ReactNode)(rest)
              : null}
          </PlanBlockGutter>
        );
      };
    };

    // Wrap only the components whose mdast types are in
    // `remarkPlanThreads`'s `ANCHORABLE_TYPES`. The set must agree on
    // both sides — see the comment in `remarkPlanThreads.ts` for why
    // `code` / `table` are excluded.
    return {
      h1: wrap("h1"),
      h2: wrap("h2"),
      h3: wrap("h3"),
      h4: wrap("h4"),
      h5: wrap("h5"),
      h6: wrap("h6"),
      p: wrap("p"),
      ul: wrap("ul"),
      ol: wrap("ol"),
      "plan-thread": (props: PlanThreadElementProps) => {
        const blockText = props["data-block-text"] ?? "";
        const occurrence = parseOccurrence(props["data-occurrence"]);
        const messages = (() => {
          try {
            return JSON.parse(props["data-messages"] ?? "[]");
          } catch {
            return [];
          }
        })();
        const resolved = props["data-resolved"] === "true";
        return (
          <PlanThread
            filePath={filePath}
            taskId={taskId}
            blockText={blockText}
            occurrence={occurrence}
            messages={messages}
            resolved={resolved}
          />
        );
      },
    } as never;
  }, [filePath, taskId]);

  const content = planContent;

  if (planQuery.isLoading && content === null) {
    return (
      <Flex align="center" justify="center" className="h-full">
        <Text className="text-(--gray-10) text-sm">Loading plan…</Text>
      </Flex>
    );
  }

  if (!content) {
    return (
      <Flex
        align="center"
        justify="center"
        className="h-full"
        direction="column"
        gap="2"
      >
        <ListChecks size={24} className="text-(--gray-10)" />
        <Text className="text-(--gray-10) text-sm">No plan to display.</Text>
      </Flex>
    );
  }

  return (
    <Box className="relative h-full overflow-y-auto">
      {planPermission && (
        <PlanApprovalBar taskId={taskId} permission={planPermission} />
      )}
      <Box className="plan-markdown mx-auto max-w-[820px] px-12 py-8 text-(--gray-12)">
        <MarkdownRenderer
          content={content}
          remarkPluginsOverride={remarkPlugins}
          componentsOverride={components}
        />
      </Box>
    </Box>
  );
}
