import { Text } from "@components/text";
import { Stack, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  ArrowUp,
  BrainIcon,
  CaretDown,
  GithubLogo,
  PaperclipIcon,
  PauseIcon,
  PencilIcon,
  Robot,
  ShieldCheck,
} from "phosphor-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import {
  useKeyboardHandler,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import Animated, { runOnJS, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/features/auth";
import {
  createTask,
  getGithubRepositories,
  getIntegrations,
  type Integration,
  runTaskInCloud,
} from "@/features/tasks";
import { DotBackground } from "@/features/tasks/composer/DotBackground";
import {
  DEFAULT_EXECUTION_MODE,
  DEFAULT_MODEL,
  DEFAULT_REASONING,
  EXECUTION_MODES,
  type ExecutionMode,
  MODELS,
  modeLabel,
  modelLabel,
  modelSupportsReasoning,
  REASONING_LEVELS,
  type ReasoningEffort,
  reasoningLabel,
} from "@/features/tasks/composer/options";
import { Pill } from "@/features/tasks/composer/Pill";
import { RepositoryPickerSheet } from "@/features/tasks/composer/RepositoryPickerSheet";
import { SelectSheet } from "@/features/tasks/composer/SelectSheet";
import { logger } from "@/lib/logger";
import { useThemeColors } from "@/lib/theme";

const log = logger.scope("task-create");

// Pre-canned starter prompts shown above the composer when the input is empty.
// Mirrors Claude Code's "Suggestions" affordance for an empty new-task screen.
const SUGGESTIONS = [
  "Create or update my CLAUDE.md file",
  "Search for a TODO comment and fix it",
  "Recommend areas to improve our tests",
] as const;

interface ConnectGitHubPromptProps {
  onConnected?: () => void;
}

function ConnectGitHubPrompt({ onConnected }: ConnectGitHubPromptProps) {
  const { cloudRegion, projectId, getCloudUrlFromRegion } = useAuthStore();
  const themeColors = useThemeColors();

  const handleConnectGitHub = async () => {
    if (!cloudRegion || !projectId) return;
    const baseUrl = getCloudUrlFromRegion(cloudRegion);
    const authorizeUrl = `${baseUrl}/api/environments/${projectId}/integrations/authorize/?kind=github`;

    const result = await WebBrowser.openAuthSessionAsync(
      authorizeUrl,
      "posthog://github/callback",
    );

    if (
      result.type === "dismiss" ||
      result.type === "cancel" ||
      result.type === "success"
    ) {
      onConnected?.();
    }
  };

  return (
    <View className="m-4 rounded-xl border border-gray-6 bg-gray-2 p-4">
      <View className="mb-3 flex-row items-center gap-2">
        <GithubLogo size={20} color={themeColors.gray[12]} weight="fill" />
        <Text className="font-semibold text-[15px] text-gray-12">
          Connect GitHub to continue
        </Text>
      </View>
      <Text className="mb-4 text-[13px] text-gray-11">
        You need to connect your GitHub account before creating tasks. This
        allows PostHog to work on your repositories.
      </Text>
      <Pressable
        onPress={handleConnectGitHub}
        className="items-center rounded-md bg-accent-9 py-3 active:opacity-80"
      >
        <Text className="font-semibold text-[14px] text-accent-contrast">
          Connect GitHub
        </Text>
      </Pressable>
    </View>
  );
}

function modeIcon(mode: ExecutionMode, color: string, size = 14) {
  switch (mode) {
    case "plan":
      return <PauseIcon size={size} color={color} weight="bold" />;
    case "default":
      return <PencilIcon size={size} color={color} />;
    case "acceptEdits":
      return <ShieldCheck size={size} color={color} />;
  }
}

export default function NewTaskScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const keyboard = useReanimatedKeyboardAnimation();
  const restingBottom = insets.bottom + 12;

  // Compress the layout from the bottom as the keyboard rises: paddingBottom
  // interpolates from `restingBottom` (clear the home indicator) to the
  // keyboard's height (flush against the keyboard top, no gap). Smooth because
  // we blend the two via the keyboard's progress value.
  const containerStyle = useAnimatedStyle(() => {
    const kbHeight = -keyboard.height.value;
    const progress = keyboard.progress.value;
    return {
      paddingBottom: kbHeight + restingBottom * (1 - progress),
    };
  });

  // Fade suggestions out as the keyboard appears so they don't clip the top of
  // the now-smaller middle area.
  const suggestionsStyle = useAnimatedStyle(() => ({
    opacity: 1 - keyboard.progress.value,
  }));

  // Track whether the keyboard is opening so we can disable touches on the
  // (now-fading) suggestions. `useKeyboardHandler.onStart` fires at the start
  // of the keyboard animation — synchronously with the opacity fade — so there
  // is no window where invisible cards are still tappable.
  const [keyboardActive, setKeyboardActive] = useState(false);
  useKeyboardHandler(
    {
      onStart: (e) => {
        "worklet";
        runOnJS(setKeyboardActive)(e.height > 0);
      },
    },
    [],
  );

  // Data
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [repositories, setRepositories] = useState<string[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);

  // Composer state
  const [prompt, setPrompt] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [mode, setMode] = useState<ExecutionMode>(DEFAULT_EXECUTION_MODE);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [reasoning, setReasoning] =
    useState<ReasoningEffort>(DEFAULT_REASONING);

  // Submit state
  const [creating, setCreating] = useState(false);

  // Sheet visibility
  const [repoSheetOpen, setRepoSheetOpen] = useState(false);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [reasoningSheetOpen, setReasoningSheetOpen] = useState(false);

  const loadIntegrations = useCallback(async () => {
    try {
      setLoadingRepos(true);
      const data = await getIntegrations();
      const githubIntegrations = data.filter((i) => i.kind === "github");
      setIntegrations(githubIntegrations);

      if (githubIntegrations.length > 0) {
        const allRepos: string[] = [];
        for (const integration of githubIntegrations) {
          const repos = await getGithubRepositories(integration.id);
          allRepos.push(...repos);
        }
        setRepositories(allRepos.sort());
      }
    } catch (error) {
      log.error("Failed to fetch integrations", error);
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  const handleCreateTask = useCallback(async () => {
    if (!prompt.trim() || !selectedRepo || creating) return;

    setCreating(true);
    try {
      const githubIntegration = integrations.find((i) => i.kind === "github");
      const trimmedPrompt = prompt.trim();

      const task = await createTask({
        description: trimmedPrompt,
        title: trimmedPrompt.slice(0, 100),
        repository: selectedRepo,
        github_integration: githubIntegration?.id,
      });

      const supportsReasoning = modelSupportsReasoning(model);

      await runTaskInCloud(task.id, {
        pendingUserMessage: trimmedPrompt,
        runtimeAdapter: "claude",
        model,
        reasoningEffort: supportsReasoning ? reasoning : undefined,
        initialPermissionMode: mode,
      });

      router.replace(`/task/${task.id}`);
    } catch (error) {
      log.error("Failed to create task", error);
    } finally {
      setCreating(false);
    }
  }, [
    prompt,
    selectedRepo,
    integrations,
    model,
    reasoning,
    mode,
    router,
    creating,
  ]);

  const hasGithubIntegration = integrations.length > 0;
  const canSubmit = !!prompt.trim() && !!selectedRepo && !creating;
  const showReasoningPill = modelSupportsReasoning(model);

  // Render the connect-github state at the top of an otherwise simple
  // screen — composer is hidden until a GitHub integration exists.
  if (!loadingRepos && !hasGithubIntegration) {
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
        <View className="flex-1 bg-background">
          <ConnectGitHubPrompt onConnected={loadIntegrations} />
        </View>
      </>
    );
  }

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
      <View className="flex-1 bg-background">
        <DotBackground />

        <Animated.View style={[{ flex: 1 }, containerStyle]}>
          {/* Suggestions — vertically centered above the composer. Fades out
              as the keyboard rises so they don't clip the top of the
              now-smaller middle area. */}
          <View className="flex-1 items-stretch justify-center px-3">
            {prompt.trim().length === 0 ? (
              <Animated.View
                style={suggestionsStyle}
                pointerEvents={keyboardActive ? "none" : "auto"}
              >
                <Text className="mb-3 px-1 text-[13px] text-gray-10">
                  Suggestions
                </Text>
                <View className="gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <Pressable
                      key={suggestion}
                      onPress={() => setPrompt(suggestion)}
                      className="rounded-2xl border border-gray-6 bg-card px-4 py-3 active:bg-gray-2"
                    >
                      <Text className="text-[14px] text-gray-12">
                        {suggestion}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            ) : null}
          </View>

          {/* Bottom composer block — repo pill above, composer card below.
              No own paddingBottom; the parent Animated.View provides it so
              the composer sits flush against the keyboard top when open. */}
          <View className="px-3">
            <View className="mb-2 flex-row">
              <Pressable
                onPress={() => setRepoSheetOpen(true)}
                className="flex-row items-center gap-2 rounded-full border border-gray-6 bg-card py-1.5 pr-2.5 pl-2 active:bg-gray-2"
              >
                <GithubLogo
                  size={16}
                  color={
                    selectedRepo ? themeColors.gray[12] : themeColors.gray[10]
                  }
                  weight={selectedRepo ? "fill" : "regular"}
                />
                <Text
                  className={`text-[13px] ${
                    selectedRepo ? "text-gray-12" : "text-gray-10"
                  }`}
                  numberOfLines={1}
                >
                  {selectedRepo ?? "Select repository…"}
                </Text>
                <CaretDown size={12} color={themeColors.gray[10]} />
              </Pressable>
            </View>

            <View className="overflow-hidden rounded-2xl border border-gray-6 bg-card">
              <TextInput
                className="px-4 pt-3.5 pb-3 text-[15px] text-gray-12"
                style={{ minHeight: 56, maxHeight: 200 }}
                placeholder="Describe what you want to build…"
                placeholderTextColor={themeColors.gray[9]}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                textAlignVertical="top"
              />

              <View className="flex-row items-center gap-2 px-2 pb-2">
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    /* attachments — coming soon */
                  }}
                  className="h-9 w-9 items-center justify-center"
                >
                  <PaperclipIcon size={18} color={themeColors.gray[10]} />
                </Pressable>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  className="flex-1"
                  contentContainerStyle={{
                    alignItems: "center",
                    gap: 6,
                    paddingRight: 4,
                  }}
                >
                  <Pill
                    icon={modeIcon(
                      mode,
                      mode === "plan"
                        ? themeColors.accent[11]
                        : themeColors.gray[11],
                    )}
                    label={modeLabel(mode)}
                    accent={mode === "plan"}
                    onPress={() => setModeSheetOpen(true)}
                  />

                  <Pill
                    icon={<Robot size={14} color={themeColors.gray[11]} />}
                    label={modelLabel(model)}
                    onPress={() => setModelSheetOpen(true)}
                  />

                  {showReasoningPill ? (
                    <Pill
                      icon={
                        <BrainIcon size={14} color={themeColors.gray[11]} />
                      }
                      label={reasoningLabel(reasoning)}
                      onPress={() => setReasoningSheetOpen(true)}
                    />
                  ) : null}
                </ScrollView>

                <Pressable
                  onPress={handleCreateTask}
                  disabled={!canSubmit}
                  className={`h-9 w-9 items-center justify-center rounded-lg ${
                    canSubmit ? "bg-gray-12" : "bg-gray-5"
                  }`}
                >
                  {creating ? (
                    <ActivityIndicator
                      size="small"
                      color={themeColors.background}
                    />
                  ) : (
                    <ArrowUp
                      size={18}
                      color={
                        canSubmit ? themeColors.background : themeColors.gray[9]
                      }
                      weight="bold"
                    />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Sheets */}
      <RepositoryPickerSheet
        open={repoSheetOpen}
        repositories={repositories}
        selected={selectedRepo}
        loading={loadingRepos}
        onChange={setSelectedRepo}
        onClose={() => setRepoSheetOpen(false)}
      />

      <SelectSheet
        open={modeSheetOpen}
        title="Execution mode"
        value={mode}
        onChange={(v) => setMode(v as ExecutionMode)}
        onClose={() => setModeSheetOpen(false)}
        options={EXECUTION_MODES.map((m) => ({
          value: m.value,
          label: m.label,
          description: m.description,
          icon: modeIcon(
            m.value,
            m.value === "plan" ? themeColors.accent[11] : themeColors.gray[11],
            16,
          ),
        }))}
      />

      <SelectSheet
        open={modelSheetOpen}
        title="Model"
        value={model}
        onChange={(v) => {
          setModel(v);
          // If the new model doesn't support reasoning, drop the level so the
          // payload stays consistent. Re-pick last value when switching back.
          if (!modelSupportsReasoning(v)) setReasoning(DEFAULT_REASONING);
        }}
        onClose={() => setModelSheetOpen(false)}
        options={MODELS.map((m) => ({
          value: m.value,
          label: m.label,
          description: m.description,
          icon: <Robot size={16} color={themeColors.gray[11]} />,
        }))}
      />

      <SelectSheet
        open={reasoningSheetOpen}
        title="Reasoning"
        value={reasoning}
        onChange={(v) => setReasoning(v as ReasoningEffort)}
        onClose={() => setReasoningSheetOpen(false)}
        options={REASONING_LEVELS.map((r) => ({
          value: r.value,
          label: r.label,
          icon: <BrainIcon size={16} color={themeColors.gray[11]} />,
        }))}
      />
    </>
  );
}
