import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { remarkPlanThreads } from "../remark/remarkPlanThreads";
import { buildThreadKey } from "../stores/planAgentActivityStore";

interface PlanThreadNode {
  type: string;
  data?: {
    hProperties?: {
      "data-block-text"?: unknown;
      "data-occurrence"?: unknown;
    };
  };
}

interface ProcessedTree {
  children?: PlanThreadNode[];
}

function parseOccurrence(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Walks the rendered plan source through the same remark pipeline as
 * `PlanView` and returns the set of thread keys currently anchored in the
 * file. Used by `PlanView` to garbage-collect the
 * `planAgentActivityStore` queue when the agent rewrites the plan and
 * removes a resolved thread block.
 */
export function extractThreadKeys(
  content: string,
  filePath: string,
): Set<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkPlanThreads);
  const tree = processor.runSync(
    processor.parse(content),
    content,
  ) as unknown as ProcessedTree;

  const keys = new Set<string>();
  for (const node of tree.children ?? []) {
    if (node.type !== "planThread") continue;
    const props = node.data?.hProperties;
    const blockText = props?.["data-block-text"];
    if (typeof blockText !== "string" || !blockText) continue;
    const occurrence = parseOccurrence(props?.["data-occurrence"]);
    keys.add(buildThreadKey({ filePath, blockText, occurrence }));
  }
  return keys;
}
