import type { Root } from "mdast";
import type { Plugin } from "unified";

/**
 * Parses thread blockquotes (`> [H]: …` / `> [A]: …` / `> [resolved]`) inside
 * a plan markdown document and rewrites them into custom `<plan-thread>` HTML
 * nodes (consumed by `PlanView` via `componentsOverride`).
 *
 * Each non-thread top-level block (heading, paragraph, list item, code block)
 * is annotated with a `data-plan-block` attribute carrying the verbatim
 * source text of that block — the `PlanBlockGutter` reads it to send
 * `appendThreadMessage({ blockText, … })` to the main process, which uses
 * the snippet to locate the block on disk and insert the thread.
 */

interface MdNode {
  type: string;
  children?: MdNode[];
  value?: string;
  position?: {
    start: { line: number; column: number; offset?: number };
    end: { line: number; column: number; offset?: number };
  };
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  } & Record<string, unknown>;
}

interface MdRoot extends MdNode {
  type: "root";
  children: MdNode[];
}

interface VFileLike {
  value?: string | Uint8Array;
}

const THREAD_LINE_RE = /^\s*\[(H|A|resolved)\](?::\s*(.*))?$/;

export interface ParsedThreadMessage {
  speaker: "H" | "A";
  text: string;
}

interface ParsedThread {
  messages: ParsedThreadMessage[];
  resolved: boolean;
}

function getNodeText(node: MdNode): string {
  if (typeof node.value === "string") return node.value;
  if (!node.children) return "";
  return node.children.map(getNodeText).join("");
}

function extractSource(node: MdNode, source: string): string | null {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (typeof start !== "number" || typeof end !== "number") return null;
  return source.slice(start, end);
}

/**
 * Parses a blockquote node as a plan thread if every non-blank line in
 * its source matches the `[H]:` / `[A]:` / `[resolved]` pattern.
 * Returns `null` for blockquotes that are regular markdown quotes.
 *
 * Why we parse the source slice and ignore mdast children: CommonMark
 * treats `[H]: short_value` as a link reference *definition*, and once
 * such a definition exists in the document, every subsequent `[H]` is
 * parsed as a `linkReference` node that consumes the brackets. The
 * mdast tree for a multi-line thread thus ends up as a mix of
 * `definition`, `paragraph`, `linkReference`, and `text` nodes — and
 * reconstructing the original line text from those children mangles it.
 * The verbatim source slice (between the blockquote's offsets) is the
 * authoritative answer.
 */
function parseThreadBlockquote(
  node: MdNode,
  source: string,
): ParsedThread | null {
  if (node.type !== "blockquote") return null;
  const blockSource = extractSource(node, source);
  if (blockSource === null) return null;

  const messages: ParsedThreadMessage[] = [];
  let resolved = false;

  for (const rawLine of blockSource.split("\n")) {
    // Strip the blockquote marker (`>` plus optional single space) so the
    // line lines up with the THREAD_LINE_RE shape. Lazy-continuation
    // lines (no leading `>`) pass through unchanged and won't match —
    // they correctly disqualify the blockquote as a thread.
    const stripped = rawLine.replace(/^>\s?/, "");
    if (!stripped.trim()) continue;
    const match = THREAD_LINE_RE.exec(stripped);
    if (!match) return null;
    const tag = match[1] as "H" | "A" | "resolved";
    if (tag === "resolved") {
      resolved = true;
    } else {
      messages.push({ speaker: tag, text: (match[2] ?? "").trim() });
    }
  }

  if (messages.length === 0 && !resolved) return null;
  return { messages, resolved };
}

function asPlanThreadNode(
  thread: ParsedThread,
  anchor: MdNode,
  source: string,
  occurrence: number,
): MdNode {
  const blockText = extractSource(anchor, source) ?? getNodeText(anchor);
  return {
    type: "planThread" as const,
    data: {
      hName: "plan-thread",
      hProperties: {
        "data-block-text": blockText,
        "data-occurrence": occurrence,
        "data-messages": JSON.stringify(thread.messages),
        "data-resolved": thread.resolved ? "true" : "false",
      },
    },
  };
}

function annotateAnchorBlock(
  node: MdNode,
  source: string,
  occurrence: number,
): void {
  const blockText = extractSource(node, source) ?? getNodeText(node);
  if (!blockText.trim()) return;
  if (!node.data) node.data = {};
  if (!node.data.hProperties) node.data.hProperties = {};
  const props = node.data.hProperties;
  if (!("data-plan-block" in props)) {
    props["data-plan-block"] = blockText;
  }
  if (!("data-occurrence" in props)) {
    props["data-occurrence"] = occurrence;
  }
}

function getAnchorOccurrence(node: MdNode): number {
  const raw = node.data?.hProperties?.["data-occurrence"];
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number.parseInt(raw, 10) || 0;
  return 0;
}

/**
 * Block types we expose a `+` gutter for. Keep this set in sync with the
 * components wrapped by `PlanBlockGutter` in `PlanView`:
 *
 *  - `heading` → `<h1>`–`<h6>` (wrapped)
 *  - `paragraph` → `<p>` (wrapped)
 *  - `listItem` → `<li>` (wrapped) — the parent `<ul>`/`<ol>` is NOT
 *    annotated; each item carries its own gutter so users can comment on
 *    individual items.
 *
 * `code` and `table` are deliberately excluded: mdast-util-to-hast moves a
 * fenced `code` node's hProperties onto the inner `<code>` element
 * (wrapped in `<pre>`), and the project's base `table` component drops
 * arbitrary props. Annotating them would set `data-plan-block` on
 * elements no React component listens to — the gutter would be invisible
 * and the user couldn't comment. Re-add them once the renderer wraps
 * those components.
 */
const ANCHORABLE_TYPES = new Set(["heading", "paragraph", "listItem"]);

/** Walk a node and yield each anchorable descendant in document order. */
function* iterAnchorableDescendants(node: MdNode): Iterable<MdNode> {
  if (ANCHORABLE_TYPES.has(node.type)) {
    yield node;
    return; // don't descend into a listItem's nested lists — they're
    // covered by the listItem itself, which carries the whole
    // source slice as `data-plan-block`.
  }
  if (node.type === "list" && node.children) {
    for (const child of node.children) {
      yield* iterAnchorableDescendants(child);
    }
  }
}

/**
 * Return the last anchorable node inside a list/listItem subtree, or
 * `null` if there are none. Used by thread anchor lookup — when a thread
 * blockquote follows a list, the natural anchor is the LAST list item
 * of that list, not the list as a whole.
 */
function findLastAnchorIn(node: MdNode): MdNode | null {
  let last: MdNode | null = null;
  for (const candidate of iterAnchorableDescendants(node)) {
    last = candidate;
  }
  return last;
}

// Type the plugin against mdast's `Root` for unified compatibility, then
// operate on our loose `MdRoot` shape inside (mdast's discriminated children
// types aren't structurally compatible with the simpler `MdNode`).
export const remarkPlanThreads: Plugin<[], Root> = () => {
  return (input, file) => {
    const tree = input as unknown as MdRoot;
    const source = String((file as VFileLike).value ?? "");
    const children = tree.children;

    // Counts of how many times each block text snippet has already appeared
    // as an anchor — drives the per-block `data-occurrence` and is also
    // attached to the thread node so the mutation can target the Nth match.
    const occurrenceByText = new Map<string, number>();

    function occurrenceOf(node: MdNode): number {
      const blockText = (
        extractSource(node, source) ?? getNodeText(node)
      ).trim();
      const seen = occurrenceByText.get(blockText) ?? 0;
      occurrenceByText.set(blockText, seen + 1);
      return seen;
    }

    // Pre-pass: annotate every anchorable node in document order. We
    // descend into lists so each listItem gets its own occurrence and
    // `data-plan-block`. Doing this BEFORE thread anchor resolution lets
    // the anchor lookup just read back the annotated occurrence from
    // whatever node it resolves to (including a listItem inside a list).
    for (const node of children) {
      if (node.type === "list" || ANCHORABLE_TYPES.has(node.type)) {
        for (const anchorable of iterAnchorableDescendants(node)) {
          const occurrence = occurrenceOf(anchorable);
          annotateAnchorBlock(anchorable, source, occurrence);
        }
      }
    }

    // Second pass: rewrite thread blockquotes into plan-thread nodes.
    for (let i = 0; i < children.length; i += 1) {
      const node = children[i];

      const thread = parseThreadBlockquote(node, source);
      if (!thread) continue;

      // Find the nearest preceding non-thread sibling as the anchor.
      // If that sibling is a list, descend to its LAST listItem so the
      // thread visually attaches to the right item.
      let anchorIndex = i - 1;
      while (anchorIndex >= 0 && children[anchorIndex].type === "planThread") {
        anchorIndex -= 1;
      }
      const sibling = anchorIndex >= 0 ? children[anchorIndex] : node;
      const anchor =
        sibling.type === "list"
          ? (findLastAnchorIn(sibling) ?? sibling)
          : sibling;
      // The anchor block's occurrence was assigned in the pre-pass;
      // read it back rather than re-counting (which would double-count).
      const anchorOccurrence = getAnchorOccurrence(anchor);
      children[i] = asPlanThreadNode(thread, anchor, source, anchorOccurrence);
    }
  };
};
