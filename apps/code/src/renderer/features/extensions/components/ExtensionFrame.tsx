import {
  type ExtensionViewToHostMessage,
  POSTHOG_CODE_EXTENSION_API_VERSION,
} from "@posthog/code-extension-api";
import { useThemeStore } from "@renderer/stores/themeStore";
import { trpcClient } from "@renderer/trpc/client";
import type { ExtensionViewContribution } from "@shared/types/extensions";
import { logger } from "@utils/logger";
import { toast } from "@utils/toast";
import { useEffect, useRef } from "react";

const log = logger.scope("extension-view");

interface ExtensionFrameProps {
  item: ExtensionViewContribution;
  repoPath?: string | null;
  taskId?: string;
  className?: string;
}

function isBridgeMessage(data: unknown): data is ExtensionViewToHostMessage {
  return !!data && typeof data === "object" && "type" in data;
}

export function ExtensionFrame({
  item,
  repoPath,
  taskId,
  className,
}: ExtensionFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isBridgeMessage(event.data)) return;

      switch (event.data.type) {
        case "posthogCode.ready": {
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "posthogCode.hostReady",
              version: POSTHOG_CODE_EXTENSION_API_VERSION,
              extensionId: item.extensionId,
              viewId: item.id,
              location: item.location,
              ...(taskId ? { taskId } : {}),
              repoPath: repoPath ?? null,
              theme: isDarkMode ? "dark" : "light",
            },
            "*",
          );
          break;
        }
        case "posthogCode.log": {
          const level = event.data.level ?? "info";
          const metadata = {
            extensionId: item.extensionId,
            viewId: item.id,
            data: event.data.data,
          };
          if (level === "error") log.error(event.data.message, metadata);
          else if (level === "warning") log.warn(event.data.message, metadata);
          else if (level === "debug") log.debug(event.data.message, metadata);
          else log.info(event.data.message, metadata);
          break;
        }
        case "posthogCode.notify": {
          const level = event.data.level ?? "info";
          if (level === "error") toast.error(event.data.message);
          else if (level === "warning") toast.warning(event.data.message);
          else toast.info(event.data.message);
          break;
        }
        case "posthogCode.request": {
          const requestId = event.data.requestId;
          void trpcClient.extensions.handleViewMessage
            .mutate({
              viewId: item.id,
              message: event.data.payload,
              ...(taskId ? { taskId } : {}),
              repoPath: repoPath ?? null,
            })
            .then((result) => {
              iframeRef.current?.contentWindow?.postMessage(
                {
                  type: "posthogCode.response",
                  requestId,
                  ok: true,
                  payload: result.payload,
                },
                "*",
              );
            })
            .catch((error) => {
              iframeRef.current?.contentWindow?.postMessage(
                {
                  type: "posthogCode.response",
                  requestId,
                  ok: false,
                  error: error instanceof Error ? error.message : String(error),
                },
                "*",
              );
            });
          break;
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [item, isDarkMode, repoPath, taskId]);

  return (
    <iframe
      ref={iframeRef}
      title={item.title}
      src={item.html ? undefined : item.url}
      srcDoc={item.html}
      sandbox="allow-forms allow-popups allow-scripts"
      className={className ?? "h-full w-full border-0 bg-white"}
    />
  );
}
