import { useInboxSignalsFilterStore } from "@features/inbox/stores/inboxSignalsFilterStore";
import {
  useRepositoryIntegration,
  useUserRepositoryIntegration,
} from "@hooks/useIntegrations";
import { Check, GitBranch, MagnifyingGlass } from "@phosphor-icons/react";
import { Box, Flex, Popover, Spinner, Text } from "@radix-ui/themes";
import { useDeferredValue, useMemo, useState } from "react";

export function RepoFilterMenu() {
  const [open, setOpen] = useState(false);
  const [repoQuery, setRepoQuery] = useState("");
  const deferredRepoQuery = useDeferredValue(repoQuery);

  const { repositories: orgRepositories, isLoadingRepos: orgLoading } =
    useRepositoryIntegration();
  const { repositories: userRepositories, isLoadingRepos: userLoading } =
    useUserRepositoryIntegration();

  const repoFilter = useInboxSignalsFilterStore((s) => s.repoFilter);
  const toggleRepo = useInboxSignalsFilterStore((s) => s.toggleRepo);
  const setRepoFilter = useInboxSignalsFilterStore((s) => s.setRepoFilter);

  // Merge org-level + user-level repos and de-duplicate (case-insensitive). The
  // signal report `repo_selection` artefact stores `owner/repo` in lowercase, and
  // the filter is matched case-insensitively, so we present a single canonical
  // lowercase entry per repo regardless of which integration source it came from.
  const availableRepos = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const repo of [...orgRepositories, ...userRepositories]) {
      const key = repo.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [orgRepositories, userRepositories]);

  const visibleRepos = useMemo(() => {
    const trimmed = deferredRepoQuery.trim().toLowerCase();
    if (!trimmed) return availableRepos;
    return availableRepos.filter((r) => r.includes(trimmed));
  }, [availableRepos, deferredRepoQuery]);

  const isFetching = orgLoading || userLoading;
  const selectedCount = repoFilter.length;
  const hasSelected = selectedCount > 0;

  return (
    <Popover.Root
      modal
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setRepoQuery("");
        }
      }}
    >
      <Popover.Trigger>
        <button
          type="button"
          aria-label="Filter by repository"
          className={`flex h-6 min-w-6 items-center justify-center gap-1 rounded-sm px-1.5 transition-colors hover:bg-gray-3 hover:text-gray-12 ${
            selectedCount > 0 ? "bg-gray-3 text-gray-12" : "text-gray-10"
          }`}
        >
          <GitBranch size={14} />
          {selectedCount > 0 ? (
            <span className="text-[11px] text-gray-12 leading-none">
              {selectedCount}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Content
        align="end"
        side="bottom"
        sideOffset={6}
        className="min-w-[280px] max-w-[320px] p-[8px]"
      >
        <Flex direction="column" gap="2">
          <Flex align="center" justify="between" gap="2">
            <Text className="pl-[1px] font-medium text-[13px] text-gray-10">
              Repository
            </Text>
            {hasSelected ? (
              <button
                type="button"
                onClick={() => setRepoFilter([])}
                className="rounded-sm px-1 py-0.5 text-[11px] text-gray-10 transition-colors hover:bg-gray-3 hover:text-gray-12"
              >
                Clear
              </button>
            ) : null}
          </Flex>

          <Flex
            align="center"
            gap="2"
            px="2"
            py="1"
            className="rounded-(--radius-2) border border-(--gray-6) bg-(--color-background)"
          >
            <MagnifyingGlass size={12} className="shrink-0 text-gray-10" />
            <input
              type="text"
              placeholder="Filter repos..."
              value={repoQuery}
              onChange={(e) => setRepoQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-gray-12 outline-none placeholder:text-gray-9"
            />
          </Flex>

          <Box className="max-h-[280px] overflow-y-auto">
            {isFetching && availableRepos.length === 0 ? (
              <Flex align="center" justify="center" py="3">
                <Spinner size="1" />
              </Flex>
            ) : visibleRepos.length === 0 ? (
              <Text color="gray" className="px-1 py-2 text-[12px]">
                {availableRepos.length === 0
                  ? "No repos available."
                  : "No repos match."}
              </Text>
            ) : (
              <Flex direction="column">
                {visibleRepos.map((repo) => {
                  const isSelected = repoFilter.includes(repo);
                  return (
                    <button
                      key={repo}
                      type="button"
                      className="flex w-full items-center justify-between rounded-sm px-1 py-1 text-left text-[13px] text-gray-12 transition-colors hover:bg-gray-3 focus-visible:bg-gray-3 focus-visible:outline-none"
                      onClick={() => toggleRepo(repo)}
                    >
                      <Text className="min-w-0 truncate text-[12px]">
                        {repo}
                      </Text>
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-12"
                        aria-hidden
                      >
                        {isSelected ? <Check size={12} weight="bold" /> : null}
                      </span>
                    </button>
                  );
                })}
              </Flex>
            )}
          </Box>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
}
