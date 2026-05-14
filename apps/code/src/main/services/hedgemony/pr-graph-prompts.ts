/**
 * Prompt builders for Slice 8's PR-graph rebase routing. Mirrors the helpers
 * in `feedback-routing-service.ts` but targets the child hoglet of a freshly
 * merged parent. The agent must be told the parent's branch name explicitly —
 * without it the rebase isn't reproducible from the prompt alone.
 */

/**
 * Prompt for injection into a live child session. Phrased as a direct task —
 * the agent already has tools to run git.
 */
export function buildRebasePrompt(
  parentPrUrl: string,
  parentBranch: string | null,
): string {
  const branchPart = parentBranch
    ? `Its branch was \`${parentBranch}\`.`
    : "Its branch name isn't recorded locally — check the merged PR for the base.";
  return [
    `The parent PR ${parentPrUrl} that this branch was stacked on has been merged.`,
    branchPart,
    "Please:",
    "1. `git fetch origin` to pull the latest refs.",
    "2. Rebase your current branch onto the parent's merge target (typically `origin/main` or the parent's base branch).",
    "3. Resolve any conflicts; if the conflicts are not trivial, summarize what you changed.",
    "4. Force-push the rebased branch with `--force-with-lease` and confirm the PR is green.",
  ].join("\n");
}

/**
 * Fallback prompt used when the child session is closed and we have to spawn
 * a follow-up hoglet. Worded to be self-contained for an agent that has not
 * seen the parent context.
 */
export function buildRebaseFollowUpPrompt(
  parentPrUrl: string,
  parentBranch: string | null,
): string {
  const branchPart = parentBranch
    ? ` Parent branch was \`${parentBranch}\`.`
    : "";
  return [
    `Follow-up: the parent PR ${parentPrUrl} merged while your sibling's session was closed.${branchPart}`,
    "Open this child branch, rebase it onto the parent's base (typically `origin/main` or whatever the merged parent targeted), resolve conflicts, and push.",
    "If the rebase is clean, the child PR will update automatically. If there are conflicts you cannot resolve, leave a comment on the child PR explaining what's blocking.",
  ].join("\n\n");
}
