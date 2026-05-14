import { useOnboardingStore } from "@features/onboarding/stores/onboardingStore";
import { useWorkspaces } from "@features/workspace/hooks/useWorkspace";
import { Box } from "@radix-ui/themes";
import { useAppModeStore } from "@stores/appModeStore";
import { useEffect } from "react";
import { useSidebarStore } from "../stores/sidebarStore";
import { AnalysisSidebarContent } from "./AnalysisSidebarContent";
import { Sidebar, SidebarContent } from "./index";

export function MainSidebar() {
  const { data: workspaces = {}, isFetched } = useWorkspaces();
  const hasCompletedOnboarding = useOnboardingStore(
    (state) => state.hasCompletedOnboarding,
  );
  const setOpenAuto = useSidebarStore((state) => state.setOpenAuto);
  const appMode = useAppModeStore((s) => s.mode);

  useEffect(() => {
    if (isFetched) {
      const workspaceCount = Object.keys(workspaces).length;
      setOpenAuto(hasCompletedOnboarding || workspaceCount > 0);
    }
  }, [isFetched, workspaces, hasCompletedOnboarding, setOpenAuto]);

  return (
    <Box flexShrink="0" className="shrink-0">
      <Sidebar>
        {appMode === "analysis" ? (
          <AnalysisSidebarContent />
        ) : (
          <SidebarContent />
        )}
      </Sidebar>
    </Box>
  );
}
