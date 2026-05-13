import { Text } from "@components/text";
import { Tray } from "phosphor-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MenuButton } from "@/features/navigation/components/MenuButton";
import { useThemeColors } from "@/lib/theme";

export default function InboxScreen() {
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <View
        className="border-gray-6 border-b px-3 pb-4"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="flex-row items-center gap-2">
          <MenuButton />
          <View className="flex-1">
            <Text className="font-bold text-2xl text-gray-12">Inbox</Text>
            <Text className="text-gray-11 text-sm">
              Signals and notifications
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-1 items-center justify-center p-6">
        <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-gray-3">
          <Tray size={28} color={themeColors.gray[9]} />
        </View>
        <Text className="mb-2 text-center font-semibold text-gray-12 text-lg">
          Inbox coming soon
        </Text>
        <Text className="text-center text-gray-11 text-sm">
          Signals and notifications will show up here.
        </Text>
      </View>
    </View>
  );
}
