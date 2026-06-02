import { SettingRow } from "@features/settings/components/SettingRow";
import { DiscordPresencePreview } from "@features/settings/components/sections/DiscordPresencePreview";
import type { DiscordPresenceState } from "@main/services/discord-presence/schemas";
import { Flex, Switch, Text } from "@radix-ui/themes";
import { useTRPC } from "@renderer/trpc";
import { ANALYTICS_EVENTS } from "@shared/types/analytics";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { track } from "@utils/analytics";
import { useEffect, useState } from "react";

export function DiscordSettings() {
  const trpcReact = useTRPC();
  const { data } = useQuery(trpcReact.discordPresence.getState.queryOptions());
  const [state, setState] = useState<DiscordPresenceState | null>(null);

  useEffect(() => {
    if (data) setState(data);
  }, [data]);

  // The service emits status changes (connect/disconnect, toggle writes) so the
  // panel reflects the live connection without polling.
  useSubscription(
    trpcReact.discordPresence.onStatusChanged.subscriptionOptions(undefined, {
      onData: setState,
    }),
  );

  const setEnabled = useMutation(
    trpcReact.discordPresence.setEnabled.mutationOptions(),
  );
  const setShowTaskTitle = useMutation(
    trpcReact.discordPresence.setShowTaskTitle.mutationOptions(),
  );
  const setShowRepoName = useMutation(
    trpcReact.discordPresence.setShowRepoName.mutationOptions(),
  );

  const enabled = state?.enabled ?? false;
  const configured = state?.configured ?? false;
  const connected = state?.connected ?? false;

  const handleEnabledChange = (checked: boolean) => {
    track(ANALYTICS_EVENTS.SETTING_CHANGED, {
      setting_name: "discord_presence_enabled",
      new_value: checked,
      old_value: enabled,
    });
    setState((prev) => (prev ? { ...prev, enabled: checked } : prev));
    setEnabled.mutate({ enabled: checked });
  };

  const handleShowTaskTitleChange = (checked: boolean) => {
    track(ANALYTICS_EVENTS.SETTING_CHANGED, {
      setting_name: "discord_presence_show_task_title",
      new_value: checked,
      old_value: state?.showTaskTitle ?? false,
    });
    setState((prev) => (prev ? { ...prev, showTaskTitle: checked } : prev));
    setShowTaskTitle.mutate({ value: checked });
  };

  const handleShowRepoNameChange = (checked: boolean) => {
    track(ANALYTICS_EVENTS.SETTING_CHANGED, {
      setting_name: "discord_presence_show_repo_name",
      new_value: checked,
      old_value: state?.showRepoName ?? false,
    });
    setState((prev) => (prev ? { ...prev, showRepoName: checked } : prev));
    setShowRepoName.mutate({ value: checked });
  };

  return (
    <Flex direction="column">
      <SettingRow
        label="Rich Presence"
        description="Show what you're working on in PostHog Code on your profile"
        noBorder
      >
        <Switch
          checked={enabled}
          onCheckedChange={handleEnabledChange}
          size="1"
        />
      </SettingRow>

      {enabled && (
        <>
          {!configured ? (
            <Text color="yellow" className="-mt-3 pb-3 text-[13px]">
              No Discord application is configured for this build, so nothing
              will appear yet. Set VITE_DISCORD_CLIENT_ID to connect.
            </Text>
          ) : (
            <Text
              color={connected ? "green" : "amber"}
              className="-mt-3 pb-3 text-[13px]"
            >
              {connected
                ? "Connected to Discord"
                : "Waiting for Discord (desktop app needs to be running)..."}
            </Text>
          )}

          <Text className="block border-gray-6 border-t pt-4 font-medium text-sm">
            Privacy
          </Text>

          <SettingRow
            label="Show task title"
            description="Include the focused task's title"
          >
            <Switch
              checked={state?.showTaskTitle ?? false}
              onCheckedChange={handleShowTaskTitleChange}
              size="1"
            />
          </SettingRow>

          <SettingRow
            label="Show repository name"
            description="Include the repository (org/repo) you're working in"
            noBorder
          >
            <Switch
              checked={state?.showRepoName ?? false}
              onCheckedChange={handleShowRepoNameChange}
              size="1"
            />
          </SettingRow>
        </>
      )}

      <DiscordPresencePreview
        enabled={enabled}
        showTaskTitle={state?.showTaskTitle ?? false}
        showRepoName={state?.showRepoName ?? false}
      />
    </Flex>
  );
}
