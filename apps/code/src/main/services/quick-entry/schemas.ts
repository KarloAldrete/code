export const QuickEntryServiceEvent = {
  FocusInput: "focus-input",
  Hide: "hide",
} as const;

export interface QuickEntryServiceEvents {
  [QuickEntryServiceEvent.FocusInput]: true;
  [QuickEntryServiceEvent.Hide]: true;
}

export interface RecentRepoEntry {
  id: string;
  path: string;
  name: string;
  remoteUrl: string | null;
}
