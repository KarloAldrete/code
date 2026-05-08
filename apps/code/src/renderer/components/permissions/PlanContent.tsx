import {
  PlanListItemBlock,
  PlanWrappableBlock,
  type WrappableTag,
} from "@features/sessions/components/plan-annotations/PlanBlock";
import { PlanReviewSidebar } from "@features/sessions/components/plan-annotations/PlanReviewSidebar";
import { useAppView } from "@hooks/useAppView";
import { ArrowsIn, ArrowsOut, ListChecks, X } from "@phosphor-icons/react";
import { Box, Flex, IconButton, Text } from "@radix-ui/themes";
import { usePlanFullscreenStore } from "@stores/planFullscreenStore";
import type { Element } from "hast";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const planScrollPosition = new Map<string, number>();

interface PlanContentProps {
  id: string;
  plan: string;
}

export function PlanContent({ id, plan }: PlanContentProps) {
  const toolCallId = id;
  const view = useAppView();
  const taskId = view.type === "task-detail" ? (view.taskId ?? null) : null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const setActiveFullscreen = usePlanFullscreenStore((s) => s.setActive);
  const clearActiveFullscreen = usePlanFullscreenStore((s) => s.clear);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const position = planScrollPosition.get(toolCallId);
    if (position !== undefined) {
      el.scrollTop = position;
    }

    const handleScroll = () => {
      planScrollPosition.set(toolCallId, el.scrollTop);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [toolCallId]);

  useEffect(() => {
    if (!isFullscreen) return;
    setActiveFullscreen(toolCallId);
    return () => {
      clearActiveFullscreen(toolCallId);
    };
  }, [isFullscreen, toolCallId, setActiveFullscreen, clearActiveFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  const annotationsEnabled = isFullscreen && !!taskId;

  const components = useMemo<Components | undefined>(() => {
    if (!annotationsEnabled || !taskId) return undefined;

    const wrappable = (tag: WrappableTag) =>
      function WrappableRenderer(props: {
        node?: Element;
        children?: ReactNode;
        className?: string;
      }) {
        return (
          <PlanWrappableBlock
            tag={tag}
            taskId={taskId}
            toolCallId={toolCallId}
            node={props.node}
            className={props.className}
          >
            {props.children}
          </PlanWrappableBlock>
        );
      };

    return {
      p: wrappable("p"),
      blockquote: wrappable("blockquote"),
      pre: wrappable("pre"),
      h1: wrappable("h1"),
      h2: wrappable("h2"),
      h3: wrappable("h3"),
      h4: wrappable("h4"),
      h5: wrappable("h5"),
      h6: wrappable("h6"),
      li: function LiRenderer(props: {
        node?: Element;
        children?: ReactNode;
        className?: string;
      }) {
        return (
          <PlanListItemBlock
            taskId={taskId}
            toolCallId={toolCallId}
            node={props.node}
            className={props.className}
          >
            {props.children}
          </PlanListItemBlock>
        );
      },
    } as Components;
  }, [annotationsEnabled, taskId, toolCallId]);

  const markdown = (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {plan}
    </ReactMarkdown>
  );

  if (isFullscreen) {
    const portalTarget = document.getElementById("fullscreen-portal");
    if (portalTarget) {
      return (
        <>
          <Flex justify="end" className="py-0.5">
            <IconButton
              size="1"
              variant="ghost"
              color="gray"
              onClick={() => setIsFullscreen(false)}
              title="Exit fullscreen"
            >
              <ArrowsIn size={12} />
            </IconButton>
          </Flex>

          {createPortal(
            <Box className="pointer-events-auto absolute inset-0 flex flex-col bg-blue-2">
              <Flex
                align="center"
                justify="between"
                className="border-blue-6 border-b px-4 py-2"
              >
                <Flex align="center" gap="2">
                  <ListChecks size={14} className="text-blue-11" />
                  <Text className="text-blue-11 text-sm">Plan</Text>
                </Flex>
                <IconButton
                  size="1"
                  variant="ghost"
                  color="gray"
                  onClick={() => setIsFullscreen(false)}
                  title="Exit fullscreen (Escape)"
                >
                  <X size={14} />
                </IconButton>
              </Flex>

              <Flex className="min-h-0 flex-1">
                <Box
                  ref={scrollRef}
                  className="plan-markdown min-w-0 flex-1 overflow-y-auto px-12 py-6"
                >
                  {markdown}
                </Box>
                {taskId && (
                  <PlanReviewSidebar
                    taskId={taskId}
                    toolCallId={toolCallId}
                    onSubmitted={() => setIsFullscreen(false)}
                  />
                )}
              </Flex>
            </Box>,
            portalTarget,
          )}
        </>
      );
    }
  }

  return (
    <Box
      ref={scrollRef}
      className="relative max-h-[50vh] max-w-[750px] overflow-y-auto rounded-lg border-2 border-blue-6 bg-blue-2 p-4"
    >
      <IconButton
        size="1"
        variant="ghost"
        color="gray"
        className="sticky top-0 z-10 float-right"
        onClick={() => setIsFullscreen(true)}
        title="Expand to fullscreen"
      >
        <ArrowsOut size={12} />
      </IconButton>

      <Box className="plan-markdown text-blue-12">{markdown}</Box>
    </Box>
  );
}
