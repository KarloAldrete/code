import { Plus } from "@phosphor-icons/react";
import { Flex, IconButton, Text, TextField } from "@radix-ui/themes";
import { useState } from "react";
import { useDesktopFileSystemMutations } from "../hooks/useDesktopFileSystem";

// Header above the channel tree with an inline "add channel" affordance. The
// add form is purely local UI state; the create itself goes through the cloud
// mutation hook.
export function ChannelsHeader() {
  const { createChannel, isCreating } = useDesktopFileSystemMutations();
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const cancel = () => {
    setIsAdding(false);
    setDraft("");
  };

  const submit = async () => {
    const name = draft.trim();
    if (!name) {
      cancel();
      return;
    }
    try {
      await createChannel(name);
      cancel();
    } catch {
      // Keep the input open so the user can retry; the mutation surfaces the error.
    }
  };

  return (
    <Flex direction="column" className="px-2 pb-1">
      <Flex align="center" justify="between" className="h-[22px]">
        <Text className="font-medium text-[11px] text-gray-10 uppercase tracking-wide">
          Channels
        </Text>
        <IconButton
          type="button"
          variant="ghost"
          color="gray"
          size="1"
          aria-label="Add channel"
          onClick={() => setIsAdding(true)}
        >
          <Plus size={12} />
        </IconButton>
      </Flex>
      {isAdding && (
        <TextField.Root
          autoFocus
          size="1"
          className="mt-1"
          value={draft}
          placeholder="Channel name"
          disabled={isCreating}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (!draft.trim()) cancel();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
        />
      )}
    </Flex>
  );
}
