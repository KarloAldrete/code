import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { CaretDown, CaretUp } from "phosphor-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  type LayoutChangeEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import { formatRelativeTime } from "@/lib/format";
import { toRgba, useThemeColors } from "@/lib/theme";
import { MarkdownText } from "./MarkdownText";

interface HumanMessageProps {
  content: string;
  timestamp?: number;
}

const COLLAPSED_MAX_HEIGHT = 160;

export function HumanMessage({ content, timestamp }: HumanMessageProps) {
  const themeColors = useThemeColors();
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  const isOverflowing =
    contentHeight !== null && contentHeight > COLLAPSED_MAX_HEIGHT;
  const collapse = isOverflowing && !isExpanded;

  const handleLongPress = useCallback(() => {
    Clipboard.setStringAsync(content).then(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Copied", "Message copied to clipboard.");
    });
  }, [content]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContentHeight(e.nativeEvent.layout.height);
  }, []);

  return (
    <View className="px-4 py-2">
      <Pressable onLongPress={handleLongPress} delayLongPress={400}>
        <View
          className="mt-3 border-l-2 bg-gray-2 py-2 pr-3 pl-3"
          style={{ borderColor: themeColors.accent[9] }}
        >
          <View
            style={{
              maxHeight: collapse ? COLLAPSED_MAX_HEIGHT : undefined,
              overflow: "hidden",
            }}
          >
            <View onLayout={handleLayout}>
              <MarkdownText content={content} />
            </View>
            {collapse && (
              <LinearGradient
                pointerEvents="none"
                colors={[
                  toRgba(themeColors.gray[2], 0),
                  toRgba(themeColors.gray[2], 1),
                ]}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 48,
                }}
              />
            )}
          </View>
          {isOverflowing && (
            <Pressable
              onPress={() => setIsExpanded((v) => !v)}
              hitSlop={6}
              className="mt-1 flex-row items-center gap-1 self-start"
            >
              {isExpanded ? (
                <CaretUp size={12} color={themeColors.accent[11]} />
              ) : (
                <CaretDown size={12} color={themeColors.accent[11]} />
              )}
              <Text className="text-[12px] text-accent-11">
                {isExpanded ? "Show less" : "Show more"}
              </Text>
            </Pressable>
          )}
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
