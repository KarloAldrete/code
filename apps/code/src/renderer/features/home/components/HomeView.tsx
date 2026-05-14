import { useSetHeaderContent } from "@hooks/useSetHeaderContent";
import { House } from "@phosphor-icons/react";
import { Flex, Text } from "@radix-ui/themes";
import { useMemo } from "react";
import { useHomeStore } from "../store";
import { HomeDashboard } from "./HomeDashboard";
import { HomeOnboardingWizard } from "./HomeOnboardingWizard";

export function HomeView() {
  const completed = useHomeStore((s) => s.completed);

  const headerContent = useMemo(
    () => (
      <Flex align="center" gap="2" className="w-full min-w-0">
        <House size={12} className="shrink-0 text-gray-10" />
        <Text
          className="truncate whitespace-nowrap font-medium text-[13px]"
          title="Home"
        >
          Home
        </Text>
      </Flex>
    ),
    [],
  );
  useSetHeaderContent(headerContent);

  if (!completed) {
    return <HomeOnboardingWizard onStart={() => undefined} />;
  }

  return <HomeDashboard />;
}
