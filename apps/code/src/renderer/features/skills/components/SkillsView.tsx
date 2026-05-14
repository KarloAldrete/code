import { ResizableSidebar } from "@components/ResizableSidebar";
import { useSetHeaderContent } from "@hooks/useSetHeaderContent";
import {
  ArrowClockwise,
  Lightbulb,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import {
  Box,
  Flex,
  IconButton,
  ScrollArea,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useTRPC } from "@renderer/trpc";
import type { SkillInfo, SkillSource } from "@shared/types/skills";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSkillsSidebarStore } from "../stores/skillsSidebarStore";
import { SkillSection, SOURCE_CONFIG, SOURCE_ORDER } from "./SkillCard";
import { SkillDetailPanel } from "./SkillDetailPanel";
import { SourceFilterChips } from "./SourceFilterChips";

export function SkillsView() {
  const trpcReact = useTRPC();
  const queryClient = useQueryClient();
  const { data: skills = [], isLoading } = useQuery(
    trpcReact.skills.list.queryOptions(undefined, { staleTime: 30_000 }),
  );

  const refreshTeamMutation = useMutation(
    trpcReact.skills.refreshTeam.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpcReact.skills.list.queryFilter());
      },
      onError: (err) => {
        toast.error("Failed to refresh team skills", {
          description: err.message,
        });
      },
    }),
  );

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<Set<SkillSource>>(
    () => new Set(),
  );

  const toggleSource = useCallback((source: SkillSource) => {
    setSourceFilter((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  }, []);

  const availableSources = useMemo(() => {
    const present = new Set<SkillSource>();
    for (const skill of skills) {
      present.add(skill.source);
    }
    return SOURCE_ORDER.filter((s) => present.has(s));
  }, [skills]);

  const {
    width: sidebarWidth,
    setWidth: setSidebarWidth,
    isResizing,
    setIsResizing,
  } = useSkillsSidebarStore();

  const selectedSkill = useMemo(() => {
    if (selectedPath === null || skills.length === 0) return null;
    return skills.find((s) => s.path === selectedPath) ?? null;
  }, [skills, selectedPath]);

  const handleSelect = useCallback((path: string) => {
    setSelectedPath((prev) => (prev === path ? null : path));
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSelectedPath(null);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<SkillSource, SkillInfo[]>();
    for (const source of SOURCE_ORDER) {
      map.set(source, []);
    }
    const query = searchQuery.trim().toLowerCase();
    for (const skill of skills) {
      if (sourceFilter.size > 0 && !sourceFilter.has(skill.source)) {
        continue;
      }
      if (
        query &&
        !skill.name.toLowerCase().includes(query) &&
        !(skill.description?.toLowerCase().includes(query) ?? false)
      ) {
        continue;
      }
      const list = map.get(skill.source);
      if (list) {
        list.push(skill);
      }
    }
    return map;
  }, [skills, searchQuery, sourceFilter]);

  const headerContent = useMemo(
    () => (
      <Flex align="center" gap="2" className="w-full min-w-0">
        <Lightbulb size={12} className="shrink-0 text-gray-10" />
        <Text
          className="truncate whitespace-nowrap font-medium text-[13px]"
          title="Skills"
        >
          Skills
        </Text>
      </Flex>
    ),
    [],
  );

  useSetHeaderContent(headerContent);

  return (
    <Flex direction="column" height="100%" className="overflow-hidden">
      <Flex className="min-h-0 flex-1">
        <Box flexGrow="1" className="min-w-0">
          <ScrollArea
            type="auto"
            className="scroll-area-constrain-width h-full"
          >
            <Box px="4" py="3">
              <Flex pb="2" gap="2" align="center">
                <Box className="flex-1">
                  <TextField.Root
                    size="2"
                    placeholder="Search skills..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-[13px]"
                  >
                    <TextField.Slot>
                      <MagnifyingGlass size={14} />
                    </TextField.Slot>
                  </TextField.Root>
                </Box>
                <IconButton
                  size="2"
                  variant="soft"
                  color="gray"
                  disabled={refreshTeamMutation.isPending}
                  onClick={() => refreshTeamMutation.mutate()}
                  title="Refresh team skills"
                  aria-label="Refresh team skills"
                >
                  <ArrowClockwise
                    size={14}
                    className={
                      refreshTeamMutation.isPending ? "animate-spin" : ""
                    }
                  />
                </IconButton>
              </Flex>
              {availableSources.length > 0 && (
                <Box pb="3">
                  <SourceFilterChips
                    available={availableSources}
                    selected={sourceFilter}
                    onToggle={toggleSource}
                  />
                </Box>
              )}
              {skills.length === 0 && !isLoading ? (
                <Flex
                  align="center"
                  justify="center"
                  direction="column"
                  gap="3"
                  className="py-12"
                >
                  <Box className="rounded-lg border border-gray-6 border-dashed p-4">
                    <Lightbulb size={24} className="text-gray-8" />
                  </Box>
                  <Text className="text-[13px] text-gray-10">
                    No skills found
                  </Text>
                </Flex>
              ) : (
                <Flex direction="column" gap="5">
                  {SOURCE_ORDER.map((source) => {
                    const items = grouped.get(source);
                    if (!items || items.length === 0) return null;
                    const config = SOURCE_CONFIG[source];

                    return (
                      <SkillSection
                        key={source}
                        title={config.sectionTitle}
                        skills={items}
                        selectedPath={selectedSkill?.path ?? null}
                        onSelect={handleSelect}
                      />
                    );
                  })}
                </Flex>
              )}
            </Box>
          </ScrollArea>
        </Box>

        <ResizableSidebar
          open={!!selectedSkill}
          width={sidebarWidth}
          setWidth={setSidebarWidth}
          isResizing={isResizing}
          setIsResizing={setIsResizing}
          side="right"
        >
          {selectedSkill && (
            <SkillDetailPanel
              skill={selectedSkill}
              onClose={handleCloseSidebar}
            />
          )}
        </ResizableSidebar>
      </Flex>
    </Flex>
  );
}
