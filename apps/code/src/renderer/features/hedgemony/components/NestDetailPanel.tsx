import { useFunSpeak } from "@features/fun-mode/hooks/useFunSpeak";
import type {
  Nest,
  NestMessage,
  NestMessageKind,
} from "@main/services/hedgemony/schemas";
import {
  Archive,
  ArrowsOutCardinal,
  ChatCircle,
  FloppyDisk,
  Warning,
} from "@phosphor-icons/react";
import {
  Button,
  Flex,
  IconButton,
  ScrollArea,
  Text,
  TextArea,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import { trpcClient } from "@renderer/trpc/client";
import { logger } from "@utils/logger";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { selectNestMessages, useNestChatStore } from "../stores/nestChatStore";
import { selectHedgehogState, useNestStore } from "../stores/nestStore";
import { CommandConsole } from "./CommandConsole";

const log = logger.scope("nest-detail-panel");

interface NestDetailPanelProps {
  nest: Nest;
  onClose: () => void;
  onRelocate?: () => void;
}

export function NestDetailPanel({
  nest,
  onClose,
  onRelocate,
}: NestDetailPanelProps) {
  const t = useFunSpeak();
  const [name, setName] = useState(nest.name);
  const [goalPrompt, setGoalPrompt] = useState(nest.goalPrompt);
  const [definitionOfDone, setDefinitionOfDone] = useState(
    nest.definitionOfDone ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messages = useNestChatStore(selectNestMessages(nest.id));
  const loadingMessages = useNestChatStore(
    (s) => s.loadingByNestId[nest.id] ?? false,
  );
  const loadMessages = useNestChatStore((s) => s.load);
  const hedgehogState = useNestStore(selectHedgehogState(nest.id));

  const [chatDraft, setChatDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    setName(nest.name);
    setGoalPrompt(nest.goalPrompt);
    setDefinitionOfDone(nest.definitionOfDone ?? "");
    setError(null);
    setChatDraft("");
    setChatError(null);
    void loadMessages(nest.id);
  }, [nest, loadMessages]);

  const handleSendChat = async () => {
    const body = chatDraft.trim();
    if (!body || sending) return;
    setSending(true);
    setChatError(null);
    try {
      await trpcClient.hedgemony.nestChat.send.mutate({
        nestId: nest.id,
        body,
      });
      setChatDraft("");
    } catch (e) {
      log.error("Failed to send nest chat", { nestId: nest.id, error: e });
      setChatError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleChatKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendChat();
    }
  };

  const canSave = name.trim().length > 0 && goalPrompt.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await trpcClient.hedgemony.nests.update.mutate({
        id: nest.id,
        name: name.trim(),
        goalPrompt: goalPrompt.trim(),
        definitionOfDone: definitionOfDone.trim() || null,
      });
      useNestStore.getState().upsert(updated);
    } catch (e) {
      log.error("Failed to update nest", { id: nest.id, error: e });
      setError(e instanceof Error ? e.message : "Failed to update nest");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (archiving) return;
    setArchiving(true);
    setError(null);
    try {
      const archived = await trpcClient.hedgemony.nests.archive.mutate({
        id: nest.id,
      });
      useNestStore.getState().remove(archived.id);
      onClose();
    } catch (e) {
      log.error("Failed to archive nest", { id: nest.id, error: e });
      setError(e instanceof Error ? e.message : "Failed to archive nest");
      setArchiving(false);
    }
  };

  return (
    <CommandConsole
      consoleKey={nest.id}
      size="wide"
      style={{ height: "min(64vh, 600px)" }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenuCapture={(e) => e.stopPropagation()}
    >
      <CommandConsole.Header
        eyebrow={
          <span className="flex items-center gap-2">
            {t("Nest")}
            {hedgehogState?.state === "ticking" && (
              <span className="flex items-center gap-1 rounded-full bg-(--amber-a3) px-2 py-0.5 text-(--amber-11) text-[10px] normal-case tracking-normal">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-(--amber-9)" />
                {t("Hedgehog ticking…")}
              </span>
            )}
          </span>
        }
        title={nest.name}
        onClose={onClose}
        trailing={
          onRelocate && (
            <Tooltip content={t("Relocate nest")} side="top">
              <IconButton
                size="1"
                variant="soft"
                color="gray"
                onClick={onRelocate}
                disabled={saving || archiving}
                aria-label="Relocate nest"
              >
                <ArrowsOutCardinal size={14} />
              </IconButton>
            </Tooltip>
          )
        }
      />

      <ScrollArea type="auto" scrollbars="vertical" className="min-h-0 flex-1">
        <Flex direction="column" gap="4" px="4" py="3">
          <Flex direction="row" gap="3" wrap="wrap">
            <LabeledField
              label="Name"
              htmlFor="nest-detail-name"
              minWidth={220}
            >
              <TextField.Root
                id="nest-detail-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving || archiving}
              />
            </LabeledField>
          </Flex>

          <LabeledField label="Goal" htmlFor="nest-detail-goal">
            <TextArea
              id="nest-detail-goal"
              value={goalPrompt}
              onChange={(e) => setGoalPrompt(e.target.value)}
              rows={4}
              disabled={saving || archiving}
            />
          </LabeledField>

          <LabeledField
            label="Definition of done"
            htmlFor="nest-detail-definition"
          >
            <TextArea
              id="nest-detail-definition"
              value={definitionOfDone}
              onChange={(e) => setDefinitionOfDone(e.target.value)}
              rows={3}
              disabled={saving || archiving}
            />
          </LabeledField>

          {error && (
            <Text size="2" color="red">
              {error}
            </Text>
          )}

          <div className="border-(--accent-a5) border-t pt-3">
            <Flex direction="column" gap="2">
              <Text
                size="1"
                weight="medium"
                className="font-mono text-(--accent-11) uppercase tracking-[0.18em]"
              >
                {t("Nest chat")}
              </Text>
              {loadingMessages && messages.length === 0 ? (
                <Text size="2" color="gray">
                  Loading context...
                </Text>
              ) : messages.length === 0 ? (
                <Text size="2" color="gray">
                  {t("No messages yet — talk to the hedgehog below.")}
                </Text>
              ) : (
                messages.map((message) => (
                  <NestChatMessage key={message.id} message={message} />
                ))
              )}
            </Flex>
          </div>
        </Flex>
      </ScrollArea>

      <CommandConsole.Footer align="between">
        <Flex gap="2" align="center" flexGrow="1">
          <TextField.Root
            placeholder={t("Message the hedgehog…")}
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            onKeyDown={handleChatKeyDown}
            disabled={sending}
            className="flex-1"
            style={{ minWidth: 200 }}
          />
          {chatError && (
            <Text size="1" color="red">
              {chatError}
            </Text>
          )}
          <Button
            onClick={handleSendChat}
            disabled={!chatDraft.trim() || sending}
            loading={sending}
            size="2"
            variant="soft"
          >
            <PaperPlaneRight size={14} />
            {t("Send")}
          </Button>
        </Flex>
        <div className="border-(--accent-a6) border-l pl-2">
          <Flex gap="2">
            <Button
              onClick={handleSave}
              disabled={!canSave || saving || archiving}
              loading={saving}
              size="2"
            >
              <FloppyDisk size={14} />
              {t("Save")}
            </Button>
            <Button
              variant="soft"
              color="red"
              onClick={handleArchive}
              disabled={saving || archiving}
              loading={archiving}
              size="2"
            >
              <Archive size={14} />
              {t("Archive")}
            </Button>
          </Flex>
        </div>
      </CommandConsole.Footer>
    </CommandConsole>
  );
}

const KIND_LABEL: Record<NestMessageKind, string> = {
  user_message: "You",
  hedgehog_message: "Hedgehog",
  audit: "Audit",
  tool_result: "Tool result",
  hoglet_summary: "Hoglet",
};

const KIND_ACCENT: Record<NestMessageKind, string> = {
  user_message: "text-(--gray-12)",
  hedgehog_message: "text-(--amber-11)",
  audit: "text-(--gray-10)",
  tool_result: "text-(--blue-11)",
  hoglet_summary: "text-(--gray-11)",
};

interface FeedbackRoutedPayload {
  type: "feedback_routed";
  source: "pr_review" | "ci" | "issue";
  outcome: "injected" | "follow_up_spawned" | "failed";
  payloadRef: string;
  hogletTaskId: string;
}

function parseFeedbackRoutedPayload(
  payloadJson: string | null,
): FeedbackRoutedPayload | null {
  if (!payloadJson) return null;
  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    if (parsed.type !== "feedback_routed") return null;
    return parsed as unknown as FeedbackRoutedPayload;
  } catch {
    return null;
  }
}

function NestChatMessage({ message }: { message: NestMessage }) {
  const routed = parseFeedbackRoutedPayload(message.payloadJson);
  if (routed) {
    return <FeedbackRoutedMessage message={message} payload={routed} />;
  }
  const label = KIND_LABEL[message.kind] ?? message.kind;
  const accent = KIND_ACCENT[message.kind] ?? "text-(--gray-11)";
  return (
    <div className="rounded-(--radius-2) border border-(--gray-4) bg-(--gray-a2) p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Text size="1" weight="medium" className={accent}>
          {label}
        </Text>
        <Text size="1" color="gray">
          {new Date(message.createdAt).toLocaleString()}
        </Text>
      </div>
      <Text as="p" size="2" className="whitespace-pre-wrap text-(--gray-12)">
        {message.body}
      </Text>
    </div>
  );
}

function FeedbackRoutedMessage({
  message,
  payload,
}: {
  message: NestMessage;
  payload: FeedbackRoutedPayload;
}) {
  const Icon = payload.source === "ci" ? Warning : ChatCircle;
  const tone =
    payload.outcome === "failed"
      ? "border-(--orange-6) bg-(--orange-2) text-(--orange-11)"
      : "border-(--cyan-6) bg-(--cyan-2) text-(--cyan-11)";
  const label =
    payload.source === "pr_review" ? "Feedback routed" : "CI failure routed";
  return (
    <div className={`rounded-(--radius-2) border ${tone} p-2`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <Flex align="center" gap="1">
          <Icon size={12} weight="bold" />
          <Text size="1" weight="medium">
            {label}
          </Text>
        </Flex>
        <Text size="1" color="gray">
          {new Date(message.createdAt).toLocaleString()}
        </Text>
      </div>
      <Text as="p" size="2" className="whitespace-pre-wrap text-(--gray-12)">
        {message.body}
      </Text>
    </div>
  );
}

function LabeledField({
  label,
  htmlFor,
  children,
  minWidth,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="flex flex-1 flex-col" style={{ minWidth }}>
      <Text
        as="label"
        htmlFor={htmlFor}
        size="2"
        mb="1"
        weight="medium"
        className="block"
      >
        {label}
      </Text>
      {children}
    </div>
  );
}
