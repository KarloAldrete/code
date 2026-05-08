import { PlanContent } from "@components/permissions/PlanContent";
import { MarkdownRenderer } from "@features/editor/components/MarkdownRenderer";
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { useMemo, useState } from "react";
import {
  stripCodeFences,
  type ToolViewProps,
  useToolCallStatus,
} from "./toolCallUtils";

const REJECTION_FEEDBACK_PREFIX = "User rejected the plan with feedback: ";

function collectTextContent(
  content: ToolViewProps["toolCall"]["content"],
): string[] {
  if (!content || content.length === 0) return [];
  const out: string[] = [];
  for (const item of content) {
    if (item.type !== "content") continue;
    const inner = (item as { content?: { type?: string; text?: string } })
      .content;
    const raw = inner?.type === "text" ? inner.text?.trim() : undefined;
    if (!raw) continue;
    const stripped = stripCodeFences(raw).trim();
    if (stripped) out.push(stripped);
  }
  return out;
}

function extractRejectionFeedback(
  content: ToolViewProps["toolCall"]["content"],
): string | null {
  for (const text of collectTextContent(content)) {
    if (text.startsWith(REJECTION_FEEDBACK_PREFIX)) {
      const feedback = text.slice(REJECTION_FEEDBACK_PREFIX.length).trim();
      return feedback || null;
    }
  }
  return null;
}

export function PlanApprovalView({
  toolCall,
  turnCancelled,
  turnComplete,
}: ToolViewProps) {
  const { content } = toolCall;
  const { isComplete, isFailed, wasCancelled } = useToolCallStatus(
    toolCall.status,
    turnCancelled,
    turnComplete,
  );
  const [isPlanExpanded, setIsPlanExpanded] = useState(false);

  const planText = useMemo(() => {
    const rawPlan = (toolCall.rawInput as { plan?: string } | undefined)?.plan;
    if (rawPlan) return rawPlan;

    if (!content || content.length === 0) return null;
    const textContent = content.find((c) => c.type === "content");
    if (textContent && "content" in textContent) {
      const inner = textContent.content as
        | { type?: string; text?: string }
        | undefined;
      if (inner?.type === "text" && inner.text) {
        return inner.text;
      }
    }
    return null;
  }, [content, toolCall.rawInput]);

  const rejectionFeedback = useMemo(
    () => extractRejectionFeedback(content),
    [content],
  );

  const isRejected = isFailed || !!rejectionFeedback;

  const [feedbackExpanded, setFeedbackExpanded] = useState(false);

  const showResult = isComplete || wasCancelled || isRejected;
  const canTogglePlan = showResult && !!planText;
  const planContentId = `plan-content-${toolCall.toolCallId}`;

  if (!planText && !showResult) return null;

  const statusContent = isComplete ? (
    <>
      <CheckCircle size={14} weight="fill" className="text-green-9" />
      <Text className="text-[13px] text-green-11">
        Plan approved — proceeding with implementation
      </Text>
    </>
  ) : wasCancelled ? (
    <Text className="text-[13px] text-gray-10">(Plan rejected)</Text>
  ) : null;

  return (
    <Box className="my-3">
      {!showResult && planText && (
        <PlanContent id={toolCall.toolCallId} plan={planText} />
      )}

      {showResult && (
        <Box>
          {isRejected ? (
            <Box className="px-1">
              <button
                type="button"
                onClick={() =>
                  rejectionFeedback && setFeedbackExpanded((v) => !v)
                }
                disabled={!rejectionFeedback}
                aria-expanded={feedbackExpanded}
                className={`flex items-center gap-2 border-none bg-transparent p-0 py-0.5 ${
                  rejectionFeedback ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <XCircle size={14} weight="fill" className="text-(--gray-9)" />
                <Text className="text-(--gray-11) text-[13px]">
                  {rejectionFeedback
                    ? "Plan rejected — feedback sent to agent"
                    : "Plan rejected"}
                </Text>
                {rejectionFeedback &&
                  (feedbackExpanded ? (
                    <CaretDown size={12} className="text-(--gray-10)" />
                  ) : (
                    <CaretRight size={12} className="text-(--gray-10)" />
                  ))}
              </button>
              {rejectionFeedback && feedbackExpanded && (
                <Box className="mt-1 ml-5 max-w-4xl overflow-hidden rounded-lg border border-gray-6">
                  <Box className="max-h-96 overflow-auto px-3 py-2 text-[13px] [&>*:last-child]:mb-0">
                    <MarkdownRenderer content={rejectionFeedback} />
                  </Box>
                </Box>
              )}
            </Box>
          ) : canTogglePlan ? (
            <>
              <button
                type="button"
                onClick={() => setIsPlanExpanded((v) => !v)}
                aria-expanded={isPlanExpanded}
                aria-controls={planContentId}
                className="flex items-center gap-2 rounded-sm px-1 text-left hover:bg-gray-3"
              >
                {isPlanExpanded ? (
                  <CaretDown size={12} className="text-gray-10" />
                ) : (
                  <CaretRight size={12} className="text-gray-10" />
                )}
                {statusContent}
                <Text className="text-[13px] text-gray-10">
                  · {isPlanExpanded ? "hide plan" : "show plan"}
                </Text>
              </button>
              {isPlanExpanded && (
                <Box id={planContentId} className="mt-2">
                  <PlanContent id={toolCall.toolCallId} plan={planText} />
                </Box>
              )}
            </>
          ) : (
            <Flex align="center" gap="2" className="px-1">
              {statusContent}
            </Flex>
          )}
        </Box>
      )}
    </Box>
  );
}
