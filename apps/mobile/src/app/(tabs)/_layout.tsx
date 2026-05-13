import { Stack } from "expo-router";
import { View } from "react-native";
import { NavDrawer } from "@/features/navigation/components/NavDrawer";
import { useThemeColors } from "@/lib/theme";

export default function TabsLayout() {
  const themeColors = useThemeColors();

  return (
    <View className="flex-1 bg-background">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: themeColors.background },
        }}
      >
        <Stack.Screen name="tasks" />
        <Stack.Screen name="inbox" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="index" />
      </Stack>
      <NavDrawer />
    </View>
  );
}
