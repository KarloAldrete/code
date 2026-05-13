import type { Nest } from "@main/services/hedgemony/schemas";
import { Archive, FloppyDisk, X } from "@phosphor-icons/react";
import {
  Button,
  Flex,
  ScrollArea,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import { trpcClient } from "@renderer/trpc/client";
import { logger } from "@utils/logger";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { selectNestMessages, useNestChatStore } from "../stores/nestChatStore";
import { useNestStore } from "../stores/nestStore";

const log = logger.scope("nest-detail-panel");

interface NestDetailPanelProps {
  nest: Nest;
  onClose: () => void;
}

export function NestDetailPanel({ nest, onClose }: NestDetailPanelProps) {
  const [name, setName] = useState(nest.name);
  const [goalPrompt, setGoalPrompt] = useState(nest.goalPrompt);
  const [definitionOfDone, setDefinitionOfDone] = useState(
    nest.definitionOfDone ?? "",
  );
  const [mapX, setMapX] = useState(String(nest.mapX));
  const [mapY, setMapY] = useState(String(nest.mapY));
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messages = useNestChatStore(selectNestMessages(nest.id));
  const loadingMessages = useNestChatStore(
    (s) => s.loadingByNestId[nest.id] ?? false,
  );
  const loadMessages = useNestChatStore((s) => s.load);

  useEffect(() => {
    setName(nest.name);
    setGoalPrompt(nest.goalPrompt);
    setDefinitionOfDone(nest.definitionOfDone ?? "");
    setMapX(String(nest.mapX));
    setMapY(String(nest.mapY));
    setError(null);
    void loadMessages(nest.id);
  }, [nest, loadMessages]);

  const parsedCoords = useMemo(() => {
    const nextMapX = Number.parseInt(mapX, 10);
    const nextMapY = Number.parseInt(mapY, 10);
    return {
      mapX: Number.isFinite(nextMapX) ? nextMapX : null,
      mapY: Number.isFinite(nextMapY) ? nextMapY : null,
    };
  }, [mapX, mapY]);

  const canSave =
    name.trim().length > 0 &&
    goalPrompt.trim().length > 0 &&
    parsedCoords.mapX !== null &&
    parsedCoords.mapY !== null;

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
        mapX: parsedCoords.mapX ?? nest.mapX,
        mapY: parsedCoords.mapY ?? nest.mapY,
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
    <aside className="absolute top-3 right-3 bottom-3 z-10 flex w-[360px] min-w-0 flex-col rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1) shadow-xl">
      <div className="flex items-start justify-between gap-3 border-(--gray-5) border-b px-4 py-3">
        <div className="min-w-0">
          <Text size="1" color="gray" className="block">
            Nest
          </Text>
          <Text size="3" weight="bold" className="block truncate">
            {nest.name}
          </Text>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-(--radius-2) text-(--gray-10) hover:bg-(--gray-3) hover:text-(--gray-12)"
          title="Close"
        >
          <X size={15} />
        </button>
      </div>

      <ScrollArea type="auto" scrollbars="vertical" className="min-h-0 flex-1">
        <Flex direction="column" gap="4" p="4">
          <Flex direction="column" gap="3">
            <LabeledField label="Name" htmlFor="nest-detail-name">
              <TextField.Root
                id="nest-detail-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving || archiving}
              />
            </LabeledField>

            <LabeledField label="Goal" htmlFor="nest-detail-goal">
              <TextArea
                id="nest-detail-goal"
                value={goalPrompt}
                onChange={(e) => setGoalPrompt(e.target.value)}
                rows={5}
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
                rows={4}
                disabled={saving || archiving}
              />
            </LabeledField>

            <div className="grid grid-cols-2 gap-2">
              <LabeledField label="Map X" htmlFor="nest-detail-map-x">
                <TextField.Root
                  id="nest-detail-map-x"
                  value={mapX}
                  onChange={(e) => setMapX(e.target.value)}
                  disabled={saving || archiving}
                />
              </LabeledField>
              <LabeledField label="Map Y" htmlFor="nest-detail-map-y">
                <TextField.Root
                  id="nest-detail-map-y"
                  value={mapY}
                  onChange={(e) => setMapY(e.target.value)}
                  disabled={saving || archiving}
                />
              </LabeledField>
            </div>
          </Flex>

          {error && (
            <Text size="2" color="red">
              {error}
            </Text>
          )}

          <Flex gap="2">
            <Button
              onClick={handleSave}
              disabled={!canSave || saving || archiving}
              loading={saving}
            >
              <FloppyDisk size={14} />
              Save
            </Button>
            <Button
              variant="soft"
              color="red"
              onClick={handleArchive}
              disabled={saving || archiving}
              loading={archiving}
            >
              <Archive size={14} />
              Archive
            </Button>
          </Flex>

          <div className="border-(--gray-5) border-t pt-4">
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Creation context
              </Text>
              {loadingMessages && messages.length === 0 ? (
                <Text size="2" color="gray">
                  Loading context...
                </Text>
              ) : messages.length === 0 ? (
                <Text size="2" color="gray">
                  No creation context recorded.
                </Text>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-(--radius-2) border border-(--gray-4) bg-(--gray-2) p-2"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Text size="1" color="gray" weight="medium">
                        {message.kind === "audit" ? "Audit" : "Prompt"}
                      </Text>
                      <Text size="1" color="gray">
                        {new Date(message.createdAt).toLocaleString()}
                      </Text>
                    </div>
                    <Text
                      as="p"
                      size="2"
                      className="whitespace-pre-wrap text-(--gray-12)"
                    >
                      {message.body}
                    </Text>
                  </div>
                ))
              )}
            </Flex>
          </div>
        </Flex>
      </ScrollArea>
    </aside>
  );
}

function LabeledField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
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
