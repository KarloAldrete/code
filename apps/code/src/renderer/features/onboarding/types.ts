export type OnboardingStep =
  | "welcome"
  | "claude-auth-method"
  | "project-select"
  | "invite-code"
  | "connect-github"
  | "install-cli"
  | "select-repo";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "welcome",
  "claude-auth-method",
  "project-select",
  "invite-code",
  "connect-github",
  "install-cli",
  "select-repo",
];
