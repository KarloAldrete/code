import { useAuthenticatedClient } from "@features/auth/hooks/authClient";
import {
  type CanvasApiResolver,
  CanvasRenderer,
} from "@features/rendering-canvas/CanvasRenderer";
import { useCanvasChatStore } from "@features/rendering-canvas/canvasChatStore";
import { useExportCanvasPdf } from "@features/rendering-canvas/useExportCanvasPdf";
import { ChatCircle, DotsThree } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Button as QuillButton,
} from "@posthog/quill";
import { Button, Flex } from "@radix-ui/themes";
import type { PostHogAPIClient } from "@renderer/api/posthogClient";
import { useQuery } from "@tanstack/react-query";

interface RenderingCanvasProps {
  canvasId: string;
  className?: string;
  style?: React.CSSProperties;
  onApiCall?: CanvasApiResolver;
}

export function RenderingCanvas({
  canvasId,
  className,
  style,
  onApiCall,
}: RenderingCanvasProps) {
  const client = useAuthenticatedClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["rendering-canvas", canvasId],
    queryFn: () => client.getRenderingCanvas(canvasId),
  });
  const { exportPdf, isExporting } = useExportCanvasPdf();
  const chatOpen = useCanvasChatStore((s) => s.open);
  const toggleChat = useCanvasChatStore((s) => s.toggle);

  if (isLoading) {
    return (
      <div className={`p-3 text-(--gray-10) text-xs ${className ?? ""}`}>
        Loading canvas…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className={`p-3 text-(--red-11) text-xs ${className ?? ""}`}>
        Failed to load canvas:{" "}
        {error instanceof Error ? error.message : "unknown error"}
      </div>
    );
  }

  return (
    <Flex direction="column" className={className} style={style}>
      <Flex
        align="center"
        justify="between"
        className="shrink-0 border-(--gray-5) border-b px-3 py-2"
      >
        <span className="text-(--gray-12) text-sm">{data.name}</span>
        <Flex align="center" gap="1">
          <Button
            size="1"
            variant={chatOpen ? "solid" : "soft"}
            onClick={toggleChat}
            aria-label="Toggle chat panel"
            aria-pressed={chatOpen}
          >
            <ChatCircle weight="regular" />
            Chat
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <QuillButton
                  size="icon-sm"
                  aria-label="Canvas options"
                  className="rounded-xs"
                >
                  <DotsThree size={16} weight="bold" />
                </QuillButton>
              }
            />
            <DropdownMenuContent align="end" side="bottom" sideOffset={6}>
              <DropdownMenuItem
                onClick={() => exportPdf({ name: data.name })}
                disabled={isExporting}
              >
                {isExporting ? "Exporting…" : "Export PDF"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Flex>
      </Flex>
      <Flex direction="column" className="min-h-0 flex-1">
        <CanvasRenderer
          content={data.content}
          onApiCall={onApiCall ?? defaultResolver(client)}
        />
      </Flex>
    </Flex>
  );
}

function defaultResolver(client: PostHogAPIClient): CanvasApiResolver {
  return async (path, args) => {
    const segments = path.split(".");
    let target: unknown = client;
    for (const segment of segments) {
      if (target == null || typeof target !== "object") {
        throw new Error(`Path "${path}" is not callable on the client`);
      }
      target = (target as Record<string, unknown>)[segment];
    }
    if (typeof target !== "function") {
      throw new Error(`"${path}" is not a function on the client`);
    }
    return await (target as (...a: unknown[]) => unknown).apply(client, args);
  };
}
