import { InitializingSplash } from "./InitializingSplash";

interface LocalInitializingViewProps {
  isResuming: boolean;
}

export function LocalInitializingView({
  isResuming,
}: LocalInitializingViewProps) {
  const { heading, subtitle } = isResuming
    ? {
        heading: "Loading your conversation…",
        subtitle: "Reconnecting to your local agent.",
      }
    : {
        heading: "Getting things ready…",
        subtitle: "Spinning up your local agent.",
      };
  return <InitializingSplash heading={heading} subtitle={subtitle} />;
}
