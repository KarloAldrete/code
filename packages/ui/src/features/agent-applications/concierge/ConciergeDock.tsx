import {
  NavigationArrowIcon,
  PlusIcon,
  SidebarSimpleIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { useAuthenticatedClient } from "@posthog/ui/features/auth/authClient";
import { Button } from "@posthog/ui/primitives/Button";
import { Flex, Text, Tooltip } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { useAuthStateValue } from "../../auth/store";
import { AgentChatSurface } from "../components/AgentChatSurface";
import { AgentDetailEmptyState } from "../components/AgentDetailLayout";
import { useAgentApplication } from "../hooks/useAgentApplication";
import { useAgentChat } from "../hooks/useAgentChat";
import { resolveIngressBaseUrl } from "../utils/ingress";
import { ConciergeSecretForm } from "./ConciergeSecretForm";
import {
  CONCIERGE_SLUG,
  type ConciergePageContext,
  useConciergeStore,
} from "./conciergeStore";
import { useConciergeClientTools } from "./useConciergeClientTools";

const CHAT_ID = "concierge";

/** The "what am I looking at" object sent to the concierge (envelope + get_context). */
function buildConciergeContext(
  page: ConciergePageContext,
  followEnabled: boolean,
): Record<string, unknown> {
  const agent = "slug" in page ? page.slug : undefined;
  const sessionId = page.kind === "agent-session" ? page.sessionId : undefined;
  return {
    page: page.kind,
    agent,
    session_id: sessionId,
    follow_enabled: followEnabled,
    client: { kind: "posthog-code", version: "1" },
  };
}

/**
 * The concierge chat — an always-on dock talking to the deployed
 * `agent-concierge`. Streams through the shared `useAgentChat`/`AgentChatSurface`
 * stack, prepends the current `/code/agents` page context to the first message,
 * answers `get_context`, and lets the agent drive the UI via `focus_*`.
 */
export function ConciergeDock() {
  const { data: application } = useAgentApplication(CONCIERGE_SLUG);
  const cloudRegion = useAuthStateValue((s) => s.cloudRegion);
  const ingressBaseUrl = resolveIngressBaseUrl(
    application?.ingress_base_url,
    cloudRegion,
  );

  const client = useAuthenticatedClient();
  const page = useConciergeStore((s) => s.page);
  const followMode = useConciergeStore((s) => s.followMode);
  const setFollowMode = useConciergeStore((s) => s.setFollowMode);
  const setVisible = useConciergeStore((s) => s.setVisible);
  const seed = useConciergeStore((s) => s.seed);
  const consumeSeed = useConciergeStore((s) => s.consumeSeed);
  const pendingSecret = useConciergeStore((s) => s.pendingSecret);
  const setPendingSecret = useConciergeStore((s) => s.setPendingSecret);
  const [secretBusy, setSecretBusy] = useState(false);

  const clientTools = useConciergeClientTools();
  const chat = useAgentChat({
    chatId: CHAT_ID,
    agentSlug: CONCIERGE_SLUG,
    ingressBaseUrl,
    contextProvider: () => buildConciergeContext(page, followMode),
    clientTools,
  });

  // Resolve a pending set_secret: PUT the value straight to the env-keys API
  // (never through the agent), then wake the parked session with the outcome.
  async function submitSecret(value: string) {
    if (!pendingSecret) return;
    setSecretBusy(true);
    try {
      await client.setAgentEnvKey(
        pendingSecret.agentSlug,
        pendingSecret.secret,
        value,
      );
      await chat.resolveInteractiveTool(pendingSecret.callId, {
        result: {
          key: pendingSecret.secret,
          action: pendingSecret.mode ?? "set",
        },
      });
      setPendingSecret(null);
    } catch (err) {
      await chat.resolveInteractiveTool(pendingSecret.callId, {
        error: err instanceof Error ? err.message : "set_secret_failed",
      });
      setPendingSecret(null);
    } finally {
      setSecretBusy(false);
    }
  }

  function cancelSecret() {
    if (!pendingSecret) return;
    void chat.resolveInteractiveTool(pendingSecret.callId, {
      error: "user_cancelled",
    });
    setPendingSecret(null);
  }

  // Edit-with-AI hand-offs: send the seeded prompt once when a new seed lands.
  const lastSeedRef = useRef(0);
  useEffect(() => {
    if (seed && seed.seq !== lastSeedRef.current) {
      lastSeedRef.current = seed.seq;
      chat.send(seed.prompt);
      consumeSeed(seed.seq);
    }
  }, [seed, chat, consumeSeed]);

  return (
    <Flex direction="column" className="h-full min-h-0 bg-background">
      <Flex
        align="center"
        gap="2"
        className="shrink-0 border-(--gray-5) border-b px-3 py-2"
      >
        <SparkleIcon size={15} weight="fill" className="text-(--accent-9)" />
        <Text className="font-medium text-[13px] text-gray-12">Concierge</Text>
        <Flex align="center" gap="1" className="ml-auto">
          <Tooltip
            content={
              followMode
                ? "Following — the concierge can navigate your screen"
                : "Paused — the concierge won't navigate"
            }
          >
            <Button
              variant={followMode ? "soft" : "ghost"}
              color={followMode ? undefined : "gray"}
              size="1"
              onClick={() => setFollowMode(!followMode)}
            >
              <NavigationArrowIcon
                size={13}
                weight={followMode ? "fill" : "regular"}
              />
            </Button>
          </Tooltip>
          <Tooltip content="New chat">
            <Button
              variant="ghost"
              color="gray"
              size="1"
              onClick={() => {
                setPendingSecret(null);
                chat.newChat();
              }}
            >
              <PlusIcon size={14} />
            </Button>
          </Tooltip>
          <Tooltip content="Hide concierge">
            <Button
              variant="ghost"
              color="gray"
              size="1"
              onClick={() => setVisible(false)}
            >
              <SidebarSimpleIcon size={14} />
            </Button>
          </Tooltip>
        </Flex>
      </Flex>

      {!ingressBaseUrl ? (
        <div className="p-4">
          <AgentDetailEmptyState
            title="Concierge unavailable"
            description="The agent-concierge deployment has no reachable ingress in this environment."
          />
        </div>
      ) : (
        <AgentChatSurface
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          error={chat.error}
          emptyHint="Ask the concierge to inspect, debug, or edit your agents. It can see what you're looking at and walk you there."
          aboveComposer={
            pendingSecret ? (
              <ConciergeSecretForm
                pending={pendingSecret}
                busy={secretBusy}
                onSubmit={submitSecret}
                onCancel={cancelSecret}
              />
            ) : null
          }
          onSend={chat.send}
          onCancel={chat.cancel}
        />
      )}
    </Flex>
  );
}
