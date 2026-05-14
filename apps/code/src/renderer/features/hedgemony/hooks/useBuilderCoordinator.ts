import type { Nest } from "@main/services/hedgemony/schemas";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type BuilderAnimation,
  type BuilderSnapshot,
  BuilderStateMachine,
} from "../state/BuilderStateMachine";
import type { Obstacle, Vec2 } from "../utils/pathfinding";

export type { BuilderAnimation };

// Park the builder just south of the Hedgehouse. The previous attempt at
// (0, 130) was still broken: pathfinding inflates the Hedgehouse obstacle
// (raw radius 100) by the agent's pathfinding radius (36 for the builder)
// before testing intersections, giving an effective avoid-radius of 136.
// Any spawn at distance < 136 from origin is treated as "inside the
// obstacle" and triggers findPath's escape logic — which walks straight
// toward the goal until it clears the inflation. From (0, 130) heading
// north of the Hedgehouse, that escape cuts straight through the building.
// y=160 keeps the spawn comfortably outside the 136 inflation with a 24px
// buffer so any future radius tweak still leaves headroom.
const DEFAULT_INITIAL_POS: Vec2 = { x: 0, y: 160 };

export interface UseBuilderCoordinatorOptions {
  nests: Nest[];
  buildAnimationMs?: number;
  initialPos?: Vec2;
  /** Called when a pending build is committed — either because the build
   * animation finished, or because something interrupted it. The caller is
   * expected to make the nest visible (e.g. by upserting it into a store).
   * Without this callback the deferred-sprite feature is inert. */
  onPendingBuildCommit?: (nest: Nest) => void;
}

export interface BuilderCoordinator {
  /** Waypoint list the sprite walks through. */
  path: Vec2[];
  /** Nominal position (last reached waypoint). Use visualPosRef for actual
   * on-screen position. */
  pos: Vec2;
  animation: BuilderAnimation;
  /** The nest queued by `startWalk(..., "build", nest)` — not yet committed
   * to the nest store, but the location is known. Surfaces use it to render
   * a construction-in-progress visual at the destination so the nest doesn't
   * pop into existence with no warning. */
  pendingNest: Nest | null;
  /** Written each motion frame by BuilderSprite. Read as the start of any
   * re-plan so the new path begins where the sprite visually is. */
  visualPosRef: MutableRefObject<Vec2>;
  /** Plan a path to target and start the walk. Returns the resolved goal
   * (the goal may be snapped to an obstacle edge if the click was on a
   * nest). Pass `buildingFor` to defer the nest sprite until the build
   * animation completes: the location is treated as an obstacle for
   * pathfinding but isn't committed until then. */
  startWalk: (
    target: Vec2,
    onArrive: "idle" | "build",
    buildingFor?: Nest,
    extraObstacles?: Obstacle[],
  ) => Vec2;
  /** Called by BuilderSprite when it reaches the final waypoint. */
  handleArrive: () => void;
  /** Called by BuilderSprite each time a waypoint is reached. */
  handleSegmentComplete: (index: number) => void;
}

function deriveAnimation(snapshot: BuilderSnapshot): BuilderAnimation {
  switch (snapshot.state.kind) {
    case "walking":
      return "walking";
    case "building":
      return "building";
    default:
      return "idle";
  }
}

/**
 * Thin React adapter over BuilderStateMachine. Owns nothing of substance —
 * forwards calls to the machine, wires the machine's snapshot stream into
 * useState, and disposes the machine on unmount. The actual state logic
 * (transitions, build timer, pending-nest commit, obstacle-stranded heal)
 * lives in BuilderStateMachine and is testable without React.
 */
export function useBuilderCoordinator({
  nests,
  buildAnimationMs,
  initialPos = DEFAULT_INITIAL_POS,
  onPendingBuildCommit,
}: UseBuilderCoordinatorOptions): BuilderCoordinator {
  const visualPosRef = useRef<Vec2>({ ...initialPos });
  const onPendingBuildCommitRef = useRef(onPendingBuildCommit);
  onPendingBuildCommitRef.current = onPendingBuildCommit;

  // The machine is created once. React StrictMode double-invokes effects
  // but not lazy refs, so this initializer runs exactly once per mount.
  const machineRef = useRef<BuilderStateMachine | null>(null);
  const [snapshot, setSnapshot] = useState<BuilderSnapshot>(() => ({
    state: { kind: "idle" },
    path: [initialPos],
    lastReachedIndex: 0,
    pendingNest: null,
  }));

  if (machineRef.current === null) {
    machineRef.current = new BuilderStateMachine({
      initialPos,
      buildAnimationMs,
      onChange: setSnapshot,
      onCommitPendingBuild: (nest) => onPendingBuildCommitRef.current?.(nest),
    });
  }

  useEffect(() => {
    const machine = machineRef.current;
    return () => {
      machine?.dispose();
    };
  }, []);

  // Self-heal a stranded builder. Runs whenever the obstacle set (the nest
  // list) changes: if visualPosRef has somehow landed inside an obstacle —
  // Vite Fast Refresh preserving a pre-fix motionX/Y, a nest being built
  // right on top of the builder, etc. — push it to the nearest perimeter and
  // emit a single-waypoint path so BuilderSprite snaps motionX/Y there.
  // Without this, the builder can sit visibly inside a building at rest
  // until the user manually clicks somewhere.
  useEffect(() => {
    const safe = machineRef.current?.healAt(visualPosRef.current, nests);
    if (safe) visualPosRef.current = safe;
  }, [nests]);

  const startWalk = useCallback(
    (
      target: Vec2,
      onArrive: "idle" | "build",
      buildingFor?: Nest,
      extraObstacles: Obstacle[] = [],
    ): Vec2 => {
      const machine = machineRef.current;
      if (!machine) return target;
      const result = machine.startWalk({
        target,
        from: visualPosRef.current,
        onArrive,
        nests,
        buildingFor,
        extraObstacles,
      });
      if (
        result.resolvedFrom.x !== visualPosRef.current.x ||
        result.resolvedFrom.y !== visualPosRef.current.y
      ) {
        visualPosRef.current = result.resolvedFrom;
      }
      return result.resolvedGoal;
    },
    [nests],
  );

  const handleArrive = useCallback(() => {
    machineRef.current?.handleArrive();
  }, []);

  const handleSegmentComplete = useCallback((index: number) => {
    machineRef.current?.handleSegmentComplete(index);
  }, []);

  const animation = deriveAnimation(snapshot);
  const pos: Vec2 = snapshot.path[snapshot.lastReachedIndex] ?? initialPos;

  return {
    path: snapshot.path,
    pos,
    animation,
    pendingNest: snapshot.pendingNest,
    visualPosRef,
    startWalk,
    handleArrive,
    handleSegmentComplete,
  };
}
