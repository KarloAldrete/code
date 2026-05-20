import { ArrowsOut, ListChecks, X } from "@phosphor-icons/react";
import { Box, Button, Flex, IconButton, Text } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const planScrollPosition = new Map<string, number>();

interface PlanContentProps {
  id: string;
  plan: string;
}

export function PlanContent({ id, plan }: PlanContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const position = planScrollPosition.get(id);
    if (position !== undefined) {
      el.scrollTop = position;
    }

    const handleScroll = () => {
      planScrollPosition.set(id, el.scrollTop);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [id]);

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

  const markdown = (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan}</ReactMarkdown>
  );

  if (isFullscreen) {
    const portalTarget = document.getElementById("fullscreen-portal");
    if (portalTarget) {
      return (
        <>
          <Flex
            align="center"
            justify="between"
            className="max-w-[750px] rounded-lg border-2 border-blue-6 bg-blue-2 px-3 py-2"
          >
            <Flex align="center" gap="2">
              <ListChecks size={14} className="text-blue-11" />
              <Text className="text-blue-11 text-sm">
                Plan opened in fullscreen
              </Text>
            </Flex>
            <Button
              size="1"
              variant="ghost"
              color="gray"
              onClick={() => setIsFullscreen(false)}
            >
              Exit fullscreen
            </Button>
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

              <Box
                ref={scrollRef}
                className="plan-markdown flex-1 overflow-y-auto p-6 text-blue-12"
              >
                {markdown}
              </Box>
            </Box>,
            portalTarget,
          )}
        </>
      );
    }
  }

  return (
    <Box className="max-w-[750px] overflow-hidden rounded-lg border-2 border-blue-6 bg-blue-2">
      <Flex
        align="center"
        justify="between"
        className="border-blue-6 border-b px-3 py-2"
      >
        <Flex align="center" gap="2">
          <ListChecks size={14} className="text-blue-11" />
          <Text className="text-blue-11 text-sm">Plan</Text>
        </Flex>
        <Button
          size="1"
          variant="ghost"
          color="gray"
          onClick={() => setIsFullscreen(true)}
          title="Expand to fullscreen"
        >
          <ArrowsOut size={12} />
          Expand
        </Button>
      </Flex>

      <Box
        ref={scrollRef}
        className="plan-markdown max-h-[75vh] overflow-y-auto p-4 text-blue-12"
      >
        {markdown}
      </Box>
    </Box>
  );
}
