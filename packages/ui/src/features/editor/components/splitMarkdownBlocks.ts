/**
 * Split append-only markdown into top-level blocks at blank-line boundaries,
 * keeping fenced code blocks intact. Concatenating the result reproduces the
 * input exactly, so no text is ever dropped.
 *
 * During streaming the LAST element is the still-growing "tail"; everything
 * before it is stable (append-only text never rewrites an earlier block), so a
 * caller can render earlier blocks once and memoize them, re-parsing only the
 * tail on each token. That turns the per-token markdown cost from O(message)
 * into O(last block).
 */
export function splitMarkdownBlocks(src: string): string[] {
  if (src.length === 0) return [src];
  const blocks: string[] = [];
  const n = src.length;
  let blockStart = 0;
  let i = 0;
  let inFence = false;
  let fenceChar = "";

  while (i < n) {
    let nl = src.indexOf("\n", i);
    if (nl === -1) nl = n;
    const line = src.slice(i, nl);
    const trimmed = line.replace(/^ {0,3}/, "");
    const fence = /^(`{3,}|~{3,})/.exec(trimmed);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceChar = fence[1][0];
      } else if (trimmed[0] === fenceChar) {
        inFence = false;
      }
    }
    const lineEnd = nl < n ? nl + 1 : n;
    if (line.trim() === "" && !inFence) {
      // Fold any following blank lines into this same boundary so we don't emit
      // empty blocks.
      let j = lineEnd;
      while (j < n) {
        let nl2 = src.indexOf("\n", j);
        if (nl2 === -1) nl2 = n;
        if (src.slice(j, nl2).trim() !== "") break;
        j = nl2 < n ? nl2 + 1 : n;
      }
      blocks.push(src.slice(blockStart, j));
      blockStart = j;
      i = j;
    } else {
      i = lineEnd;
    }
  }

  if (blockStart < n) blocks.push(src.slice(blockStart));
  return blocks.length > 0 ? blocks : [src];
}

/** True when `src` ends inside an unterminated fenced code block. */
export function hasOpenCodeFence(src: string): boolean {
  let inFence = false;
  let fenceChar = "";
  for (const line of src.split("\n")) {
    const trimmed = line.replace(/^ {0,3}/, "");
    const fence = /^(`{3,}|~{3,})/.exec(trimmed);
    if (!fence) continue;
    if (!inFence) {
      inFence = true;
      fenceChar = fence[1][0];
    } else if (trimmed[0] === fenceChar) {
      inFence = false;
    }
  }
  return inFence;
}
