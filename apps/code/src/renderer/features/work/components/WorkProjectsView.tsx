import { MagnifyingGlass, Plus, SortAscending } from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";
import type { WorkProject } from "@shared/types/work-projects";
import { useNavigationStore } from "@stores/navigationStore";
import { toast } from "@utils/toast";
import { useCallback } from "react";
import { PROJECT_ICON_MAP } from "../canvas/icons";
import { createProject, useWorkProjects } from "../canvas/useProjectCanvas";

function formatUpdated(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Updated recently";
  const diffMs = Date.now() - then;
  if (diffMs < 60_000) return "Updated just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Updated ${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `Updated ${weeks}w ago`;
}

function ProjectCard({ project }: { project: WorkProject }) {
  const navigateToWorkProjectDetail = useNavigationStore(
    (s) => s.navigateToWorkProjectDetail,
  );

  const Icon = PROJECT_ICON_MAP[project.iconId] ?? PROJECT_ICON_MAP.lightbulb;

  return (
    <button
      type="button"
      onClick={() => navigateToWorkProjectDetail(project.id)}
      className="group flex h-full cursor-pointer flex-col gap-3 rounded-(--radius-3) border border-(--gray-4) bg-(--gray-1) p-4 text-left transition-colors hover:border-(--gray-6) hover:bg-(--gray-2)"
    >
      <Flex
        align="center"
        justify="center"
        className="h-9 w-9 shrink-0 rounded-(--radius-2) bg-(--gray-3) text-(--gray-11)"
      >
        <Icon size={18} weight="regular" />
      </Flex>

      <Box>
        <Text
          as="div"
          weight="medium"
          className="truncate text-(--gray-12) text-[14px]"
        >
          {project.name}
        </Text>
        <Text as="div" className="text-(--gray-10) text-[12px]">
          {project.tagline}
        </Text>
      </Box>

      <Text as="div" className="mt-auto text-(--gray-9) text-[11px]">
        {formatUpdated(project.updatedAt)}
      </Text>
    </button>
  );
}

export function WorkProjectsView() {
  const { data: projects, isLoading } = useWorkProjects();
  const navigateToWorkProjectDetail = useNavigationStore(
    (s) => s.navigateToWorkProjectDetail,
  );

  const handleNewProject = useCallback(async () => {
    try {
      const project = await createProject({});
      navigateToWorkProjectDetail(project.id);
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Unknown error";
      toast.error("Could not create project", { description });
    }
  }, [navigateToWorkProjectDetail]);

  return (
    <Box className="scrollbar-overlay-y h-full w-full overflow-y-auto">
      <Flex
        direction="column"
        gap="6"
        className="mx-auto w-full max-w-[960px] px-8 pt-12 pb-12"
      >
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Flex direction="column" gap="1">
            <Text
              as="div"
              weight="medium"
              className="text-(--gray-12) text-[22px]"
            >
              Projects
            </Text>
            <Text as="div" className="text-(--gray-11) text-[13px]">
              A canvas of tiles — dashboards, files, notes, and skill outputs —
              with a chat that can shape it.
            </Text>
          </Flex>

          <Flex align="center" gap="2">
            <button
              type="button"
              title="Sort"
              className="flex h-8 w-8 items-center justify-center rounded-(--radius-2) text-(--gray-10) transition-colors hover:bg-(--gray-3) hover:text-(--gray-12)"
            >
              <SortAscending size={14} weight="regular" />
            </button>
            <button
              type="button"
              title="Search"
              className="flex h-8 w-8 items-center justify-center rounded-(--radius-2) text-(--gray-10) transition-colors hover:bg-(--gray-3) hover:text-(--gray-12)"
            >
              <MagnifyingGlass size={14} weight="regular" />
            </button>
            <button
              type="button"
              onClick={handleNewProject}
              className="flex h-8 items-center gap-1.5 rounded-(--radius-2) bg-(--gray-12) px-3 text-(--gray-1) text-[13px] transition-colors hover:bg-(--gray-11)"
            >
              <Plus size={13} weight="bold" />
              New project
            </button>
          </Flex>
        </Flex>

        <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && !projects ? (
            <Text as="div" className="text-(--gray-11) text-[13px]">
              Loading projects…
            </Text>
          ) : (
            (projects ?? []).map((p) => <ProjectCard key={p.id} project={p} />)
          )}
        </Box>
      </Flex>
    </Box>
  );
}
