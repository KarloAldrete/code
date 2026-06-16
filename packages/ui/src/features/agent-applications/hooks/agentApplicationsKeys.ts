export const agentApplicationsKeys = {
  list: (projectId: number | null) =>
    ["agent-applications", "list", projectId] as const,
  detail: (projectId: number | null, idOrSlug: string) =>
    ["agent-applications", "detail", projectId, idOrSlug] as const,
  stats: (projectId: number | null, idOrSlug: string) =>
    ["agent-applications", "stats", projectId, idOrSlug] as const,
  sessions: (projectId: number | null, idOrSlug: string) =>
    ["agent-applications", "sessions", projectId, idOrSlug] as const,
  session: (projectId: number | null, idOrSlug: string, sessionId: string) =>
    ["agent-applications", "session", projectId, idOrSlug, sessionId] as const,
  sessionLogs: (
    projectId: number | null,
    idOrSlug: string,
    sessionId: string,
  ) =>
    [
      "agent-applications",
      "session-logs",
      projectId,
      idOrSlug,
      sessionId,
    ] as const,
  approvals: (projectId: number | null, idOrSlug: string, state?: string) =>
    [
      "agent-applications",
      "approvals",
      projectId,
      idOrSlug,
      state ?? "all",
    ] as const,
  revisions: (projectId: number | null, idOrSlug: string) =>
    ["agent-applications", "revisions", projectId, idOrSlug] as const,
  revision: (projectId: number | null, idOrSlug: string, revisionId: string) =>
    [
      "agent-applications",
      "revision",
      projectId,
      idOrSlug,
      revisionId,
    ] as const,
  bundle: (projectId: number | null, idOrSlug: string, revisionId: string) =>
    ["agent-applications", "bundle", projectId, idOrSlug, revisionId] as const,
  envKeys: (projectId: number | null, idOrSlug: string) =>
    ["agent-applications", "env-keys", projectId, idOrSlug] as const,
  fleetStats: (projectId: number | null) =>
    ["agent-applications", "fleet", "stats", projectId] as const,
  fleetLiveSessions: (projectId: number | null) =>
    ["agent-applications", "fleet", "live-sessions", projectId] as const,
};
