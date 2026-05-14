import { getAuthenticatedClient } from "@features/auth/hooks/authClient";
import type {
  Hoglet,
  HogletWatchEvent,
} from "@main/services/hedgemony/schemas";
import { trpcClient } from "@renderer/trpc/client";
import { logger } from "@utils/logger";
import { HEDGEMONY_CONFIG } from "../config";
import { WILD_BUCKET } from "../constants/buckets";
import { useHogletPositionStore } from "../stores/hogletPositionStore";
import { useHogletStore } from "../stores/hogletStore";
import { wildHogletPosition } from "../utils/hogletPositions";
import { getHogletVisualPosition } from "../utils/hogletVisualPositions";

const log = logger.scope("hoglet-subscription-service");

const TASK_SUMMARY_REFRESH_MS = HEDGEMONY_CONFIG.polling.taskSummaryMs;

type WatchHandle = { unsubscribe: () => void };

function resolveHogletPosition(hogletId: string): { x: number; y: number } {
  // Prefer the live sprite position so death animations land where the hoglet
  // is actually rendered — the position store holds the walk *destination*,
  // which diverges from the visible sprite while a walk is in flight.
  const visual = getHogletVisualPosition(hogletId);
  if (visual) return visual;
  const override = useHogletPositionStore.getState().positions[hogletId];
  if (override) return override;
  return wildHogletPosition(hogletId);
}

function applyWatchEvent(bucket: string, event: HogletWatchEvent): void {
  const store = useHogletStore.getState();
  if (event.kind === "upsert") {
    store.upsert(bucket, event.hoglet);
  } else {
    const pos = resolveHogletPosition(event.hogletId);
    store.startDying(event.hogletId, pos.x, pos.y);
    store.remove(bucket, event.hogletId);
  }
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
  return initializeHogletBucket({
    bucket: WILD_BUCKET,
    subscribe: (handlers) =>
      trpcClient.hedgemony.hoglets.watch.subscribe({ kind: "wild" }, handlers),
    list: () => trpcClient.hedgemony.hoglets.list.query({ wildOnly: true }),
    logContext: { kind: "wild" },
  });
}

/**
 * Bootstraps a per-nest hoglet bucket. Mirrors initializeWildHogletStore but
 * scoped to a single nest; subscribes to nest-scoped watch events and seeds
 * the bucket from `hoglets.list({ nestId })`.
 */
export function initializeNestHogletStore(nestId: string): () => void {
  return initializeHogletBucket({
    bucket: nestId,
    subscribe: (handlers) =>
      trpcClient.hedgemony.hoglets.watch.subscribe(
        { kind: "nest", nestId },
        handlers,
      ),
    list: () => trpcClient.hedgemony.hoglets.list.query({ nestId }),
    logContext: { kind: "nest", nestId },
  });
}

interface InitializeHogletBucketOptions {
  bucket: string;
  subscribe: (handlers: {
    onData: (event: HogletWatchEvent) => void;
    onError: (error: unknown) => void;
  }) => WatchHandle;
  list: () => Promise<Hoglet[]>;
  logContext: Record<string, unknown>;
}

/**
 * Shared bootstrap that closes the watch-before-load race: incoming watch
 * events are buffered until the initial list resolves, then replayed against
 * the freshly-seeded bucket. Any subsequent event applies directly.
 */
function initializeHogletBucket(
  opts: InitializeHogletBucketOptions,
): () => void {
  let disposed = false;
  let initialLoaded = false;
  const buffered: HogletWatchEvent[] = [];
  acquireTaskSummaryPolling();

  const watch = opts.subscribe({
    onData: (event) => {
      if (disposed) return;
      if (!initialLoaded) {
        buffered.push(event);
        return;
      }
      applyWatchEvent(opts.bucket, event);
    },
    onError: (error) =>
      log.error("hoglet watch subscription error", {
        ...opts.logContext,
        error,
      }),
  });

  opts
    .list()
    .then((hoglets) => {
      if (disposed) return;
      useHogletStore.getState().setBucket(opts.bucket, hoglets);
      // Replay any events that arrived between subscribe and list-resolve so
      // upserts/deletions don't get clobbered by the initial seed.
      for (const event of buffered) applyWatchEvent(opts.bucket, event);
      buffered.length = 0;
      initialLoaded = true;
      pollAllSummaries();
    })
    .catch((error) =>
      log.error("Failed to load hoglets", { ...opts.logContext, error }),
    );

  return () => {
    if (disposed) return;
    disposed = true;
    watch.unsubscribe();
    releaseTaskSummaryPolling();
  };
}
