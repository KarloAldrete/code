import { Text } from "@components/text";
import { useRouter } from "expo-router";
import { FunnelSimple, UsersThree } from "phosphor-react-native";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FilterSheet } from "@/features/inbox/components/FilterSheet";
import { LiveDot } from "@/features/inbox/components/LiveDot";
import { ReportList } from "@/features/inbox/components/ReportList";
import { ReviewerFilterSheet } from "@/features/inbox/components/ReviewerFilterSheet";
import { useInboxReports } from "@/features/inbox/hooks/useInboxReports";
import { useInboxFilterStore } from "@/features/inbox/stores/inboxFilterStore";
import type { SignalReport } from "@/features/inbox/types";
import { MenuButton } from "@/features/navigation/components/MenuButton";
import { useThemeColors } from "@/lib/theme";

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const themeColors = useThemeColors();
  const { isFetching, error } = useInboxReports();
  const [filterOpen, setFilterOpen] = useState(false);
  const [reviewerOpen, setReviewerOpen] = useState(false);
  const reviewerFilterCount = useInboxFilterStore(
    (s) => s.suggestedReviewerFilter.length,
  );

  const handleReportPress = useCallback(
    (report: SignalReport) => {
      router.push(`/report/${report.id}`);
    },
    [router],
  );

  return (
    <View className="flex-1 bg-background">
      <View
        className="border-gray-6 border-b px-3 pb-4"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="flex-row items-center gap-2">
          <MenuButton />
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-semibold text-[22px] text-gray-12">
                Inbox
              </Text>
              <LiveDot active={isFetching} hasError={!!error} />
            </View>
            <Text className="text-[13px] text-gray-11">
              Signals and reports
            </Text>
          </View>
          <Pressable
            onPress={() => setReviewerOpen(true)}
            className={`h-9 flex-row items-center justify-center gap-1 rounded-md px-2 active:bg-gray-3 ${
              reviewerFilterCount > 0 ? "bg-gray-3" : ""
            }`}
          >
            <UsersThree
              size={20}
              color={
                reviewerFilterCount > 0
                  ? themeColors.gray[12]
                  : themeColors.gray[11]
              }
            />
            {reviewerFilterCount > 0 && (
              <Text className="font-medium text-[12px] text-gray-12">
                {reviewerFilterCount}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => setFilterOpen(true)}
            className="h-9 w-9 items-center justify-center rounded-md active:bg-gray-3"
          >
            <FunnelSimple size={20} color={themeColors.gray[11]} />
          </Pressable>
        </View>
      </View>

      <ReportList onReportPress={handleReportPress} />
      <FilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} />
      <ReviewerFilterSheet
        visible={reviewerOpen}
        onClose={() => setReviewerOpen(false)}
      />
    </View>
  );
}
