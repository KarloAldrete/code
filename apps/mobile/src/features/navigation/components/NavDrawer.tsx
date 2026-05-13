import { Text } from "@components/text";
import { useRouter } from "expo-router";
import { GearSix, Plus, Tray } from "phosphor-react-native";
import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { useThemeColors } from "@/lib/theme";
import { useNavDrawerStore } from "../stores/navDrawerStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(320, Math.round(SCREEN_WIDTH * 0.85));

export function NavDrawer() {
  const isOpen = useNavDrawerStore((s) => s.isOpen);
  const close = useNavDrawerStore((s) => s.close);
  const router = useRouter();
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { tasks } = useTasks();

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: isOpen ? 0 : -DRAWER_WIDTH,
        duration: isOpen ? 240 : 200,
        easing: isOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: isOpen ? 1 : 0,
        duration: isOpen ? 240 : 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, translateX, backdropOpacity]);

  const handleNewTask = () => {
    close();
    router.push("/task");
  };

  const handleInbox = () => {
    close();
    router.replace("/inbox");
  };

  const handleSettings = () => {
    close();
    router.replace("/settings");
  };

  const handleTaskPress = (taskId: string) => {
    close();
    router.push(`/task/${taskId}`);
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View className="flex-1">
        <Animated.View
          className="absolute inset-0 bg-black/40"
          style={{ opacity: backdropOpacity }}
        >
          <Pressable className="flex-1" onPress={close} />
        </Animated.View>

        <Animated.View
          className="absolute top-0 bottom-0 left-0 border-gray-6 border-r bg-background"
          style={{
            width: DRAWER_WIDTH,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom,
            transform: [{ translateX }],
          }}
        >
          <Pressable
            onPress={() => {
              close();
              router.replace("/tasks");
            }}
            className="px-4 pb-3 active:opacity-60"
          >
            <Text className="font-bold text-2xl text-gray-12">PostHog</Text>
          </Pressable>

          <View className="gap-1 px-2 pb-2">
            <Pressable
              onPress={handleNewTask}
              className="flex-row items-center gap-3 rounded-lg px-3 py-3 active:bg-gray-3"
            >
              <Plus size={20} color={themeColors.gray[12]} weight="bold" />
              <Text className="font-medium text-base text-gray-12">
                New task
              </Text>
            </Pressable>

            <Pressable
              onPress={handleInbox}
              className="flex-row items-center gap-3 rounded-lg px-3 py-3 active:bg-gray-3"
            >
              <Tray size={20} color={themeColors.gray[12]} />
              <Text className="font-medium text-base text-gray-12">Inbox</Text>
            </Pressable>
          </View>

          <View className="mx-3 my-1 border-gray-6 border-t" />

          <View className="px-4 pt-3 pb-2">
            <Text className="font-medium text-gray-9 text-xs uppercase tracking-wide">
              Tasks
            </Text>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 12 }}
          >
            {tasks.length === 0 ? (
              <View className="px-4 py-3">
                <Text className="text-gray-9 text-sm">No tasks yet</Text>
              </View>
            ) : (
              tasks.map((task) => (
                <Pressable
                  key={task.id}
                  onPress={() => handleTaskPress(task.id)}
                  className="px-4 py-3 active:bg-gray-3"
                >
                  <Text
                    className="text-gray-12 text-sm"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {task.title}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>

          <View className="mx-3 mt-1 border-gray-6 border-t" />

          <View className="gap-1 px-2 pt-2">
            <Pressable
              onPress={handleSettings}
              className="flex-row items-center gap-3 rounded-lg px-3 py-3 active:bg-gray-3"
            >
              <GearSix size={20} color={themeColors.gray[12]} />
              <Text className="font-medium text-base text-gray-12">
                Settings
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
