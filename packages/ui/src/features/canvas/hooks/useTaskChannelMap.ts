import { useHostTRPC } from "@posthog/host-router/react";
import {
  type Channel,
  useChannels,
} from "@posthog/ui/features/canvas/hooks/useChannels";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Map of taskId → the channel it's filed to. A task is filed to at most one
 * channel (ChannelTasksService moves the row rather than duplicating it), so
 * the mapping is unambiguous. Fans out one `channelTasks.list` query per
 * channel; results are shared with the channel sidebar's per-section queries
 * through the react-query cache.
 */
export function useTaskChannelMap(options?: {
  enabled?: boolean;
}): Map<string, Channel> {
  const enabled = options?.enabled ?? true;
  const { channels } = useChannels({ enabled });
  const trpc = useHostTRPC();
  const results = useQueries({
    queries: channels.map((channel) =>
      trpc.channelTasks.list.queryOptions(
        { channelId: channel.id },
        { enabled, staleTime: 5_000 },
      ),
    ),
  });
  return useMemo(() => {
    const map = new Map<string, Channel>();
    results.forEach((res, i) => {
      const channel = channels[i];
      if (!channel) return;
      for (const record of res.data ?? []) {
        if (record.taskId) map.set(record.taskId, channel);
      }
    });
    return map;
  }, [results, channels]);
}
