import type { Nest, Proposal } from "@main/services/hedgemony/schemas";
import { ProposalRow } from "./ProposalRow";

interface NoticesListProps {
  proposals: Proposal[];
  nestsById: Record<string, Nest>;
  onAccept: (id: string) => Promise<unknown>;
  onDismiss: (id: string) => Promise<unknown>;
  onSnooze: (id: string) => Promise<unknown>;
}

export function NoticesList({
  proposals,
  nestsById,
  onAccept,
  onDismiss,
  onSnooze,
}: NoticesListProps) {
  if (proposals.length === 0) {
    return (
      <div className="flex h-full min-h-[64px] items-center justify-center px-3 py-6 text-(--gray-10) text-[12px]">
        Nothing to review
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2">
      {proposals.map((proposal) => (
        <ProposalRow
          key={proposal.id}
          proposal={proposal}
          nestsById={nestsById}
          onAccept={onAccept}
          onDismiss={onDismiss}
          onSnooze={onSnooze}
        />
      ))}
    </div>
  );
}
