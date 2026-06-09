import { useFeatureFlag } from "@hooks/useFeatureFlag";
import type { PrWorkItem } from "@main/services/git/schemas";
import { useTRPC } from "@renderer/trpc";
import { WORK_ITEM_SUGGESTIONS_FLAG } from "@shared/constants";
import { useQuery } from "@tanstack/react-query";

export function useWorkItemSuggestions(
  selectedDirectory: string | null | undefined,
): PrWorkItem[] {
  const trpcReact = useTRPC();
  const flagEnabled = useFeatureFlag(
    WORK_ITEM_SUGGESTIONS_FLAG,
    import.meta.env.DEV,
  );

  const { data } = useQuery(
    trpcReact.git.getPrWorkItems.queryOptions(
      { directoryPath: selectedDirectory ?? "" },
      {
        enabled: flagEnabled && !!selectedDirectory,
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: true,
      },
    ),
  );

  return data ?? [];
}
