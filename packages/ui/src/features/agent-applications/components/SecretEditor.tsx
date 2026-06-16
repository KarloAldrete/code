import { CheckCircleIcon } from "@phosphor-icons/react";
import { Button } from "@posthog/ui/primitives/Button";
import { Flex, Text, TextField } from "@radix-ui/themes";
import { useState } from "react";
import { useAgentEnvKeyMutations } from "../hooks/useAgentEnvKeyMutations";

/**
 * Inline set/rotate/clear for one encrypted env key. The value is write-only —
 * it's posted straight to `env_keys` PUT and never read back. On success the
 * env-keys list refetches, flipping set/not-set status across the explorer.
 */
export function SecretEditor({
  idOrSlug,
  keyName,
  isSet,
}: {
  idOrSlug: string;
  keyName: string;
  isSet: boolean;
}) {
  const { setKey, clearKey } = useAgentEnvKeyMutations(idOrSlug);
  const [value, setValue] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const busy = setKey.isPending || clearKey.isPending;

  function save() {
    if (!value.trim()) return;
    setKey.mutate(
      { key: keyName, value },
      {
        onSuccess: () => {
          setValue("");
          setJustSaved(true);
          setTimeout(() => setJustSaved(false), 2000);
        },
      },
    );
  }

  return (
    <Flex direction="column" gap="2" className="mt-2">
      <Text className="text-[11px] text-gray-10 uppercase tracking-wide">
        {isSet ? "Rotate value" : "Set value"}
      </Text>
      <TextField.Root
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="paste secret value"
        autoComplete="off"
        spellCheck={false}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
      />
      {isSet ? (
        <Text className="text-[11px] text-gray-10">
          A value is already set — saving will rotate it.
        </Text>
      ) : null}

      {setKey.isError || clearKey.isError ? (
        <Text className="text-(--red-11) text-[11px]">
          {(setKey.error ?? clearKey.error)?.message ?? "Failed"}
        </Text>
      ) : null}

      <Flex align="center" gap="2">
        <Button
          size="2"
          color="green"
          onClick={save}
          disabled={busy || !value.trim()}
          loading={setKey.isPending}
        >
          {isSet ? "Rotate" : "Set"}
        </Button>
        {isSet ? (
          <Button
            size="2"
            variant="soft"
            color="red"
            onClick={() => clearKey.mutate({ key: keyName })}
            disabled={busy}
            loading={clearKey.isPending}
          >
            Clear
          </Button>
        ) : null}
        {justSaved ? (
          <Flex align="center" gap="1" className="text-(--green-11)">
            <CheckCircleIcon size={14} />
            <Text className="text-[12px]">Saved</Text>
          </Flex>
        ) : null}
      </Flex>
      <Text className="text-[11px] text-gray-10 leading-snug">
        The value is never shown again. It's encrypted at rest and only read by
        the agent at runtime.
      </Text>
    </Flex>
  );
}
