import { useAnalysisSearchStore } from "@features/analysis-search/store";
import {
  Code,
  Hammer,
  House,
  MagnifyingGlass,
  Microscope,
  Newspaper,
  SquaresFour,
} from "@phosphor-icons/react";
import { Kbd } from "@posthog/quill";
import { Box, Flex, Text } from "@radix-ui/themes";
import { useNavigationStore } from "@stores/navigationStore";
import { isMac } from "@utils/platform";
import type React from "react";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { SidebarItem } from "./SidebarItem";

export const AnalysisSidebarContent: React.FC = () => {
  const view = useNavigationStore((s) => s.view);
  const navigateToFeed = useNavigationStore((s) => s.navigateToFeed);
  const navigateToResearch = useNavigationStore((s) => s.navigateToResearch);
  const navigateToBuild = useNavigationStore((s) => s.navigateToBuild);
  const navigateToApps = useNavigationStore((s) => s.navigateToApps);
  const navigateToHome = useNavigationStore((s) => s.navigateToHome);
  const navigateToCode = useNavigationStore((s) => s.navigateToCode);

  const isHomeActive = view.type === "home";
  const isFeedActive = view.type === "feed";
  const isResearchActive = view.type === "research";
  const isBuildActive = view.type === "build";
  const isAppsActive = view.type === "apps";
  const isCodeActive = view.type === "code";

  return (
    <Flex direction="column" height="100%">
      <Box flexGrow="1" overflow="hidden">
        <Flex direction="column" py="2" px="2" gap="1px">
          <SidebarItem
            depth={0}
            icon={
              <House size={16} weight={isHomeActive ? "fill" : "regular"} />
            }
            label="Home"
            isActive={isHomeActive}
            onClick={navigateToHome}
          />
          <SidebarItem
            depth={0}
            icon={
              <Newspaper size={16} weight={isFeedActive ? "fill" : "regular"} />
            }
            label="Inbox"
            isActive={isFeedActive}
            onClick={navigateToFeed}
          />
          <SidebarItem
            depth={0}
            icon={
              <Microscope
                size={16}
                weight={isResearchActive ? "fill" : "regular"}
              />
            }
            label="Research"
            isActive={isResearchActive}
            onClick={navigateToResearch}
          />
          <SidebarItem
            depth={0}
            icon={
              <Hammer size={16} weight={isBuildActive ? "fill" : "regular"} />
            }
            label="Canvas"
            isActive={isBuildActive}
            onClick={navigateToBuild}
          />
          <SidebarItem
            depth={0}
            icon={<Code size={16} weight={isCodeActive ? "fill" : "regular"} />}
            label="Code"
            isActive={isCodeActive}
            onClick={navigateToCode}
          />
          <SidebarItem
            depth={0}
            icon={
              <SquaresFour
                size={16}
                weight={isAppsActive ? "fill" : "regular"}
              />
            }
            label="Apps"
            isActive={isAppsActive}
            onClick={navigateToApps}
          />
        </Flex>
      </Box>
      <Box p="2" className="shrink-0 border-gray-6 border-t">
        <SearchSidebarButton />
      </Box>
      <Box p="2" className="shrink-0 border-gray-6 border-t">
        <ProjectSwitcher />
      </Box>
    </Flex>
  );
};

function SearchSidebarButton() {
  const open = useAnalysisSearchStore((s) => s.open);
  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-center gap-2 rounded-(--radius-2) border border-(--gray-5) bg-(--gray-2) px-2 py-1.5 text-left transition-colors hover:bg-(--gray-3)"
    >
      <MagnifyingGlass size={14} className="text-(--gray-11)" />
      <Text size="2" className="flex-1 text-(--gray-11)">
        Explore
      </Text>
      <Kbd>{isMac ? "⌘K" : "Ctrl+K"}</Kbd>
    </button>
  );
}
