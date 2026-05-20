import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";
import { Button, Flex, Text } from "@radix-ui/themes";
import { useTRPC } from "@renderer/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { StepActions } from "./StepActions";

type AuthChoice = "posthog" | "subscription";

interface ClaudeAuthMethodStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function ClaudeAuthMethodStep({
  onNext,
  onBack,
}: ClaudeAuthMethodStepProps) {
  const trpcReact = useTRPC();
  const queryClient = useQueryClient();
  const { data: currentEnabled } = useQuery(
    trpcReact.claudeSubscription.getEnabled.queryOptions(),
  );
  const { data: status, refetch: refetchStatus } = useQuery(
    trpcReact.claudeSubscription.getStatus.queryOptions(),
  );
  const setEnabledMutation = useMutation(
    trpcReact.claudeSubscription.setEnabled.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpcReact.claudeSubscription.getEnabled.queryKey(),
        });
      },
    }),
  );

  const [choice, setChoice] = useState<AuthChoice>(
    currentEnabled ? "subscription" : "posthog",
  );
  const isSignedIn = status?.signedIn ?? false;

  const handleContinue = async () => {
    if (choice === "subscription" && !isSignedIn) {
      await refetchStatus();
      return;
    }
    await setEnabledMutation.mutateAsync({
      enabled: choice === "subscription",
    });
    onNext();
  };

  const blockedBySignIn = choice === "subscription" && !isSignedIn;

  return (
    <Flex align="center" height="100%" px="8">
      <Flex
        direction="column"
        align="center"
        className="h-full w-full pt-[24px] pb-[40px]"
      >
        <Flex
          direction="column"
          className="min-h-0 w-full flex-1 overflow-y-auto"
        >
          <Flex
            direction="column"
            gap="5"
            style={{ margin: "auto auto" }}
            className="w-full max-w-[720px] px-0 py-[16px]"
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Flex direction="column" gap="3">
                <Text className="font-bold text-(--gray-12) text-2xl">
                  How should we power Claude?
                </Text>
                <Text className="text-(--gray-11) text-sm">
                  Choose whether to use PostHog's managed Claude access or your
                  own Claude subscription. You can change this later in
                  Settings.
                </Text>
              </Flex>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
            >
              <Flex gap="3">
                <AuthChoiceCard
                  title="PostHog credits"
                  description="Use your PostHog plan to power Claude. Easiest setup; usage counts against your PostHog plan."
                  selected={choice === "posthog"}
                  onSelect={() => setChoice("posthog")}
                  recommended
                />
                <AuthChoiceCard
                  title="My Claude subscription"
                  description="Use your existing Claude Max or Pro subscription. Bypasses PostHog billing for LLM calls."
                  selected={choice === "subscription"}
                  onSelect={() => setChoice("subscription")}
                />
              </Flex>
            </motion.div>

            {choice === "subscription" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Flex
                  direction="column"
                  gap="2"
                  p="4"
                  className="rounded-(--radius-3) border border-(--gray-5)"
                >
                  {isSignedIn ? (
                    <Text className="text-sm">
                      Signed in to Claude
                      {status?.accountEmail ? ` as ${status.accountEmail}` : ""}
                      .
                    </Text>
                  ) : (
                    <>
                      <Text className="font-medium text-sm">
                        Sign in to Claude
                      </Text>
                      <Text color="gray" className="text-[13px]">
                        Run the following in your terminal, then click Refresh:
                      </Text>
                      <Text className="rounded-(--radius-2) bg-(--gray-3) p-2 font-mono text-[12px]">
                        claude auth login
                      </Text>
                      <Button
                        size="1"
                        variant="outline"
                        onClick={() => {
                          void refetchStatus();
                        }}
                        className="self-start"
                      >
                        Refresh
                      </Button>
                    </>
                  )}
                </Flex>
              </motion.div>
            )}
          </Flex>
        </Flex>

        <StepActions delay={0.25}>
          <Button size="3" variant="outline" color="gray" onClick={onBack}>
            <ArrowLeft size={16} weight="bold" />
            Back
          </Button>
          <Button
            size="3"
            onClick={() => void handleContinue()}
            disabled={blockedBySignIn}
          >
            Continue
            <ArrowRight size={16} weight="bold" />
          </Button>
        </StepActions>
      </Flex>
    </Flex>
  );
}

interface AuthChoiceCardProps {
  title: string;
  description: string;
  selected: boolean;
  recommended?: boolean;
  onSelect: () => void;
}

function AuthChoiceCard({
  title,
  description,
  selected,
  recommended,
  onSelect,
}: AuthChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex-1 cursor-pointer rounded-(--radius-3) border p-4 text-left ${
        selected
          ? "border-(--accent-7) bg-(--accent-2)"
          : "border-(--gray-5) bg-transparent"
      }`}
    >
      <Flex direction="column" gap="2">
        <Flex align="center" justify="between">
          <Text className="font-medium text-(--gray-12) text-sm">{title}</Text>
          {selected && (
            <Check size={16} weight="bold" className="text-(--accent-9)" />
          )}
        </Flex>
        {recommended && (
          <Text
            className="font-medium text-(--accent-9) text-[11px]"
            style={{ letterSpacing: "0.05em" }}
          >
            RECOMMENDED
          </Text>
        )}
        <Text className="text-(--gray-11) text-[13px]">{description}</Text>
      </Flex>
    </button>
  );
}
