import { CheckIcon, LockKeyIcon, XIcon } from "@phosphor-icons/react";
import { formatRelativeTimeShort } from "@posthog/shared";
import type {
  AgentApprovalRequest,
  DecideApprovalRequest,
} from "@posthog/shared/agent-platform-types";
import { Badge } from "@posthog/ui/primitives/Badge";
import { Button } from "@posthog/ui/primitives/Button";
import { CodeBlock } from "@posthog/ui/primitives/CodeBlock";
import { Checkbox, Flex, IconButton, Text, TextArea } from "@radix-ui/themes";
import { useState } from "react";
import { useDecideAgentApproval } from "../hooks/useDecideAgentApproval";
import { approvalStateColor, approvalStateLabel } from "../utils/format";
import { AgentSessionDetailBody } from "./AgentSessionDetailBody";

type Pane = "approval" | "session";

/**
 * Master-detail panel for a single approval. The **Approval** tab carries the
 * proposed args + decision controls; the **Session** tab embeds the agent run
 * that proposed the gated call (via {@link AgentSessionDetailBody}) so the
 * approver can read the full context that led to it.
 */
export function AgentApprovalDetail({
  idOrSlug,
  approval,
  onClose,
}: {
  idOrSlug: string;
  approval: AgentApprovalRequest;
  onClose: () => void;
}) {
  const [pane, setPane] = useState<Pane>("approval");
  const isQueued = approval.state === "queued";

  return (
    <Flex direction="column" className="h-full min-h-0">
      <Flex
        direction="column"
        gap="3"
        className="shrink-0 border-(--gray-5) border-b px-5 pt-4"
      >
        <Flex align="start" justify="between" gap="3">
          <Flex direction="column" gap="1" className="min-w-0">
            <Flex align="center" gap="2" className="min-w-0">
              <LockKeyIcon size={14} className="shrink-0 text-gray-10" />
              <Text className="truncate font-semibold text-[14px] text-gray-12 [font-family:var(--font-mono)]">
                {approval.tool_name}
              </Text>
              <Badge color={approvalStateColor(approval.state)}>
                {approvalStateLabel(approval.state)}
              </Badge>
            </Flex>
            <Text className="text-[11px] text-gray-10">
              {isQueued
                ? `expires ${formatRelativeTimeShort(approval.expires_at)}`
                : `created ${formatRelativeTimeShort(approval.created_at)}`}
            </Text>
          </Flex>
          <IconButton
            size="1"
            variant="ghost"
            color="gray"
            onClick={onClose}
            aria-label="Close approval"
          >
            <XIcon size={15} />
          </IconButton>
        </Flex>

        <Flex gap="1" className="-mb-px">
          {(["approval", "session"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPane(p)}
              className={`border-b-2 px-3 pb-2.5 text-[12.5px] capitalize ${
                p === pane
                  ? "border-(--accent-9) font-medium text-gray-12"
                  : "border-transparent text-gray-11 hover:text-gray-12"
              }`}
            >
              {p}
            </button>
          ))}
        </Flex>
      </Flex>

      {pane === "approval" ? (
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <ArgsSection
            label="Proposed arguments"
            args={approval.proposed_args}
          />
          {isQueued ? (
            <DecisionForm idOrSlug={idOrSlug} approval={approval} />
          ) : (
            <DecidedOutcome approval={approval} />
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <AgentSessionDetailBody
            idOrSlug={idOrSlug}
            sessionId={approval.session_id}
          />
        </div>
      )}
    </Flex>
  );
}

function DecisionForm({
  idOrSlug,
  approval,
}: {
  idOrSlug: string;
  approval: AgentApprovalRequest;
}) {
  const decide = useDecideAgentApproval(idOrSlug);
  const allowEdit = approval.approver_scope?.allow_edit === true;
  const [reason, setReason] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [argsText, setArgsText] = useState(() =>
    JSON.stringify(approval.proposed_args, null, 2),
  );
  const [parseError, setParseError] = useState<string | null>(null);

  function submit(decision: "approve" | "reject") {
    const body: DecideApprovalRequest = { decision };
    if (reason.trim()) body.reason = reason.trim();
    if (decision === "approve" && allowEdit && editMode) {
      try {
        body.edited_args = JSON.parse(argsText);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Invalid JSON");
        return;
      }
    }
    setParseError(null);
    decide.mutate({ approvalId: approval.id, body });
  }

  return (
    <Flex direction="column" gap="3" className="mt-4">
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

      {decide.isError ? (
        <Text className="text-(--red-11) text-[11px]">
          {decide.error instanceof Error
            ? decide.error.message
            : "Decision failed"}
        </Text>
      ) : null}

      <Flex gap="2">
        <Button
          color="green"
          size="2"
          onClick={() => submit("approve")}
          disabled={decide.isPending}
          loading={decide.isPending}
        >
          <CheckIcon size={14} />
          Approve
        </Button>
        <Button
          color="red"
          variant="soft"
          size="2"
          onClick={() => submit("reject")}
          disabled={decide.isPending}
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
    <Flex direction="column" gap="2" className="mt-4">
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
