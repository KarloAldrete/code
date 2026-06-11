import { Spinner } from "@phosphor-icons/react";
import type { TaskRunStatus } from "@posthog/shared/domain-types";
import { Button, Flex, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import zenHedgehog from "../../../assets/images/zen.png";

interface CloudInitializingViewProps {
  cloudStatus: TaskRunStatus | null;
  /** Cancels the provisioning cloud run. When omitted, no cancel control is shown. */
  onCancel?: () => void;
}

const REVEAL_DELAY_MS = 2000;

function copyFor(cloudStatus: TaskRunStatus | null): {
  heading: string;
  subtitle: string;
} {
  switch (cloudStatus) {
    case "queued":
      return {
        heading: "Waiting in the queue…",
        subtitle: "Reserving a cloud sandbox — this can take a few seconds.",
      };
    case "in_progress":
      return {
        heading: "Starting the sandbox…",
        subtitle: "Connecting to your cloud runner.",
      };
    default:
      return {
        heading: "Getting things ready…",
        subtitle: "Connecting to your cloud runner.",
      };
  }
}

export function CloudInitializingView({
  cloudStatus,
  onCancel,
}: CloudInitializingViewProps) {
  const { heading, subtitle } = copyFor(cloudStatus);

  const [revealed, setRevealed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleCancel = () => {
    if (cancelling) return;
    setCancelling(true);
    onCancel?.();
  };

  if (!revealed) {
    return (
      <Flex
        align="center"
        justify="center"
        className="absolute inset-0 bg-background"
      >
        <Spinner size={32} className="animate-spin text-gray-9" />
      </Flex>
    );
  }

  return (
    <Flex
      align="center"
      justify="center"
      direction="column"
      gap="5"
      className="absolute inset-0 bg-background"
    >
      <div className="zen-float">
        <img src={zenHedgehog} alt="" className="block w-[160px]" />
      </div>
      <Flex direction="column" align="center" gap="2">
        <Flex align="center" gap="2">
          <Spinner size={16} className="animate-spin text-gray-9" />
          <Text className="font-medium text-base">{heading}</Text>
        </Flex>
        <Text color="gray" className="text-sm">
          {subtitle}
        </Text>
      </Flex>
      {onCancel && (
        <Button
          variant="soft"
          color="gray"
          size="2"
          onClick={handleCancel}
          disabled={cancelling}
        >
          {cancelling ? "Cancelling…" : "Cancel"}
        </Button>
      )}
    </Flex>
  );
}
