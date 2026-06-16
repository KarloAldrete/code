import { useNavigate } from "@tanstack/react-router";
import { useCallback, useRef } from "react";
import type { ClientToolHandler } from "../hooks/useAgentChat";
import { useConciergeStore } from "./conciergeStore";

/**
 * The concierge's UI-driving client tools. The agent calls these to steer the
 * user's screen (`focus_*`); they navigate code's agent routes and report back
 * `{ focused }`. `set_secret` is not handled yet (lands with C4) — it falls
 * through to the hook's `unhandled_client_tool`, and the agent degrades to its
 * deep-link fallback. Returning `null` defers to the built-in toast/get_context.
 *
 * `focus_*` navigations are gated by follow-mode: when off, they report
 * `{ focused: false, reason: "user_paused_follow" }` instead of moving the UI.
 */
export function useConciergeClientTools(): ClientToolHandler {
  const navigate = useNavigate();
  const followMode = useConciergeStore((s) => s.followMode);
  const followRef = useRef(followMode);
  followRef.current = followMode;

  return useCallback(
    (data) => {
      if (!data.tool_id.startsWith("focus_")) return null;
      const args = (data.args ?? {}) as Record<string, unknown>;
      const slug = typeof args.slug === "string" ? args.slug : undefined;
      if (!followRef.current) {
        return { result: { focused: false, reason: "user_paused_follow" } };
      }
      if (!slug) {
        return { result: { focused: false, reason: "missing_slug" } };
      }
      const params = { idOrSlug: slug };
      const str = (v: unknown) => (typeof v === "string" ? v : undefined);

      switch (data.tool_id) {
        case "focus_tab": {
          const tab = str(args.tab) ?? "overview";
          switch (tab) {
            case "configuration":
              navigate({
                to: "/code/agents/applications/$idOrSlug/configuration",
                params,
              });
              break;
            case "sessions":
              navigate({
                to: "/code/agents/applications/$idOrSlug/sessions",
                params,
              });
              break;
            case "memory":
              navigate({
                to: "/code/agents/applications/$idOrSlug/memory",
                params,
              });
              break;
            case "approvals":
              navigate({
                to: "/code/agents/applications/$idOrSlug/approvals",
                params,
              });
              break;
            case "observability":
              navigate({
                to: "/code/agents/applications/$idOrSlug/observability",
                params,
              });
              break;
            case "chat":
              navigate({
                to: "/code/agents/applications/$idOrSlug/chat",
                params,
              });
              break;
            default:
              navigate({
                to: "/code/agents/applications/$idOrSlug",
                params,
              });
          }
          return { result: { focused: true } };
        }
        case "focus_file":
          navigate({
            to: "/code/agents/applications/$idOrSlug/configuration",
            params,
            search: { node: str(args.path) },
          });
          return { result: { focused: true } };
        case "focus_spec_section":
          navigate({
            to: "/code/agents/applications/$idOrSlug/configuration",
            params,
            search: { node: str(args.section) },
          });
          return { result: { focused: true } };
        case "focus_revision":
          navigate({
            to: "/code/agents/applications/$idOrSlug/configuration",
            params,
            search: { revision: str(args.revisionId) },
          });
          return { result: { focused: true } };
        case "focus_session": {
          const sessionId = str(args.sessionId);
          if (!sessionId) {
            return { result: { focused: false, reason: "missing_session_id" } };
          }
          navigate({
            to: "/code/agents/applications/$idOrSlug/sessions/$sessionId",
            params: { idOrSlug: slug, sessionId },
          });
          return { result: { focused: true } };
        }
        default:
          return { result: { focused: false, reason: "unknown_focus_target" } };
      }
    },
    [navigate],
  );
}
