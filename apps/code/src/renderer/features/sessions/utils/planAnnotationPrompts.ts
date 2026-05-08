import type { PlanAnnotationDraft } from "@features/sessions/stores/planAnnotationDraftsStore";

function formatLineRef(startLine: number, endLine: number): string {
  return startLine === endLine
    ? `line ${startLine}`
    : `lines ${startLine}-${endLine}`;
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

export function buildPlanAnnotationsPrompt(
  drafts: PlanAnnotationDraft[],
): string {
  if (drafts.length === 0) return "";

  const sorted = [...drafts].sort((a, b) => a.startLine - b.startLine);

  if (sorted.length === 1) {
    const [d] = sorted;
    return `Please revise the plan based on this inline comment on ${formatLineRef(d.startLine, d.endLine)}:\n\n${d.text}`;
  }

  const items = sorted
    .map(
      (d) =>
        `- On ${formatLineRef(d.startLine, d.endLine)}:\n${indent(d.text)}`,
    )
    .join("\n\n");

  return `Please revise the plan based on these inline comments:\n\n${items}`;
}
