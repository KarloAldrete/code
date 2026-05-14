import { KeyHint } from "@components/ui/KeyHint";
import { useFunSpeak } from "@features/fun-mode/hooks/useFunSpeak";
import { NoticesList } from "@features/hedgemony/components/notices/NoticesList";
import { useFederation } from "@features/hedgemony/hooks/useFederation";
import { useNestStore } from "@features/hedgemony/stores/nestStore";
import { Bell, Info, Lightning, Plus } from "@phosphor-icons/react";
import { ScrollArea, Tooltip } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { CommandConsole } from "./CommandConsole";

interface BuilderCommandPanelProps {
  /** Guided path: conversational goal-writing flow → full spec. */
  onBuildNest: () => void;
  /** Simple path: one-field form → minimal nest + auto-spawned first hoglet. */
  onQuickNest: () => void;
  onClose: () => void;
}

function formatUnreadCount(count: number): string {
  if (count > 9) return "9+";
  return String(count);
}

export function BuilderCommandPanel({
  onBuildNest,
  onQuickNest,
  onClose,
}: BuilderCommandPanelProps) {
  const t = useFunSpeak();
  const [noticesOpen, setNoticesOpen] = useState(false);
  const {
    openProposals,
    unreadCount,
    acceptProposal,
    dismissProposal,
    snoozeProposal,
    markNoticesRead,
  } = useFederation();
  const nestsById = useNestStore((s) => s.nests);

  useHotkeys("b", onBuildNest, [onBuildNest]);
  useHotkeys("q", onQuickNest, [onQuickNest]);
  useHotkeys("n", () => setNoticesOpen((open) => !open), []);

  useEffect(() => {
    if (noticesOpen && unreadCount > 0) {
      markNoticesRead();
    }
  }, [noticesOpen, unreadCount, markNoticesRead]);

  return (
    <CommandConsole consoleKey="builder-command">
      {noticesOpen && (
        <div className="flex max-h-[280px] min-h-[80px] flex-col border-(--accent-a5) border-b">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="font-mono text-(--accent-11) text-[10px] uppercase tracking-[0.18em]">
              Notices
            </span>
            <span className="text-(--gray-10) text-[11px]">
              {openProposals.length === 0
                ? "All clear"
                : openProposals.length === 1
                  ? "1 open"
                  : `${openProposals.length} open`}
            </span>
          </div>
          <ScrollArea
            type="auto"
            scrollbars="vertical"
            className="min-h-0 flex-1"
          >
            <NoticesList
              proposals={openProposals}
              nestsById={nestsById}
              onAccept={acceptProposal}
              onDismiss={dismissProposal}
              onSnooze={snoozeProposal}
            />
          </ScrollArea>
        </div>
      )}
      <div className="flex items-stretch gap-3 px-3 py-2">
        <CommandConsole.Section noDivider className="min-w-[120px] pr-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-(--gray-12) text-[13px]">
              {t("Builder")}
            </span>
            <Tooltip
              content={
                <div className="flex max-w-[260px] flex-col gap-1.5">
                  <span className="font-medium">
                    Nests are long-running goals.
                  </span>
                  <span className="text-[11px] opacity-90">
                    A hedgehog orchestrates the brood — coordinates hoglets,
                    tracks PR dependencies, and judges goal completion.
                  </span>
                  <span className="text-[11px] opacity-90">
                    For one-off tasks, use the Hedgehouse instead.
                  </span>
                </div>
              }
            >
              <Info
                size={12}
                className="cursor-help text-(--accent-10) hover:text-(--accent-12)"
              />
            </Tooltip>
          </div>
          <span className="text-(--gray-10) text-[11px]">
            {t("Nests for orchestrated work")}
          </span>
        </CommandConsole.Section>

        <CommandConsole.Section className="flex-row items-center gap-2">
          <button
            type="button"
            onClick={onBuildNest}
            className="flex h-9 items-center gap-1.5 rounded-(--radius-2) border border-(--accent-7) bg-(--accent-a3) px-3 font-medium text-(--accent-11) text-[12px] transition-colors hover:bg-(--accent-a5) hover:text-(--accent-12)"
            title="Guided goal-writing flow with a clarifying question and full spec (B)"
          >
            <Plus size={14} />
            {t("Build nest")}
            <KeyHint className="ml-1">B</KeyHint>
          </button>
          <button
            type="button"
            onClick={onQuickNest}
            className="flex h-9 items-center gap-1.5 rounded-(--radius-2) border border-(--gray-6) bg-(--gray-a2) px-3 font-medium text-(--gray-12) text-[12px] transition-colors hover:bg-(--gray-a4)"
            title="Simple form + auto-spawn one hoglet (Q)"
          >
            <Lightning size={14} />
            {t("Quick nest")}
            <KeyHint className="ml-1">Q</KeyHint>
          </button>
          <button
            type="button"
            onClick={() => setNoticesOpen((open) => !open)}
            aria-pressed={noticesOpen}
            aria-label={
              unreadCount > 0 ? `Notices (${unreadCount} unread)` : "Notices"
            }
            className={`relative flex h-9 items-center gap-1.5 rounded-(--radius-2) border px-3 font-medium text-[12px] transition-colors ${
              noticesOpen
                ? "border-(--accent-7) bg-(--accent-a3) text-(--accent-11) hover:bg-(--accent-a5) hover:text-(--accent-12)"
                : "border-(--gray-6) bg-(--gray-a2) text-(--gray-12) hover:bg-(--gray-a4)"
            }`}
            title="Builder notices (N)"
          >
            <Bell size={14} />
            {t("Notices")}
            {unreadCount > 0 && (
              <span
                data-testid="notices-tab-badge"
                className="ml-0.5 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-(--red-9) px-1 font-medium text-[10px] text-white leading-none"
              >
                {formatUnreadCount(unreadCount)}
              </span>
            )}
            <KeyHint className="ml-1">N</KeyHint>
          </button>
        </CommandConsole.Section>

        <CommandConsole.Section className="pr-1 pl-2">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-(--gray-10) text-[10px] uppercase tracking-wider hover:text-(--gray-12)"
            title="Deselect (Esc)"
          >
            Esc
          </button>
        </CommandConsole.Section>
      </div>
    </CommandConsole>
  );
}
