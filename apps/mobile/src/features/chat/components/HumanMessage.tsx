import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { formatRelativeTime } from "@/lib/format";
import { useThemeColors } from "@/lib/theme";
import { MarkdownText } from "./MarkdownText";

interface HumanMessageProps {
  content: string;
  timestamp?: number;
}

export function HumanMessage({ content, timestamp }: HumanMessageProps) {
  const themeColors = useThemeColors();

  const handleLongPress = useCallback(() => {
    Clipboard.setStringAsync(content).then(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Copied", "Message copied to clipboard.");
    });
  }, [content]);

  return (
    <View className="px-4 py-2">
      <Pressable onLongPress={handleLongPress} delayLongPress={400}>
        <View
          className="mt-3 border-l-2 bg-gray-2 py-2 pr-3 pl-3"
          style={{ borderColor: themeColors.accent[9] }}
        >
          <MarkdownText content={content} />
        </View>
      </Pressable>
      {timestamp && (
        <Text className="mt-1 px-1 font-mono text-[10px] text-gray-8">
          {formatRelativeTime(timestamp)}
        </Text>
      )}
    </View>
  );
}
