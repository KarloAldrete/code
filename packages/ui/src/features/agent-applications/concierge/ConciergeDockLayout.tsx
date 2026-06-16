import { SparkleIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ConciergeDock } from "./ConciergeDock";
import { useConciergeStore } from "./conciergeStore";

/**
 * Wraps the `/code/agents` content in a resizable split with the always-on
 * concierge dock pinned right. Hidden by default; toggled via the edge
 * affordance, the dock's hide button, or Cmd/Ctrl+I. Panel sizes persist
 * (`autoSaveId`). When hidden, the content renders unchanged and a thin edge
 * affordance offers to open the dock.
 */
export function ConciergeDockLayout({ children }: { children: ReactNode }) {
  const visible = useConciergeStore((s) => s.visible);
  const toggleVisible = useConciergeStore((s) => s.toggleVisible);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.key.toLowerCase() !== "i") return;
      const t = e.target as HTMLElement | null;
      if (
        t?.tagName === "INPUT" ||
        t?.tagName === "TEXTAREA" ||
        t?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      toggleVisible();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleVisible]);

  if (!visible) {
    return (
      <>
        {children}
        <ConciergeShowAffordance />
      </>
    );
  }

  return (
    <PanelGroup
      direction="horizontal"
      autoSaveId="agents-concierge-dock"
      className="h-full min-h-0"
    >
      <Panel
        order={1}
        defaultSize={68}
        minSize={40}
        className="flex min-h-0 flex-col"
      >
        {children}
      </Panel>
      <PanelResizeHandle className="w-px bg-(--gray-5) transition-colors hover:bg-(--gray-7) data-[resize-handle-state=drag]:bg-(--accent-9)" />
      <Panel
        order={2}
        defaultSize={32}
        minSize={22}
        maxSize={48}
        className="flex min-h-0 flex-col"
      >
        <ConciergeDock />
      </Panel>
    </PanelGroup>
  );
}

function ConciergeShowAffordance() {
  const setVisible = useConciergeStore((s) => s.setVisible);
  return (
    <button
      type="button"
      aria-label="Open concierge"
      title="Open concierge (⌘I)"
      onClick={() => setVisible(true)}
      className="-translate-y-1/2 fixed top-1/2 right-0 z-30 flex h-12 w-7 items-center justify-center rounded-l-(--radius-3) border border-(--gray-5) border-r-0 bg-background text-(--accent-9) shadow-sm transition-colors hover:bg-(--gray-3)"
    >
      <SparkleIcon size={15} weight="fill" />
    </button>
  );
}
