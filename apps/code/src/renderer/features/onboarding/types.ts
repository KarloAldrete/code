export type OnboardingStep =
  | "welcome"
  | "claude-auth-method"
  | "project-select"
  | "invite-code"
  | "github"
  | "install-cli"
  | "signals";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "welcome",
  "claude-auth-method",
  "project-select",
  "invite-code",
  "github",
  "install-cli",
  "signals",
];
