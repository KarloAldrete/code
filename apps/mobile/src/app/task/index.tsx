import { Text } from "@components/text";
import { Stack, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { createTask, runTaskInCloud } from "@/features/tasks/api";
import { GitHubConnectionPrompt } from "@/features/tasks/components/GitHubConnectionPrompt";
import { GitHubLoadNotice } from "@/features/tasks/components/GitHubLoadNotice";
import { RepositorySelector } from "@/features/tasks/components/RepositorySelector";
import { useIntegrations } from "@/features/tasks/hooks/useIntegrations";
import { logger } from "@/lib/logger";
import { useThemeColors } from "@/lib/theme";

const log = logger.scope("task-create");

export default function NewTaskScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const {
    error,
    hasGithubIntegration,
    repositoryOptions,
    repositoryWarning,
    isLoading,
    refetch,
  } = useIntegrations();
  const [selection, setSelection] = useState<{
    integrationId: number | null;
    repository: string | null;
  }>({
    integrationId: null,
    repository: null,
  });
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateTask = useCallback(async () => {
    if (!prompt.trim() || !selection.integrationId || !selection.repository) {
      return;
    }

    setCreating(true);

    try {
      const trimmedPrompt = prompt.trim();
      const task = await createTask({
        description: trimmedPrompt,
        title: trimmedPrompt.slice(0, 100),
        repository: selection.repository,
        github_integration: selection.integrationId,
      });

      await runTaskInCloud(task.id, {
        pendingUserMessage: trimmedPrompt,
      });

      router.replace(`/task/${task.id}`);
    } catch (error) {
      log.error("Failed to create task", error);
    } finally {
      setCreating(false);
    }
  }, [prompt, router, selection]);

  const canSubmit =
    !!prompt.trim() &&
    !!selection.integrationId &&
    !!selection.repository &&
    !creating;
  const repositoryLoadBlocked =
    !!repositoryWarning && repositoryOptions.length === 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "New task",
          headerStyle: { backgroundColor: themeColors.background },
          headerTintColor: themeColors.gray[12],
          presentation: "modal",
        }}
      />
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          className="flex-1 px-3 pt-4"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <Pressable onPress={Keyboard.dismiss} accessible={false}>
            {isLoading && hasGithubIntegration === null ? (
              <View className="mb-4 items-center rounded-lg border border-gray-6 p-4">
                <ActivityIndicator size="small" color={themeColors.accent[9]} />
                <Text className="mt-2 text-gray-11 text-sm">
                  Loading repositories...
                </Text>
              </View>
            ) : error || repositoryLoadBlocked ? (
              <GitHubLoadNotice
                message={
                  error ??
                  repositoryWarning ??
                  "Could not load GitHub repositories."
                }
                onRetry={refetch}
              />
            ) : hasGithubIntegration === false ? (
              <GitHubConnectionPrompt
                onConnected={refetch}
                title="Connect GitHub to continue"
                description="You need to connect your GitHub account before creating tasks. This allows PostHog to work on your repositories."
              />
            ) : (
              <>
                {repositoryWarning && (
                  <GitHubLoadNotice
                    message={repositoryWarning}
                    onRetry={refetch}
                    tone="warning"
                  />
                )}
                <Text className="mb-2 text-gray-9 text-xs">Repository</Text>
                <RepositorySelector
                  options={repositoryOptions}
                  value={selection}
                  onChange={setSelection}
                />

                <Text className="mt-4 mb-2 text-gray-9 text-xs">
                  Task description
                </Text>
                <TextInput
                  className="mb-4 min-h-[100px] rounded-lg border border-gray-6 px-3 py-3 font-mono text-gray-12 text-sm"
                  placeholder="What would you like the agent to do?"
                  placeholderTextColor={themeColors.gray[9]}
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  textAlignVertical="top"
                />

                <Pressable
                  onPress={handleCreateTask}
                  disabled={!canSubmit}
                  className={`rounded-lg py-3 ${canSubmit ? "bg-accent-9" : "bg-gray-3"}`}
                >
                  {creating ? (
                    <ActivityIndicator
                      size="small"
                      color={themeColors.accent.contrast}
                    />
                  ) : (
                    <Text
                      className={`text-center font-medium ${
                        canSubmit ? "text-accent-contrast" : "text-gray-9"
                      }`}
                    >
                      Create task
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
