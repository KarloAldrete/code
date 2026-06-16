import {
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon,
  LockKeyIcon,
  XIcon,
} from "@phosphor-icons/react";
import { formatRelativeTimeShort } from "@posthog/shared";
import type {
  AgentApprovalRequest,
  AgentApprovalRequestState,
  DecideApprovalRequest,
} from "@posthog/shared/agent-platform-types";
import { Badge } from "@posthog/ui/primitives/Badge";
import { Button } from "@posthog/ui/primitives/Button";
import { CodeBlock } from "@posthog/ui/primitives/CodeBlock";
import { Checkbox, Flex, Text, TextArea } from "@radix-ui/themes";
import { useState } from "react";
import { useAgentApplicationApprovals } from "../hooks/useAgentApplicationApprovals";
import { useDecideAgentApproval } from "../hooks/useDecideAgentApproval";
import { approvalStateColor, approvalStateLabel } from "../utils/format";
import { AgentDetailEmptyState, AgentDetailLayout } from "./AgentDetailLayout";

type Filter = AgentApprovalRequestState | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "queued", label: "Queued" },
  { id: "dispatched", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "expired", label: "Expired" },
  { id: "all", label: "All" },
];

/**
 * Per-agent Approvals pane: the queue of approval-gated tool calls, filtered by
 * state, with an inline approve/reject decision form (supporting edited args
 * and a reason where the tool's policy allows it).
 */
export function AgentApprovalsPane({ idOrSlug }: { idOrSlug: string }) {
  const [filter, setFilter] = useState<Filter>("queued");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: approvals,
    isLoading,
    isError,
  } = useAgentApplicationApprovals(
    idOrSlug,
    filter === "all" ? undefined : { state: filter },
  );
  const decide = useDecideAgentApproval(idOrSlug);
  const decidingId = decide.isPending
    ? (decide.variables?.approvalId ?? null)
    : null;

  return (
    <AgentDetailLayout idOrSlug={idOrSlug} activeTab="approvals">
      <Flex direction="column" gap="4">
        <Flex gap="1.5" wrap="wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1 text-[12px] ${
                filter === f.id
                  ? "border-(--accent-7) bg-(--accent-3) text-gray-12"
                  : "border-border text-gray-11 hover:border-(--gray-7)"
              }`}
            >
              {f.label}
            </button>
          ))}
        </Flex>

        {isLoading ? (
          <Flex direction="column" gap="2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[60px] animate-pulse rounded-(--radius-2) border border-border bg-(--gray-2)"
              />
            ))}
          </Flex>
        ) : isError ? (
          <AgentDetailEmptyState
            title="Couldn't load approvals"
            description="The agent platform API returned an error. Approvals are team-admin only — you may not have access."
          />
        ) : !approvals || approvals.length === 0 ? (
          <AgentDetailEmptyState
            title="Nothing here"
            description={
              filter === "queued"
                ? "No tool calls are waiting for a decision."
                : "No approval requests match this filter."
            }
          />
        ) : (
          <Flex direction="column" gap="2">
            {approvals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                expanded={expandedId === approval.id}
                onToggle={() =>
                  setExpandedId((id) =>
                    id === approval.id ? null : approval.id,
                  )
                }
                deciding={decidingId === approval.id}
                onDecide={(body) =>
                  decide.mutate({ approvalId: approval.id, body })
                }
              />
            ))}
          </Flex>
        )}
      </Flex>
    </AgentDetailLayout>
  );
}

function ApprovalCard({
  approval,
  expanded,
  onToggle,
  deciding,
  onDecide,
}: {
  approval: AgentApprovalRequest;
  expanded: boolean;
  onToggle: () => void;
  deciding: boolean;
  onDecide: (body: DecideApprovalRequest) => void;
}) {
  const isQueued = approval.state === "queued";
  const allowEdit = approval.approver_scope?.allow_edit === true;

  return (
    <div className="rounded-(--radius-2) border border-border bg-(--color-panel-solid)">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-(--gray-2)"
      >
        {expanded ? (
          <CaretDownIcon size={13} className="shrink-0 text-gray-10" />
        ) : (
          <CaretRightIcon size={13} className="shrink-0 text-gray-10" />
        )}
        <LockKeyIcon size={13} className="shrink-0 text-gray-10" />
        <Flex direction="column" gap="1" className="min-w-0 flex-1">
          <Flex align="center" gap="2" className="min-w-0">
            <Badge color={approvalStateColor(approval.state)}>
              {approvalStateLabel(approval.state)}
            </Badge>
            <Text className="truncate font-medium text-[12.5px] text-gray-12 [font-family:var(--font-mono)]">
              {approval.tool_name}
            </Text>
          </Flex>
          <Text className="truncate text-[11px] text-gray-10">
            {summarizeArgs(approval.proposed_args)}
          </Text>
        </Flex>
        <Text className="shrink-0 text-[11px] text-gray-10">
          {isQueued
            ? `expires ${formatRelativeTimeShort(approval.expires_at)}`
            : formatRelativeTimeShort(approval.created_at)}
        </Text>
      </button>

      {expanded ? (
        <div className="border-(--gray-5) border-t px-4 py-3">
          <ArgsSection
            label="Proposed arguments"
            args={approval.proposed_args}
          />
          {isQueued ? (
            <DecisionForm
              allowEdit={allowEdit}
              proposedArgs={approval.proposed_args}
              deciding={deciding}
              onDecide={onDecide}
            />
          ) : (
            <DecidedOutcome approval={approval} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function DecisionForm({
  allowEdit,
  proposedArgs,
  deciding,
  onDecide,
}: {
  allowEdit: boolean;
  proposedArgs: Record<string, unknown>;
  deciding: boolean;
  onDecide: (body: DecideApprovalRequest) => void;
}) {
  const [reason, setReason] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [argsText, setArgsText] = useState(() =>
    JSON.stringify(proposedArgs, null, 2),
  );
  const [parseError, setParseError] = useState<string | null>(null);

  function approve() {
    const body: DecideApprovalRequest = { decision: "approve" };
    if (reason.trim()) body.reason = reason.trim();
    if (allowEdit && editMode) {
      try {
        body.edited_args = JSON.parse(argsText);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Invalid JSON");
        return;
      }
    }
    setParseError(null);
    onDecide(body);
  }

  function reject() {
    const body: DecideApprovalRequest = { decision: "reject" };
    if (reason.trim()) body.reason = reason.trim();
    onDecide(body);
  }

  return (
    <Flex direction="column" gap="3" className="mt-3">
      {allowEdit ? (
        <Text as="label" className="w-fit text-[12px] text-gray-11">
          <Flex gap="2" align="center">
            <Checkbox
              size="1"
              checked={editMode}
              onCheckedChange={(c) => setEditMode(c === true)}
            />
            Approve with edits
          </Flex>
        </Text>
      ) : null}

      {allowEdit && editMode ? (
        <div>
          <TextArea
            value={argsText}
            onChange={(e) => setArgsText(e.target.value)}
            rows={8}
            className="text-[12px] [font-family:var(--font-mono)]"
            spellCheck={false}
          />
          {parseError ? (
            <Text className="mt-1 block text-(--red-11) text-[11px]">
              {parseError}
            </Text>
          ) : null}
        </div>
      ) : null}

      <TextArea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        rows={2}
        className="text-[12px]"
      />

      <Flex gap="2">
        <Button
          color="green"
          size="2"
          onClick={approve}
          disabled={deciding}
          loading={deciding}
        >
          <CheckIcon size={14} />
          Approve
        </Button>
        <Button
          color="red"
          variant="soft"
          size="2"
          onClick={reject}
          disabled={deciding}
        >
          <XIcon size={14} />
          Reject
        </Button>
      </Flex>
    </Flex>
  );
}

function DecidedOutcome({ approval }: { approval: AgentApprovalRequest }) {
  const dispatchError =
    approval.dispatch_outcome &&
    typeof approval.dispatch_outcome === "object" &&
    "error" in approval.dispatch_outcome
      ? String(approval.dispatch_outcome.error)
      : null;

  return (
    <Flex direction="column" gap="2" className="mt-3">
      {approval.decision_at ? (
        <Text className="text-[12px] text-gray-11">
          {approval.state === "rejected" ? "Rejected" : "Decided"}{" "}
          {formatRelativeTimeShort(approval.decision_at)}
          {approval.decision_by ? ` by ${approval.decision_by}` : ""}
        </Text>
      ) : null}
      {approval.decision_reason ? (
        <Text className="text-[12px] text-gray-11">
          Reason: {approval.decision_reason}
        </Text>
      ) : null}
      {approval.decided_args ? (
        <ArgsSection label="Edited arguments" args={approval.decided_args} />
      ) : null}
      {dispatchError ? (
        <Text className="text-(--red-11) text-[12px]">
          Dispatch error: {dispatchError}
        </Text>
      ) : null}
    </Flex>
  );
}

function ArgsSection({
  label,
  args,
}: {
  label: string;
  args: Record<string, unknown>;
}) {
  const isEmpty = !args || Object.keys(args).length === 0;
  return (
    <Flex direction="column" gap="1.5">
      <Text className="text-[11px] text-gray-10 uppercase tracking-wide">
        {label}
      </Text>
      {isEmpty ? (
        <Text className="text-[12px] text-gray-10">No arguments</Text>
      ) : (
        <CodeBlock>{JSON.stringify(args, null, 2)}</CodeBlock>
      )}
    </Flex>
  );
}

function summarizeArgs(args: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return "No arguments";
  const compact = JSON.stringify(args);
  return compact.length > 140 ? `${compact.slice(0, 140)}…` : compact;
}
