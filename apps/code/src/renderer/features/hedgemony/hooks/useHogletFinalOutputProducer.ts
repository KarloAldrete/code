import {
  type AgentSession,
  useSessionStore,
} from "@features/sessions/stores/sessionStore";
import { useFeatureFlag } from "@hooks/useFeatureFlag";
import type { Hoglet } from "@main/services/hedgemony/schemas";
import { trpcClient } from "@renderer/trpc/client";
import { HEDGEMONY_FLAG } from "@shared/constants";
import { logger } from "@utils/logger";
import { useEffect, useRef } from "react";
import { useHogletStore } from "../stores/hogletStore";
import {
  extractTerminalAssistantOutput,
  hasTurnComplete,
  looksLikeHogletFinalOutput,
} from "../utils/hogletFinalOutput";

const log = logger.scope("hoglet-final-output-producer");
const HOGLET_FINAL_OUTPUT_MAX_CHARS = 30_000;

/**
 * Watches session-store growth for Hedgemony hoglets and mirrors deliverable
 * terminal assistant turns into nest chat as attributed `tool_result` rows.
 *
 * This intentionally lives on the Hedgemony side of the boundary: SessionService
 * owns generic cloud log ingestion; this hook owns Hedgemony-specific side
 * effects when the app-level Hedgemony hooks are mounted.
 */
export function useHogletFinalOutputProducer() {
  const hedgemonyEnabled = useFeatureFlag(HEDGEMONY_FLAG, import.meta.env.DEV);
  const recordedKeysRef = useRef<Set<string>>(new Set());
  const processedCountsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!hedgemonyEnabled) return;

    const handleStoreChange = () => {
      const hogletsByTaskId = collectHogletsByTaskId(useHogletStore.getState());
      if (hogletsByTaskId.size === 0) return;

      const sessions = useSessionStore.getState().sessions;
      for (const [taskRunId, session] of Object.entries(sessions)) {
        processSession({
          taskRunId,
          session,
          hogletsByTaskId,
          recordedKeys: recordedKeysRef.current,
          processedCounts: processedCountsRef.current,
        });
      }
    };

    const unsubscribeSessions = useSessionStore.subscribe(handleStoreChange);
    const unsubscribeHoglets = useHogletStore.subscribe(handleStoreChange);
    handleStoreChange();
    return () => {
      unsubscribeSessions();
      unsubscribeHoglets();
    };
  }, [hedgemonyEnabled]);
}

function processSession(input: {
  taskRunId: string;
  session: AgentSession;
  hogletsByTaskId: Map<string, Hoglet>;
  recordedKeys: Set<string>;
  processedCounts: Map<string, number>;
}): void {
  const { taskRunId, session, hogletsByTaskId, recordedKeys, processedCounts } =
    input;
  if (!session.isCloud) return;

  const hoglet = hogletsByTaskId.get(session.taskId);
  if (!hoglet?.nestId) return;

  const total = session.events.length;
  const lastSeen = processedCounts.get(taskRunId) ?? 0;
  if (total <= lastSeen) return;

  const newEvents = session.events.slice(lastSeen);
  processedCounts.set(taskRunId, total);
  if (!hasTurnComplete(newEvents)) return;

  const key = `${hoglet.id}:${taskRunId}`;
  if (recordedKeys.has(key)) return;

  const output = extractTerminalAssistantOutput(session.events);
  if (!output || !looksLikeHogletFinalOutput(output)) return;

  const body = truncateFinalOutput(output);
  recordedKeys.add(key);
  trpcClient.hedgemony.nestChat.recordHogletFinalOutput
    .mutate({
      nestId: hoglet.nestId,
      hogletId: hoglet.id,
      taskId: session.taskId,
      runId: taskRunId,
      body,
    })
    .catch((error) => {
      recordedKeys.delete(key);
      log.warn("failed to record hoglet final output", {
        hogletId: hoglet.id,
        taskId: session.taskId,
        taskRunId,
        error,
      });
    });
}

function collectHogletsByTaskId(
  state: ReturnType<typeof useHogletStore.getState>,
) {
  const hogletsByTaskId = new Map<string, Hoglet>();
  for (const hoglets of Object.values(state.byBucket)) {
    for (const hoglet of hoglets) {
      hogletsByTaskId.set(hoglet.taskId, hoglet);
    }
  }
  return hogletsByTaskId;
}

function truncateFinalOutput(body: string): string {
  if (body.length <= HOGLET_FINAL_OUTPUT_MAX_CHARS) return body;
  const suffix = "\n\n[Final output truncated for nest chat.]";
  return `${body.slice(0, HOGLET_FINAL_OUTPUT_MAX_CHARS - suffix.length)}${suffix}`;
}
