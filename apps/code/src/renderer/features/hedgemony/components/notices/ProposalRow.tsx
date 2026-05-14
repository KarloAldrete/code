import type { Nest, Proposal } from "@main/services/hedgemony/schemas";
import {
  ArrowsMerge,
  ArrowsSplit,
  HandHeart,
  LinkSimple,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { Button } from "@radix-ui/themes";
import { useState } from "react";
import { formatProposalEvidence } from "./proposalEvidence";
import { formatProposalTitle } from "./proposalTitle";

const KIND_ICON = {
  merge: ArrowsMerge,
  split: ArrowsSplit,
  bridge: LinkSimple,
  forward: PaperPlaneTilt,
  adopt: HandHeart,
} as const;

interface ProposalRowProps {
  proposal: Proposal;
  nestsById: Record<string, Nest>;
  onAccept: (id: string) => Promise<unknown>;
  onDismiss: (id: string) => Promise<unknown>;
  onSnooze: (id: string) => Promise<unknown>;
}

type Pending = "accept" | "dismiss" | "snooze" | null;

export function ProposalRow({
  proposal,
  nestsById,
  onAccept,
  onDismiss,
  onSnooze,
}: ProposalRowProps) {
  const Icon = KIND_ICON[proposal.kind];
  const title = formatProposalTitle(proposal, nestsById);
  const evidence = formatProposalEvidence(proposal);
  const [pending, setPending] = useState<Pending>(null);

  const run = async (
    kind: NonNullable<Pending>,
    action: () => Promise<unknown>,
  ) => {
    if (pending) return;
    setPending(kind);
    try {
      await action();
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-(--radius-2) border border-(--gray-4) bg-(--gray-a2) px-3 py-2 transition-colors hover:border-(--accent-7)">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-(--radius-2) bg-(--accent-a3) text-(--accent-11)">
        <Icon size={14} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="truncate font-medium text-(--gray-12) text-[12px] leading-tight">
          {title}
        </div>
        {evidence && (
          <div className="truncate text-(--gray-10) text-[11px]">
            {evidence}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="1"
          variant="solid"
          color="green"
          disabled={pending !== null}
          loading={pending === "accept"}
          onClick={() => run("accept", () => onAccept(proposal.id))}
        >
          Accept
        </Button>
        <Button
          size="1"
          variant="ghost"
          color="gray"
          disabled={pending !== null}
          loading={pending === "snooze"}
          onClick={() => run("snooze", () => onSnooze(proposal.id))}
        >
          Snooze
        </Button>
        <Button
          size="1"
          variant="ghost"
          color="gray"
          disabled={pending !== null}
          loading={pending === "dismiss"}
          onClick={() => run("dismiss", () => onDismiss(proposal.id))}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
