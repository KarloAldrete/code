import type { TaskRunStatus } from "@shared/types";
import { InitializingSplash } from "./InitializingSplash";

interface CloudInitializingViewProps {
  cloudStatus: TaskRunStatus | null;
}

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
}: CloudInitializingViewProps) {
  const { heading, subtitle } = copyFor(cloudStatus);
  return <InitializingSplash heading={heading} subtitle={subtitle} />;
}
