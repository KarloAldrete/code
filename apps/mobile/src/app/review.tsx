import { Text } from "@components/text";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FloatingBackButton } from "@/components/FloatingBackButton";
import { TinderView } from "@/features/inbox/components/TinderView";
import { useInboxReports } from "@/features/inbox/hooks/useInboxReports";
import { useDismissedReportsStore } from "@/features/inbox/stores/dismissedReportsStore";
import { useInboxStore } from "@/features/inbox/stores/inboxStore";
import { useIntegrations } from "@/features/tasks/hooks/useIntegrations";
import { useThemeColors } from "@/lib/theme";

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const dismissedIds = useDismissedReportsStore((s) => s.dismissedIds);
  const setCurrentIndex = useInboxStore((s) => s.setCurrentIndex);
  const { repositoryOptions } = useIntegrations();

  const { reports, isLoading } = useInboxReports();

  const tinderReports = useMemo(
    () =>
      reports.filter(
        (r) => r.is_suggested_reviewer && !dismissedIds.includes(r.id),
      ),
    [reports, dismissedIds],
  );

  // Reset card index each time the review screen mounts
  useEffect(() => {
    setCurrentIndex(0);
  }, [setCurrentIndex]);

  const handleTaskStarted = useCallback(
    (taskId: string) => {
      router.push(`/task/${taskId}`);
    },
    [router],
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <FloatingBackButton />
        <ActivityIndicator size="large" color={themeColors.accent[9]} />
        <Text className="mt-4 text-gray-11">Loading reports...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <FloatingBackButton />
      <View style={{ paddingTop: insets.top + 56 }} className="flex-1">
        <TinderView
          reports={tinderReports}
          repositoryOptions={repositoryOptions}
          onTaskStarted={handleTaskStarted}
        />
      </View>
    </View>
  );
}
