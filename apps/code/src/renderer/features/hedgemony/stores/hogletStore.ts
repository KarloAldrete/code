import { getAuthenticatedClient } from "@features/auth/hooks/authClient";
import type {
  Hoglet,
  HogletWatchEvent,
} from "@main/services/hedgemony/schemas";
import type { Schemas } from "@renderer/api/generated";
import { trpcClient } from "@renderer/trpc/client";
import { logger } from "@utils/logger";
import { create } from "zustand";

const log = logger.scope("hoglet-store");

export const WILD_BUCKET = "wild";
export const SIGNAL_STAGING_BUCKET = "signal_staging";

const TASK_SUMMARY_REFRESH_MS = 10_000;

interface HogletStoreState {
  byBucket: Record<string, Hoglet[]>;
  taskSummaries: Record<string, Schemas.TaskSummary>;
  loaded: Record<string, boolean>;
}

interface HogletStoreActions {
  setBucket: (bucket: string, hoglets: Hoglet[]) => void;
  upsert: (bucket: string, hoglet: Hoglet) => void;
  remove: (bucket: string, hogletId: string) => void;
  setTaskSummaries: (summaries: Schemas.TaskSummary[]) => void;
  reset: () => void;
}

type HogletStore = HogletStoreState & HogletStoreActions;

const initialState: HogletStoreState = {
  byBucket: {},
  taskSummaries: {},
  loaded: {},
};

export const useHogletStore = create<HogletStore>()((set) => ({
  ...initialState,

  setBucket: (bucket, hoglets) =>
    set((state) => ({
      byBucket: { ...state.byBucket, [bucket]: hoglets },
      loaded: { ...state.loaded, [bucket]: true },
    })),

  upsert: (bucket, hoglet) =>
    set((state) => {
      const current = state.byBucket[bucket] ?? [];
      const without = current.filter((h) => h.id !== hoglet.id);
      return {
        byBucket: { ...state.byBucket, [bucket]: [...without, hoglet] },
      };
    }),

  remove: (bucket, hogletId) =>
    set((state) => {
      const current = state.byBucket[bucket];
      if (!current) return state;
      return {
        byBucket: {
          ...state.byBucket,
          [bucket]: current.filter((h) => h.id !== hogletId),
        },
      };
    }),

  setTaskSummaries: (summaries) =>
    set((state) => {
      const next = { ...state.taskSummaries };
      for (const s of summaries) next[s.id] = s;
      return { taskSummaries: next };
    }),

  reset: () => set(initialState),
}));

export const selectWildHoglets = (state: HogletStore): Hoglet[] =>
  state.byBucket[WILD_BUCKET] ?? [];

export const selectWildLoaded = (state: HogletStore): boolean =>
  state.loaded[WILD_BUCKET] ?? false;

export const selectSignalStagingHoglets = (state: HogletStore): Hoglet[] =>
  state.byBucket[SIGNAL_STAGING_BUCKET] ?? [];

export const selectSignalStagingLoaded = (state: HogletStore): boolean =>
  state.loaded[SIGNAL_STAGING_BUCKET] ?? false;

export const selectNestHoglets =
  (nestId: string) =>
  (state: HogletStore): Hoglet[] =>
    state.byBucket[nestId] ?? [];

export const selectNestHogletsLoaded =
  (nestId: string) =>
  (state: HogletStore): boolean =>
    state.loaded[nestId] ?? false;

export const selectTaskSummary =
  (taskId: string) =>
  (state: HogletStore): Schemas.TaskSummary | null =>
    state.taskSummaries[taskId] ?? null;

type WatchHandle = { unsubscribe: () => void };

function applyWatchEvent(bucket: string, event: HogletWatchEvent): void {
  const store = useHogletStore.getState();
  if (event.kind === "upsert") store.upsert(bucket, event.hoglet);
  else store.remove(bucket, event.hogletId);
}

async function refreshTaskSummaries(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  const client = await getAuthenticatedClient();
  if (!client) return;
  try {
    const summaries = await client.getTaskSummaries(taskIds);
    useHogletStore.getState().setTaskSummaries(summaries);
  } catch (error) {
    log.error("Failed to fetch task summaries", { error });
  }
}

/**
 * Refcounted shared poll loop that walks every bucket in the store and
 * refreshes task summaries in one batched call. Each bucket initializer
 * acquires on start and releases on dispose; the interval clears when the
 * refcount returns to zero.
 */
let pollHandle: ReturnType<typeof setInterval> | null = null;
let pollRefCount = 0;

function pollAllSummaries(): void {
  const { byBucket } = useHogletStore.getState();
  const taskIds = new Set<string>();
  for (const bucket of Object.values(byBucket)) {
    for (const h of bucket) taskIds.add(h.taskId);
  }
  if (taskIds.size === 0) return;
  void refreshTaskSummaries([...taskIds]);
}

function acquireTaskSummaryPolling(): void {
  pollRefCount += 1;
  if (pollRefCount === 1 && !pollHandle) {
    pollHandle = setInterval(pollAllSummaries, TASK_SUMMARY_REFRESH_MS);
  }
}

function releaseTaskSummaryPolling(): void {
  pollRefCount = Math.max(0, pollRefCount - 1);
  if (pollRefCount === 0 && pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}

/**
 * Bootstraps the wild hoglet bucket: fetches the current list, opens a watch
 * subscription, and registers with the shared task-summary poll. Returns a
 * disposer that tears everything down.
 */
export function initializeWildHogletStore(): () => void {
  let disposed = false;
  acquireTaskSummaryPolling();

  const watch: WatchHandle = trpcClient.hedgemony.hoglets.watch.subscribe(
    { kind: "wild" },
    {
      onData: (event) => applyWatchEvent(WILD_BUCKET, event),
      onError: (error) =>
        log.error("wild hoglet watch subscription error", { error }),
    },
  );

  trpcClient.hedgemony.hoglets.list
    .query({ wildOnly: true })
    .then((hoglets) => {
      if (disposed) return;
      useHogletStore.getState().setBucket(WILD_BUCKET, hoglets);
      pollAllSummaries();
    })
    .catch((error) => log.error("Failed to load wild hoglets", { error }));

  return () => {
    if (disposed) return;
    disposed = true;
    watch.unsubscribe();
    releaseTaskSummaryPolling();
  };
}

/**
 * Bootstraps the signal-staging hoglet bucket: Inbox-backed signal hoglets
 * with `nest_id = null` and `signal_report_id` set. Mirrors
 * initializeWildHogletStore but scoped to the signal-staging bucket so the
 * holding panel can render them as a separate section.
 */
export function initializeSignalStagingHogletStore(): () => void {
  let disposed = false;
  acquireTaskSummaryPolling();

  const watch: WatchHandle = trpcClient.hedgemony.hoglets.watch.subscribe(
    { kind: "signal_staging" },
    {
      onData: (event) => applyWatchEvent(SIGNAL_STAGING_BUCKET, event),
      onError: (error) =>
        log.error("signal_staging hoglet watch subscription error", { error }),
    },
  );

  trpcClient.hedgemony.hoglets.list
    .query({ signalStagingOnly: true })
    .then((hoglets) => {
      if (disposed) return;
      useHogletStore.getState().setBucket(SIGNAL_STAGING_BUCKET, hoglets);
      pollAllSummaries();
    })
    .catch((error) =>
      log.error("Failed to load signal-staging hoglets", { error }),
    );

  return () => {
    if (disposed) return;
    disposed = true;
    watch.unsubscribe();
    releaseTaskSummaryPolling();
  };
}

/**
 * Bootstraps a per-nest hoglet bucket. Mirrors initializeWildHogletStore but
 * scoped to a single nest; subscribes to nest-scoped watch events and seeds
 * the bucket from `hoglets.list({ nestId })`.
 */
export function initializeNestHogletStore(nestId: string): () => void {
  let disposed = false;
  acquireTaskSummaryPolling();

  const watch: WatchHandle = trpcClient.hedgemony.hoglets.watch.subscribe(
    { kind: "nest", nestId },
    {
      onData: (event) => applyWatchEvent(nestId, event),
      onError: (error) =>
        log.error("nest hoglet watch subscription error", { nestId, error }),
    },
  );

  trpcClient.hedgemony.hoglets.list
    .query({ nestId })
    .then((hoglets) => {
      if (disposed) return;
      useHogletStore.getState().setBucket(nestId, hoglets);
      pollAllSummaries();
    })
    .catch((error) =>
      log.error("Failed to load nest hoglets", { nestId, error }),
    );

  return () => {
    if (disposed) return;
    disposed = true;
    watch.unsubscribe();
    releaseTaskSummaryPolling();
  };
}
