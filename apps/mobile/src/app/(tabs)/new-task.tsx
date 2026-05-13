import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { InteractionManager } from "react-native";

export default function NewTaskTrampoline() {
  useFocusEffect(
    useCallback(() => {
      // Wait for any in-flight transitions (e.g. a previous modal's
      // dismiss animation) to finish before pushing /task, so rapid
      // re-taps don't race the navigator.
      const handle = InteractionManager.runAfterInteractions(() => {
        router.replace("/tasks");
        router.push("/task");
      });
      return () => handle.cancel();
    }, []),
  );
  return null;
}
