import { trpcClient, useTRPC } from "@renderer/trpc";
import { useNavigationStore } from "@stores/navigationStore";
import { useSubscription } from "@trpc/tanstack-react-query";
import { logger } from "@utils/logger";
import { useCallback, useEffect, useRef } from "react";

const log = logger.scope("new-task-deep-link");

export function useNewTaskDeepLink() {
  const trpcReact = useTRPC();
  const navigateToTaskInput = useNavigationStore((s) => s.navigateToTaskInput);
  const pendingDrainedRef = useRef(false);

  const openNewTask = useCallback(
    (prompt: string) => {
      log.info("Opening new task from deep link", {
        promptLength: prompt.length,
      });
      navigateToTaskInput({ initialPrompt: prompt });
    },
    [navigateToTaskInput],
  );

  useEffect(() => {
    if (pendingDrainedRef.current) return;

    pendingDrainedRef.current = true;
    void (async () => {
      try {
        const pending = await trpcClient.deepLink.getPendingNewTaskLink.query();
        if (pending?.prompt) {
          openNewTask(pending.prompt);
        }
      } catch (error) {
        log.error("Failed to check for pending new task deep link:", error);
      }
    })();
  }, [openNewTask]);

  useSubscription(
    trpcReact.deepLink.onOpenNewTask.subscriptionOptions(undefined, {
      onData: (data) => {
        if (data?.prompt) {
          openNewTask(data.prompt);
        }
      },
    }),
  );
}
