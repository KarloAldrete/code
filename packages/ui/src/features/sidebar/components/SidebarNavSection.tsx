import {
  INBOX_PIPELINE_STATUS_FILTER,
  INBOX_REFETCH_INTERVAL_MS,
  isReportUpForReview,
} from "@posthog/core/inbox/reportFiltering";
import { HOME_TAB_FLAG } from "@posthog/shared/constants";
import { useCommandCenterStore } from "@posthog/ui/features/command-center/commandCenterStore";
import { useFeatureFlag } from "@posthog/ui/features/feature-flags/useFeatureFlag";
import { useInboxReports } from "@posthog/ui/features/inbox/hooks/useInboxReports";
import { useSidebarStore } from "@posthog/ui/features/sidebar/sidebarStore";
import { useTasks } from "@posthog/ui/features/tasks/useTasks";
import {
  navigateToAgents,
  navigateToCommandCenter,
  navigateToHome,
  navigateToInbox,
  navigateToMcpServers,
  navigateToSkills,
} from "@posthog/ui/router/navigationBridge";
import { useAppView } from "@posthog/ui/router/useAppView";
import { openTaskInput } from "@posthog/ui/router/useOpenTask";
import { useCommandMenuStore } from "@posthog/ui/shell/commandMenuStore";
import { useRendererWindowFocusStore } from "@posthog/ui/shell/rendererWindowFocusStore";
import { Box, Flex } from "@radix-ui/themes";
import { AgentsItem } from "./items/AgentsItem";
import { CommandCenterItem } from "./items/CommandCenterItem";
import { HomeItem } from "./items/HomeItem";
import { InboxItem } from "./items/InboxItem";
import { McpServersItem } from "./items/McpServersItem";
import { NewTaskItem } from "./items/NewTaskItem";
import { SearchItem } from "./items/SearchItem";
import { SkillsItem } from "./items/SkillsItem";

// The sidebar navigation section shared by the Code pane (above the task list)
// and the Channels pane. It is fully self-contained — every item's active
// state, badge count, and click handler is wired here — so it can be dropped
// into either layout. Items route to the code-space views; from the Channels
// pane that switches the layout back to Code (Search opens the command menu in
// place).
export function SidebarNavSection() {
  const view = useAppView();
  const homeTabEnabled = useFeatureFlag(HOME_TAB_FLAG);

  // Active flags are pure functions of the current view — mirror what
  // useSidebarData derives, without pulling in its task-loading.
  const isHomeActive =
    view.type === "task-input" || view.type === "task-pending";
  const isHomeViewActive = view.type === "home";
  const isInboxActive = view.type === "inbox";
  const isAgentsActive = view.type === "agents";
  const isCommandCenterActive = view.type === "command-center";
  const isSkillsActive = view.type === "skills";
  const isMcpServersActive = view.type === "mcp-servers";

  const inboxPollingActive = useRendererWindowFocusStore((s) => s.focused);
  const { data: inboxProbe } = useInboxReports(
    { status: INBOX_PIPELINE_STATUS_FILTER },
    {
      refetchInterval: inboxPollingActive ? INBOX_REFETCH_INTERVAL_MS : false,
      refetchIntervalInBackground: false,
      staleTime: inboxPollingActive ? INBOX_REFETCH_INTERVAL_MS : 15_000,
    },
  );
  const inboxResults = inboxProbe?.results ?? [];
  const inboxSignalCount = inboxResults.filter(isReportUpForReview).length;

  const showAllUsers = useSidebarStore((s) => s.showAllUsers);
  const showInternal = useSidebarStore((s) => s.showInternal);
  const { data: allTasks = [] } = useTasks({ showAllUsers, showInternal });
  const taskIds = new Set(allTasks.map((t) => t.id));
  const commandCenterCells = useCommandCenterStore((s) => s.cells);
  const commandCenterActiveCount = commandCenterCells.filter(
    (taskId) => taskId != null && taskIds.has(taskId),
  ).length;

  const openCommandMenu = useCommandMenuStore((s) => s.open);

  return (
    <Flex direction="column" className="shrink-0 gap-px px-2 py-2">
      <Box mb="2">
        <NewTaskItem isActive={isHomeActive} onClick={openTaskInput} />
      </Box>

      {homeTabEnabled && (
        <Box>
          <HomeItem isActive={isHomeViewActive} onClick={navigateToHome} />
        </Box>
      )}

      <Box>
        <SearchItem onClick={openCommandMenu} />
      </Box>

      <Box>
        <InboxItem
          isActive={isInboxActive}
          onClick={navigateToInbox}
          signalCount={inboxSignalCount}
        />
      </Box>

      <Box>
        <AgentsItem isActive={isAgentsActive} onClick={navigateToAgents} />
      </Box>

      <Box>
        <SkillsItem isActive={isSkillsActive} onClick={navigateToSkills} />
      </Box>

      <Box>
        <McpServersItem
          isActive={isMcpServersActive}
          onClick={navigateToMcpServers}
        />
      </Box>

      <Box mb="2">
        <CommandCenterItem
          isActive={isCommandCenterActive}
          onClick={navigateToCommandCenter}
          activeCount={commandCenterActiveCount}
        />
      </Box>
    </Flex>
  );
}
