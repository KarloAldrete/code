import { useInboxReportSelectionStore } from "@features/inbox/stores/inboxReportSelectionStore";
import { setPendingInboxOpenMethod } from "@features/inbox/utils/pendingInboxOpenMethod";
import type { SignalReport } from "@shared/types";
import { useCallback, useEffect, useRef } from "react";

interface UseInboxKeyboardNavigationArgs {
  reports: SignalReport[];
}

interface UseInboxKeyboardNavigationResult {
  /** Move the keyboard cursor up/down. Returns the id of the report that is now the cursor, or null when the list is empty. */
  navigateReport: (direction: 1 | -1, shift: boolean) => string | null;
}

/**
 * Keyboard navigation for the inbox signal list.
 *
 * Maintains the keyboard "cursor" — the moving end of arrow-key navigation —
 * and syncs it to `lastClickedId` whenever the user clicks a report. Without
 * that sync, the cursor would drift: after clicking report B the next arrow
 * press would navigate from wherever the keyboard previously left off, not
 * from B.
 *
 * Shift+Arrow deliberately walks the cursor without touching `lastClickedId`,
 * so the anchor stays fixed while the selection extends.
 */
export function useInboxKeyboardNavigation({
  reports,
}: UseInboxKeyboardNavigationArgs): UseInboxKeyboardNavigationResult {
  const reportsRef = useRef(reports);
  reportsRef.current = reports;

  // The moving end of arrow-key navigation. Distinct from the store's
  // `lastClickedId` (the anchor) so Shift+Arrow can extend a range while
  // keeping the anchor fixed.
  const keyboardCursorIdRef = useRef<string | null>(
    useInboxReportSelectionStore.getState().lastClickedId,
  );

  // Sync the cursor to `lastClickedId` so any click (plain, cmd, shift, or
  // checkbox toggle) re-seats the keyboard cursor. Shift+Arrow leaves
  // `lastClickedId` unchanged (it's the anchor), so the cursor walks freely
  // in that one case.
  useEffect(() => {
    return useInboxReportSelectionStore.subscribe((state, prev) => {
      if (state.lastClickedId !== prev.lastClickedId) {
        keyboardCursorIdRef.current = state.lastClickedId;
      }
    });
  }, []);

  const navigateReport = useCallback(
    (direction: 1 | -1, shift: boolean): string | null => {
      const list = reportsRef.current;
      if (list.length === 0) return null;

      const store = useInboxReportSelectionStore.getState();
      const cursorId = keyboardCursorIdRef.current;
      const cursorIndex = cursorId
        ? list.findIndex((r) => r.id === cursorId)
        : -1;
      const nextIndex =
        cursorIndex === -1
          ? 0
          : Math.max(0, Math.min(list.length - 1, cursorIndex + direction));
      const nextId = list[nextIndex].id;

      if (shift) {
        const anchor = store.lastClickedId ?? nextId;
        setPendingInboxOpenMethod("keyboard");
        store.selectExactRange(
          anchor,
          nextId,
          list.map((r) => r.id),
        );
        // selectExactRange keeps lastClickedId as the anchor, so the
        // subscription above won't fire — track the moving end ourselves.
        keyboardCursorIdRef.current = nextId;
      } else {
        setPendingInboxOpenMethod("keyboard");
        store.setSelectedReportIds([nextId]);
        // setSelectedReportIds with a single id updates lastClickedId, so the
        // subscription will set keyboardCursorIdRef. No need to do it here.
      }

      return nextId;
    },
    [],
  );

  return { navigateReport };
}
