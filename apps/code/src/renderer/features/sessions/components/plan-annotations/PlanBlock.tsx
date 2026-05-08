import { usePlanAnnotationDraftsStore } from "@features/sessions/stores/planAnnotationDraftsStore";
import { ArrowUp, ChatTeardropDots, Plus, Trash } from "@phosphor-icons/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@posthog/quill";
import { IconButton, Tooltip } from "@radix-ui/themes";
import { isSendMessageSubmitKey } from "@utils/sendMessageKey";
import type { Element } from "hast";
import {
  createElement,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";

interface PlanBlockBaseProps {
  taskId: string;
  toolCallId: string;
  node?: Element;
  children: ReactNode;
}

interface UsePlanBlockResult {
  startLine: number;
  endLine: number;
  draftCount: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  showButton: boolean;
}

function usePlanBlock(
  taskId: string,
  toolCallId: string,
  node: Element | undefined,
): UsePlanBlockResult {
  const [open, setOpen] = useState(false);
  const startLine = node?.position?.start?.line ?? 0;
  const endLine = node?.position?.end?.line ?? startLine;

  const draftCount = usePlanAnnotationDraftsStore(
    (s) =>
      (s.drafts[taskId] ?? []).filter(
        (d) => d.toolCallId === toolCallId && d.startLine === startLine,
      ).length,
  );

  return {
    startLine,
    endLine,
    draftCount,
    open,
    setOpen,
    showButton: startLine > 0,
  };
}

function GutterButton({
  hasDraft,
  draftCount,
  offset = 7,
  onClick,
}: {
  hasDraft: boolean;
  draftCount: number;
  offset?: number;
  onClick: () => void;
}) {
  return (
    <IconButton
      size="1"
      variant="ghost"
      color={hasDraft ? "blue" : "gray"}
      style={{ left: `-${offset * 4}px` }}
      className={`absolute top-1 transition-opacity ${
        hasDraft
          ? "text-(--accent-11) opacity-100"
          : "opacity-0 group-hover:opacity-100"
      }`}
      onClick={onClick}
      aria-label={hasDraft ? "Add another comment" : "Add comment"}
      title={
        hasDraft
          ? `${draftCount} comment${draftCount === 1 ? "" : "s"} on this block`
          : "Comment on this block"
      }
    >
      {hasDraft ? (
        <ChatTeardropDots size={14} weight="fill" />
      ) : (
        <Plus size={12} />
      )}
    </IconButton>
  );
}

const HAS_DRAFT_WRAPPER_CLASS =
  "border-(--accent-9) border-l-2 pl-3 -ml-3 bg-(--accent-2) rounded-r-sm";

const HAS_DRAFT_LI_CLASS =
  "bg-(--accent-2) rounded-r-(--radius-2) px-2 marker:text-(--accent-9) shadow-[-2px_0_0_var(--accent-9)]";

function CommentInput({
  taskId,
  toolCallId,
  startLine,
  endLine,
  onDismiss,
}: {
  taskId: string;
  toolCallId: string;
  startLine: number;
  endLine: number;
  onDismiss: () => void;
}) {
  const addDraft = usePlanAnnotationDraftsStore((s) => s.addDraft);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const setTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
    if (el) requestAnimationFrame(() => el.focus());
  }, []);

  const handleSubmit = useCallback(() => {
    const text = textareaRef.current?.value?.trim();
    if (!text) return;
    addDraft(taskId, { toolCallId, startLine, endLine, text });
    onDismiss();
  }, [addDraft, taskId, toolCallId, startLine, endLine, onDismiss]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isSendMessageSubmitKey(e)) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    },
    [handleSubmit, onDismiss],
  );

  return (
    <div className="not-prose mt-2 rounded-md border border-(--gray-6) bg-(--gray-2)">
      <div className="px-3 py-1.5 font-sans">
        <InputGroup>
          <InputGroupTextarea
            ref={setTextareaRef}
            placeholder="Leave a comment on this part of the plan..."
            onKeyDown={handleKeyDown}
            onChange={(e) => setIsEmpty(!e.currentTarget.value.trim())}
            className="min-h-[48px] resize-none text-[13px]"
          />
          <InputGroupAddon align="block-end">
            <Tooltip content="Discard">
              <InputGroupButton
                size="icon-sm"
                variant="default"
                onClick={onDismiss}
                aria-label="Discard"
              >
                <Trash size={14} />
              </InputGroupButton>
            </Tooltip>
            <div className="ml-auto flex items-center gap-3">
              <Tooltip content={isEmpty ? "Enter a comment" : "Add to review"}>
                <InputGroupButton
                  size="icon-sm"
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={isEmpty}
                  aria-label="Submit"
                >
                  <ArrowUp size={14} weight="bold" />
                </InputGroupButton>
              </Tooltip>
            </div>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  );
}

export type WrappableTag =
  | "p"
  | "blockquote"
  | "pre"
  | "table"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6";

interface PlanWrappableBlockProps extends PlanBlockBaseProps {
  tag: WrappableTag;
  className?: string;
}

export function PlanWrappableBlock({
  tag,
  taskId,
  toolCallId,
  node,
  children,
  className,
}: PlanWrappableBlockProps) {
  const { startLine, endLine, draftCount, open, setOpen, showButton } =
    usePlanBlock(taskId, toolCallId, node);

  return (
    <div
      className={`group relative ${draftCount > 0 ? HAS_DRAFT_WRAPPER_CLASS : ""}`}
    >
      {showButton && (
        <GutterButton
          hasDraft={draftCount > 0}
          draftCount={draftCount}
          onClick={() => setOpen(true)}
        />
      )}
      {createElement(tag, { className }, children)}
      {open && (
        <CommentInput
          taskId={taskId}
          toolCallId={toolCallId}
          startLine={startLine}
          endLine={endLine}
          onDismiss={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export function PlanListItemBlock({
  taskId,
  toolCallId,
  node,
  children,
  className,
}: PlanBlockBaseProps & { className?: string }) {
  const { startLine, endLine, draftCount, open, setOpen, showButton } =
    usePlanBlock(taskId, toolCallId, node);

  return (
    <li
      className={`group relative ${className ?? ""} ${
        draftCount > 0 ? HAS_DRAFT_LI_CLASS : ""
      }`}
    >
      {showButton && (
        <GutterButton
          hasDraft={draftCount > 0}
          draftCount={draftCount}
          offset={9}
          onClick={() => setOpen(true)}
        />
      )}
      {children}
      {open && (
        <CommentInput
          taskId={taskId}
          toolCallId={toolCallId}
          startLine={startLine}
          endLine={endLine}
          onDismiss={() => setOpen(false)}
        />
      )}
    </li>
  );
}
