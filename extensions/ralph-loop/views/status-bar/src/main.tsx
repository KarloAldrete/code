import {
  createPostHogCodeBridge,
  type ExtensionBridgeHostReadyMessage,
} from "@posthog/code-extension-api";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type RalphStatusState = "idle" | "active" | "unavailable";

interface RalphStatus {
  state: RalphStatusState;
  label: string;
  tooltip?: string;
}

function isHostReady(data: unknown): data is ExtensionBridgeHostReadyMessage {
  return (
    !!data &&
    typeof data === "object" &&
    "type" in data &&
    data.type === "posthogCode.hostReady"
  );
}

function normalizeStatus(value: unknown): RalphStatus {
  if (!value || typeof value !== "object") {
    return { state: "idle", label: "Ralph idle" };
  }

  const record = value as Record<string, unknown>;
  const state =
    record.state === "active" ||
    record.state === "unavailable" ||
    record.state === "idle"
      ? record.state
      : "idle";
  const label =
    typeof record.label === "string" && record.label.trim()
      ? record.label
      : "Ralph idle";
  const tooltip =
    typeof record.tooltip === "string" && record.tooltip.trim()
      ? record.tooltip
      : undefined;

  return { state, label, tooltip };
}

const bridge = createPostHogCodeBridge();

function RalphStatusBadge() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hostReady, setHostReady] = useState(false);
  const [status, setStatus] = useState<RalphStatus>({
    state: "idle",
    label: "Ralph loading…",
  });

  const refresh = useCallback(async () => {
    if (!hostReady) return;

    try {
      const nextStatus = await bridge.request({ type: "ralph.status" });
      setStatus(normalizeStatus(nextStatus));
    } catch (error) {
      setStatus({ state: "unavailable", label: "Ralph status error" });
      bridge.log("Failed to refresh Ralph status", String(error), "warning");
    }
  }, [hostReady]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!isHostReady(event.data)) return;
      setHostReady(true);
      setTheme(event.data.theme ?? "light");
    };

    window.addEventListener("message", handleMessage);
    bridge.ready();
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!hostReady) return;

    void refresh();
    const interval = window.setInterval(() => void refresh(), 2_000);
    return () => window.clearInterval(interval);
  }, [hostReady, refresh]);

  return (
    <main className={`app ${theme}`}>
      <div
        className={`badge ${status.state}`}
        title={status.tooltip ?? status.label}
      >
        <span className="dot" />
        <span className="label">{status.label}</span>
      </div>
    </main>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<RalphStatusBadge />);
}
