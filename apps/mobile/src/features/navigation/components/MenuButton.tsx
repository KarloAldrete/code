import { List } from "phosphor-react-native";
import { Pressable } from "react-native";
import { useThemeColors } from "@/lib/theme";
import { useNavDrawerStore } from "../stores/navDrawerStore";

interface MenuButtonProps {
  className?: string;
}

export function MenuButton({ className }: MenuButtonProps) {
  const open = useNavDrawerStore((s) => s.open);
  const themeColors = useThemeColors();

  return (
    <Pressable
      onPress={open}
      hitSlop={12}
      className={`h-10 w-10 items-center justify-center rounded-lg active:bg-gray-3 ${className ?? ""}`}
      accessibilityLabel="Open navigation menu"
      accessibilityRole="button"
    >
      <List size={24} color={themeColors.gray[12]} />
    </Pressable>
  );
}
