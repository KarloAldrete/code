import { Tooltip } from "@components/ui/Tooltip";
import { useArchivedTaskIds } from "@features/archive/hooks/useArchivedTaskIds";
import { getAuthenticatedClient } from "@features/auth/hooks/authClient";
import {
  getTeamMemberDisplay,
  listKnownTeamMembers,
} from "@features/sessions/components/session-update/parseFileMentions";
import { sessionStoreSetters } from "@features/sessions/stores/sessionStore";
import { usePinnedTasks } from "@features/sidebar/hooks/usePinnedTasks";
import { useArchiveTask } from "@features/tasks/hooks/useArchiveTask";
import {
  Archive,
  BookOpen,
  Brain,
  ClockClockwise,
  DotsThree,
  FolderSimple,
  type IconProps,
  Lock,
  Plugs,
  PushPin,
} from "@phosphor-icons/react";
import { ScrollArea } from "@posthog/quill";
import { Box, Flex, Popover, Text } from "@radix-ui/themes";
import { useTaskContextMenu } from "@renderer/hooks/useTaskContextMenu";
import type { Task } from "@shared/types";
import { useNavigationStore, type WorkView } from "@stores/navigationStore";
import { logger } from "@utils/logger";
import { type ComponentType, useMemo, useRef, useState } from "react";
import { NewTaskItem } from "../../sidebar/components/items/HomeItem";
import { SidebarItem } from "../../sidebar/components/SidebarItem";
import { PROJECT_ICON_MAP } from "../canvas/icons";
import { useWorkProjects } from "../canvas/useProjectCanvas";
import { useWorkThreadTasks } from "../hooks/useWorkThreadTasks";
import { useWorkThreadParticipantsStore } from "../stores/workThreadParticipantsStore";

interface WorkSidebarItemSpec {
  icon: ComponentType<IconProps>;
  label: string;
  /** When set, the item navigates to that workView and lights up while active. */
  workView?: WorkView | "scheduled-section";
}

const STATIC_ITEMS: WorkSidebarItemSpec[] = [
  { icon: FolderSimple, label: "Projects" },
  {
    icon: ClockClockwise,
    label: "Scheduled",
    workView: "scheduled-section",
  },
  { icon: BookOpen, label: "Skills", workView: "library" },
  { icon: Plugs, label: "Data sources" },
  { icon: Brain, label: "Memory", workView: "memory" },
];

const THREADS_COLLAPSED_COUNT = 5;

function deriveThreadLabel(task: Task): string {
  const title = task.title?.trim();
  if (title) return title;
  const firstLine = task.description?.split(/\r?\n/)[0]?.trim();
  if (firstLine) return firstLine.slice(0, 80);
  return "Untitled task";
}

const log = logger.scope("work-sidebar-collaborators");

async function addTeammateToThread(taskId: string, uuid: string) {
  const display = getTeamMemberDisplay(uuid);
  try {
    const client = await getAuthenticatedClient();
    if (client) {
      await client.addTaskCollaborators(taskId, [uuid]);
    }
  } catch (error) {
    log.error("Failed to add task collaborator", { error, uuid });
  }
  const session = sessionStoreSetters.getSessionByTaskId(taskId);
  if (session) {
    sessionStoreSetters.appendOptimisticItem(session.taskRunId, {
      type: "user_message",
      content: `<team_member uuid="${uuid}" name="${display.name}" />`,
      timestamp: Date.now(),
    });
  }
}

function CollaboratorRow({
  uuid,
  trailing,
}: {
  uuid: string;
  trailing?: React.ReactNode;
}) {
  const m = getTeamMemberDisplay(uuid);
  return (
    <Flex align="center" gap="2" className="py-1 text-[13px]">
      {m.avatar ? (
        <img
          src={m.avatar}
          alt=""
          className="size-5 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-(--gray-5) text-(--gray-11) text-[10px]">
          {m.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="flex-1 truncate">{m.name}</span>
      {trailing}
    </Flex>
  );
}

function CollaboratorsPopover({
  taskId,
  collaboratorUuids,
  sharedCount,
  onAdd,
}: {
  taskId: string;
  collaboratorUuids: string[];
  sharedCount: number;
  onAdd: (uuid: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  const inThreadSet = new Set(collaboratorUuids.map((u) => u.toLowerCase()));
  const remaining = listKnownTeamMembers().filter(
    (m) => !inThreadSet.has(m.uuid.toLowerCase()),
  );
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <button
          type="button"
          aria-label="View collaborators"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          className="peer/collabs shrink-0 cursor-pointer rounded-full border-none bg-(--gray-a4) px-1.5 py-px text-(--gray-11) text-[11px] leading-tight hover:bg-(--gray-a5) hover:text-(--gray-12)"
        >
          +{sharedCount}
        </button>
      </Popover.Trigger>
      <Popover.Content
        size="1"
        align="end"
        side="bottom"
        sideOffset={4}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        <Flex direction="column" className="min-w-[200px]">
          <Text
            as="div"
            className="px-1 pb-1 font-medium text-(--gray-10) text-[11px] uppercase tracking-wide"
          >
            In this thread
          </Text>
          {collaboratorUuids.map((uuid) => (
            <CollaboratorRow key={uuid} uuid={uuid} />
          ))}
          {remaining.length > 0 && (
            <>
              <Text
                as="div"
                className="mt-2 px-1 pb-1 font-medium text-(--gray-10) text-[11px] uppercase tracking-wide"
              >
                Add teammate
              </Text>
              {remaining.map((m) => (
                <button
                  key={m.uuid}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd(m.uuid);
                    void addTeammateToThread(taskId, m.uuid);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-(--radius-2) border-none bg-transparent px-1 py-1 text-left text-[13px] hover:bg-(--accent-a3)"
                >
                  <img
                    src={m.avatar}
                    alt=""
                    className="size-5 shrink-0 rounded-full object-cover"
                  />
                  <span className="flex-1 truncate">{m.name}</span>
                  <span className="text-(--gray-10) text-[12px]">+</span>
                </button>
              ))}
            </>
          )}
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
}

function ThreadHoverToolbar({
  isPinned,
  onTogglePin,
  onArchive,
}: {
  isPinned: boolean;
  onTogglePin: () => void;
  onArchive: () => void;
}) {
  return (
    <span className="peer-hover/collabs:!hidden hidden shrink-0 items-center gap-0.5 group-hover:flex">
      <Tooltip content={isPinned ? "Unpin thread" : "Pin thread"} side="top">
        {/* biome-ignore lint/a11y/useSemanticElements: nested button not allowed inside SidebarItem button */}
        <span
          role="button"
          tabIndex={0}
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-gray-10 transition-colors hover:bg-gray-4 hover:text-gray-12"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onTogglePin();
            }
          }}
        >
          <PushPin size={12} weight={isPinned ? "fill" : "regular"} />
        </span>
      </Tooltip>
      <Tooltip content="Archive thread" side="top">
        {/* biome-ignore lint/a11y/useSemanticElements: nested button not allowed inside SidebarItem button */}
        <span
          role="button"
          tabIndex={0}
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-gray-10 transition-colors hover:bg-gray-4 hover:text-gray-12"
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onArchive();
            }
          }}
        >
          <Archive size={12} />
        </span>
      </Tooltip>
    </span>
  );
}

export function WorkSidebarMenu() {
  const workView = useNavigationStore((s) => s.workView);
  const activeTaskId = useNavigationStore((s) => s.workActiveTaskId);
  const navigateToWorkHome = useNavigationStore((s) => s.navigateToWorkHome);
  const navigateToWorkLibrary = useNavigationStore(
    (s) => s.navigateToWorkLibrary,
  );
  const navigateToWorkScheduledList = useNavigationStore(
    (s) => s.navigateToWorkScheduledList,
  );
  const navigateToWorkDataSources = useNavigationStore(
    (s) => s.navigateToWorkDataSources,
  );
  const navigateToWorkProjects = useNavigationStore(
    (s) => s.navigateToWorkProjects,
  );
  const navigateToWorkMemory = useNavigationStore(
    (s) => s.navigateToWorkMemory,
  );
  const navigateToWorkTask = useNavigationStore((s) => s.navigateToWorkTask);
  const navigateToWorkProjectDetail = useNavigationStore(
    (s) => s.navigateToWorkProjectDetail,
  );
  const workSelectedProjectId = useNavigationStore(
    (s) => s.workSelectedProjectId,
  );
  const isProjectDetailActive = workView === "project-detail";

  const { data: allProjects } = useWorkProjects();
  const pinnedProjects = useMemo(() => {
    const arr = (allProjects ?? []).filter((p) => p.pinnedAt);
    arr.sort(
      (a, b) =>
        new Date(b.pinnedAt ?? 0).getTime() -
        new Date(a.pinnedAt ?? 0).getTime(),
    );
    return arr.slice(0, 8);
  }, [allProjects]);

  const { data: threadTasks } = useWorkThreadTasks();
  const archivedTaskIds = useArchivedTaskIds();
  const { pinnedTaskIds, togglePin } = usePinnedTasks();
  const { archiveTask } = useArchiveTask();
  const { showContextMenu } = useTaskContextMenu();
  const participantsByTask = useWorkThreadParticipantsStore(
    (s) => s.participantsByTask,
  );
  const addParticipants = useWorkThreadParticipantsStore(
    (s) => s.addParticipants,
  );
  const [threadsExpanded, setThreadsExpanded] = useState(false);

  const isHomeActive = workView === "home";
  const isLibraryActive = workView === "library";
  const isScheduledActive =
    workView === "scheduled-list" ||
    workView === "scheduled-create-prompt" ||
    workView === "scheduled-edit";
  const isDataSourcesActive = workView === "data-sources";
  // Keep the Projects nav item lit while a project is open – the open project
  // shows as a sub-item, so the parent remains the "active section".
  const isProjectsActive = workView === "projects" || isProjectDetailActive;
  const isMemoryActive = workView === "memory";

  const activeProject = useMemo(() => {
    if (!isProjectDetailActive || !workSelectedProjectId) return null;
    return (
      (allProjects ?? []).find((p) => p.id === workSelectedProjectId) ?? null
    );
  }, [isProjectDetailActive, workSelectedProjectId, allProjects]);
  const showActiveAsSubItem =
    !!activeProject && !pinnedProjects.some((p) => p.id === activeProject.id);

  const threadsWithTasks: { id: string; task: Task }[] = threadTasks
    .filter((task) => !archivedTaskIds.has(task.id))
    .sort((a, b) => {
      const aPinned = pinnedTaskIds.has(a.id) ? 1 : 0;
      const bPinned = pinnedTaskIds.has(b.id) ? 1 : 0;
      return bPinned - aPinned;
    })
    .map((task) => ({ id: task.id, task }));

  const hasOverflow = threadsWithTasks.length > THREADS_COLLAPSED_COUNT;
  const visibleThreads =
    threadsExpanded || !hasOverflow
      ? threadsWithTasks
      : threadsWithTasks.slice(0, THREADS_COLLAPSED_COUNT);
  const hiddenCount = threadsWithTasks.length - visibleThreads.length;

  return (
    <Box height="100%" position="relative">
      <ScrollArea className="h-full overflow-y-auto overflow-x-hidden">
        <Flex direction="column" py="2" px="2" gap="1px">
          <Box mb="2">
            <NewTaskItem
              isActive={isHomeActive}
              onClick={navigateToWorkHome}
              variant="primary"
            />
          </Box>

          {STATIC_ITEMS.map((item) => {
            const Icon = item.icon;
            const isScheduled = item.workView === "scheduled-section";
            const isDataSources = item.label === "Data sources";
            const isProjects = item.label === "Projects";
            const isMemory = item.workView === "memory";
            const isSkills = item.workView === "library";
            const isActive =
              (isScheduled && isScheduledActive) ||
              (isDataSources && isDataSourcesActive) ||
              (isProjects && isProjectsActive) ||
              (isMemory && isMemoryActive) ||
              (isSkills && isLibraryActive);
            const onClick = isScheduled
              ? navigateToWorkScheduledList
              : isDataSources
                ? navigateToWorkDataSources
                : isProjects
                  ? navigateToWorkProjects
                  : isMemory
                    ? navigateToWorkMemory
                    : isSkills
                      ? navigateToWorkLibrary
                      : undefined;
            return (
              <Box key={item.label}>
                <SidebarItem
                  depth={0}
                  icon={
                    <Icon size={16} weight={isActive ? "fill" : "regular"} />
                  }
                  label={item.label}
                  isActive={isActive}
                  onClick={onClick}
                />
                {isProjects &&
                  (pinnedProjects.length > 0 || showActiveAsSubItem) && (
                    <Flex direction="column" gap="1px">
                      {pinnedProjects.map((project) => {
                        const ProjectIcon =
                          PROJECT_ICON_MAP[project.iconId] ??
                          PROJECT_ICON_MAP.lightbulb;
                        const isProjectActive =
                          isProjectDetailActive &&
                          workSelectedProjectId === project.id;
                        return (
                          <SidebarItem
                            key={project.id}
                            depth={1}
                            icon={
                              <ProjectIcon
                                size={14}
                                weight={isProjectActive ? "fill" : "regular"}
                              />
                            }
                            label={project.name}
                            isActive={isProjectActive}
                            onClick={() =>
                              navigateToWorkProjectDetail(project.id)
                            }
                          />
                        );
                      })}
                      {showActiveAsSubItem &&
                        activeProject &&
                        (() => {
                          const ProjectIcon =
                            PROJECT_ICON_MAP[activeProject.iconId] ??
                            PROJECT_ICON_MAP.lightbulb;
                          return (
                            <SidebarItem
                              key={activeProject.id}
                              depth={1}
                              icon={<ProjectIcon size={14} weight="fill" />}
                              label={activeProject.name}
                              isActive
                              onClick={() =>
                                navigateToWorkProjectDetail(activeProject.id)
                              }
                            />
                          );
                        })()}
                    </Flex>
                  )}
              </Box>
            );
          })}

          {threadsWithTasks.length > 0 && (
            <>
              <Box px="2" pt="3" pb="1">
                <Text
                  as="div"
                  className="font-medium text-(--gray-10) text-[11px] uppercase tracking-wide"
                >
                  Threads
                </Text>
              </Box>

              {visibleThreads.map(({ id, task }) => {
                const isActive =
                  workView === "task-detail" && activeTaskId === id;
                const serverCollaborators = (() => {
                  const schema = task.json_schema as
                    | { __code_meta?: { collaborators?: unknown } | null }
                    | null
                    | undefined;
                  const collabs = schema?.__code_meta?.collaborators;
                  return Array.isArray(collabs)
                    ? collabs.filter((v): v is string => typeof v === "string")
                    : [];
                })();
                const localCollaborators = participantsByTask[id] ?? [];
                const sharedCount = new Set([
                  ...serverCollaborators,
                  ...localCollaborators,
                ]).size;
                const isShared = sharedCount > 0;
                const isPinned = pinnedTaskIds.has(id);
                const showLock = !isShared;
                const leadingIcon =
                  isPinned || showLock ? (
                    <Flex align="center" gap="1">
                      {isPinned && (
                        <PushPin
                          size={16}
                          weight="fill"
                          className="text-accent-11"
                        />
                      )}
                      {showLock && (
                        <Lock
                          size={16}
                          weight={isActive ? "fill" : "regular"}
                        />
                      )}
                    </Flex>
                  ) : undefined;
                return (
                  <Box key={id}>
                    <SidebarItem
                      depth={0}
                      icon={leadingIcon}
                      label={deriveThreadLabel(task)}
                      isActive={isActive}
                      onClick={() => navigateToWorkTask(id)}
                      onContextMenu={(e) =>
                        showContextMenu(task, e, {
                          isPinned,
                          onTogglePin: () => void togglePin(id),
                        })
                      }
                      endContent={
                        // flex-row-reverse so the badge sits visually right,
                        // toolbar to its left. The DOM order keeps the badge
                        // first so `peer-hover/collabs` on the toolbar still
                        // resolves correctly.
                        <Flex
                          align="center"
                          gap="1"
                          className="flex-row-reverse"
                        >
                          {isShared && (
                            <CollaboratorsPopover
                              taskId={id}
                              sharedCount={sharedCount}
                              collaboratorUuids={Array.from(
                                new Set([
                                  ...serverCollaborators,
                                  ...localCollaborators,
                                ]),
                              )}
                              onAdd={(uuid) => addParticipants(id, [uuid])}
                            />
                          )}
                          <ThreadHoverToolbar
                            isPinned={isPinned}
                            onTogglePin={() => void togglePin(id)}
                            onArchive={() => void archiveTask({ taskId: id })}
                          />
                        </Flex>
                      }
                    />
                  </Box>
                );
              })}

              {hasOverflow && (
                <Box>
                  <SidebarItem
                    depth={0}
                    icon={<DotsThree size={16} weight="bold" />}
                    label={
                      threadsExpanded
                        ? "Show less"
                        : `Show more (${hiddenCount})`
                    }
                    isActive={false}
                    onClick={() => setThreadsExpanded((v) => !v)}
                  />
                </Box>
              )}
            </>
          )}
        </Flex>
      </ScrollArea>
    </Box>
  );
}
