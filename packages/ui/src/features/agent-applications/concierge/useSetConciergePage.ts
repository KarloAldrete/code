import { useEffect } from "react";
import { type ConciergePageContext, useConciergeStore } from "./conciergeStore";

/**
 * Registers what the user is currently looking at so the concierge can resolve
 * deictic references and drive the right `focus_*` target. Each `/code/agents`
 * route calls this on mount. No cleanup: the next route overwrites the page, so
 * the last-viewed context persists (the dock only reads it inside `/code/agents`).
 */
export function useSetConciergePage(page: ConciergePageContext): void {
  const setPage = useConciergeStore((s) => s.setPage);
  const key = JSON.stringify(page);
  useEffect(() => {
    setPage(JSON.parse(key) as ConciergePageContext);
  }, [key, setPage]);
}
