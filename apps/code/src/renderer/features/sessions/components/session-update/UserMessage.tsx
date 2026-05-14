import { Tooltip } from "@components/ui/Tooltip";
import { MarkdownRenderer } from "@features/editor/components/MarkdownRenderer";
import {
  CaretDown,
  CaretUp,
  Check,
  CircleNotch,
  Copy,
  File,
  SlackLogo,
  UserPlus,
} from "@phosphor-icons/react";
import { Box, Flex, IconButton, Text } from "@radix-ui/themes";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  extractTeamMembers,
  hasFileMentions,
  MentionChip,
  parseFileMentions,
} from "./parseFileMentions";

const COLLAPSED_MAX_HEIGHT = 160;

export interface UserMessageAttachment {
  id: string;
  label: string;
}

interface UserMessageProps {
  content: string;
  timestamp?: number;
  sourceUrl?: string;
  attachments?: UserMessageAttachment[];
  animate?: boolean;
  /** When true, the message is queued waiting for the agent to connect. */
  pending?: boolean;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatNameList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function UserMessage({
  content,
  timestamp,
  sourceUrl,
  attachments = [],
  animate = true,
  pending = false,
}: UserMessageProps) {
  const containsFileMentions = hasFileMentions(content);
  const showAttachmentChips = attachments.length > 0 && !containsFileMentions;
  const addedTeamMembers = extractTeamMembers(content);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (el) {
      setIsOverflowing(el.scrollHeight > COLLAPSED_MAX_HEIGHT);
    }
  }, []);

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => clearTimeout(copiedTimerRef.current);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={animate ? { duration: 0.25, ease: "easeOut" } : undefined}
    >
      <Box
        className={`group/msg relative border-l-2 bg-gray-2 py-2 pl-3 transition-opacity duration-300 ${pending ? "opacity-60" : "opacity-100"}`}
        style={{ borderColor: "var(--accent-9)" }}
      >
        <Box
          ref={contentRef}
          className="relative overflow-hidden font-medium text-[13px] [&>*:last-child]:mb-0"
          style={
            !isExpanded && isOverflowing
              ? { maxHeight: COLLAPSED_MAX_HEIGHT }
              : undefined
          }
        >
          {containsFileMentions ? (
            parseFileMentions(content)
          ) : (
            <MarkdownRenderer content={content} />
          )}
          {showAttachmentChips && (
            <Flex
              wrap="wrap"
              gap="1"
              className={content.trim() ? "mt-1.5" : ""}
            >
              {attachments.map((attachment) => (
                <MentionChip
                  key={attachment.id}
                  icon={<File size={12} />}
                  label={attachment.label}
                />
              ))}
            </Flex>
          )}
          {!isExpanded && isOverflowing && (
            <Box
              className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
              style={{
                background: "linear-gradient(transparent, var(--gray-2))",
              }}
            />
          )}
        </Box>
        {isOverflowing && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="mt-1 inline-flex items-center gap-1 text-[12px] text-accent-11 hover:text-accent-12"
          >
            {isExpanded ? (
              <>
                <CaretUp size={12} />
                Show less
              </>
            ) : (
              <>
                <CaretDown size={12} />
                Show more
              </>
            )}
          </button>
        )}
        {addedTeamMembers.length > 0 && (
          <Flex
            align="center"
            gap="1.5"
            className="mt-1.5 text-(--gray-10) text-[12px]"
          >
            <Flex align="center" className="-space-x-1">
              {addedTeamMembers.map((m) =>
                m.avatar ? (
                  <img
                    key={m.uuid}
                    src={m.avatar}
                    alt=""
                    className="size-4 rounded-full border border-(--gray-2) object-cover"
                  />
                ) : (
                  <span
                    key={m.uuid}
                    className="flex size-4 items-center justify-center rounded-full border border-(--gray-2) bg-(--gray-5)"
                  >
                    <UserPlus size={10} />
                  </span>
                ),
              )}
            </Flex>
            <span>
              Added{" "}
              <span className="text-(--gray-12)">
                {formatNameList(addedTeamMembers.map((m) => m.name))}
              </span>{" "}
              to the thread
            </span>
          </Flex>
        )}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-gray-10 transition-colors hover:text-gray-12"
          >
            <SlackLogo size={12} />
            <span>View Slack thread</span>
          </a>
        )}
        {pending && (
          <Flex
            align="center"
            gap="1.5"
            className="mt-1.5 text-(--gray-10) text-[11px]"
          >
            <CircleNotch size={11} weight="bold" className="animate-spin" />
            <Text as="span">Sending when ready…</Text>
          </Flex>
        )}
        <Box className="absolute top-1 right-1 flex select-none items-center gap-1.5 rounded-md bg-gray-2 py-0.5 pr-1 pl-2 opacity-0 shadow-sm transition-opacity group-hover/msg:opacity-100">
          {timestamp != null && (
            <span aria-hidden className="text-[11px] text-gray-10">
              {formatTimestamp(timestamp)}
            </span>
          )}
          <Tooltip content={copied ? "Copied!" : "Copy message"}>
            <IconButton
              size="1"
              variant="ghost"
              color={copied ? "green" : "gray"}
              onClick={handleCopy}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </motion.div>
  );
}
