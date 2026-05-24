import { create } from "zustand";

/**
 * True when the renderer document is visible and the window has OS focus.
 * Used to pause inbox polling when the Electron window is in the background.
 */
function computeWindowFocused(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return document.visibilityState === "visible" && document.hasFocus();
}

interface RendererWindowFocusState {
  focused: boolean;
  // Timestamp (ms) of the most recent unfocused→focused transition. Pollers
  // use this to ramp polling back up after the user returns, then back off.
  focusedAt: number | null;
}

const initialFocused =
  typeof document !== "undefined" ? computeWindowFocused() : false;

export const useRendererWindowFocusStore = create<RendererWindowFocusState>(
  () => ({
    focused: initialFocused,
    focusedAt: initialFocused ? Date.now() : null,
  }),
);

let listenersAttached = false;

function ensureWindowFocusListeners(): void {
  if (typeof window === "undefined" || listenersAttached) {
    return;
  }
  listenersAttached = true;

  const sync = (): void => {
    const focused = computeWindowFocused();
    const prev = useRendererWindowFocusStore.getState().focused;
    if (focused === prev) return;
    useRendererWindowFocusStore.setState({
      focused,
      focusedAt: focused ? Date.now() : null,
    });
  };

  window.addEventListener("focus", sync);
  window.addEventListener("blur", sync);
  document.addEventListener("visibilitychange", sync);
}

ensureWindowFocusListeners();
