import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WatcherRegistryService } from "../watcher-registry/service";
import {
  findBlockInsertionLine,
  findExistingThreadRange,
  formatThreadLine,
  isThreadLine,
  PlansWatcherService,
} from "./service";

const SAMPLE_PLAN = `# Plan

## Step 1: Refactor auth middleware

Move session validation from middleware to a dedicated service.

## Step 2: Update tests

Add coverage for the new service.
`;

describe("plans-watcher helpers", () => {
  describe("isThreadLine", () => {
    it("recognises `[H]:` lines", () => {
      expect(isThreadLine("> [H]: hello")).toBe(true);
    });
    it("recognises `[A]:` lines", () => {
      expect(isThreadLine("> [A]: hi back")).toBe(true);
    });
    it("recognises `[resolved]` markers", () => {
      expect(isThreadLine("> [resolved]")).toBe(true);
    });
    it("ignores regular blockquotes", () => {
      expect(isThreadLine("> just a quote")).toBe(false);
    });
    it("ignores blank lines and paragraphs", () => {
      expect(isThreadLine("")).toBe(false);
      expect(isThreadLine("Move session validation…")).toBe(false);
    });
  });

  describe("findBlockInsertionLine", () => {
    it("returns the line after the matched block (exact paragraph text)", () => {
      const lines = SAMPLE_PLAN.split("\n");
      const line = findBlockInsertionLine(
        lines,
        "Move session validation from middleware to a dedicated service.",
      );
      // Source line 4 (0-indexed) is the paragraph; insertion is line 5.
      expect(line).toBe(5);
    });

    it("matches a multi-line block when blockText spans all of its lines", () => {
      const lines = ["a paragraph", "spanning", "three lines", "", "next"];
      const line = findBlockInsertionLine(
        lines,
        "a paragraph\nspanning\nthree lines",
      );
      expect(line).toBe(3);
    });

    it("returns null when no block matches", () => {
      expect(findBlockInsertionLine(SAMPLE_PLAN.split("\n"), "nope")).toBe(
        null,
      );
    });

    it("finds the Nth occurrence when the block text repeats", () => {
      const lines = [
        "## Step 1",
        "",
        "First step content",
        "",
        "## Step 1",
        "",
        "Duplicate heading",
        "",
        "## Step 1",
        "",
        "Third one",
      ];
      expect(findBlockInsertionLine(lines, "## Step 1", 0)).toBe(1);
      expect(findBlockInsertionLine(lines, "## Step 1", 1)).toBe(5);
      expect(findBlockInsertionLine(lines, "## Step 1", 2)).toBe(9);
    });

    it("defaults to occurrence 0 when none specified", () => {
      const lines = ["## Step 1", "", "## Step 1", "", "..."];
      expect(findBlockInsertionLine(lines, "## Step 1")).toBe(1);
    });

    it("returns null when the occurrence index exceeds the match count", () => {
      const lines = ["## Step 1", "", "only one"];
      expect(findBlockInsertionLine(lines, "## Step 1", 1)).toBe(null);
    });

    it("requires an exact block match — `## Step 1` must not match `## Step 10`", () => {
      const lines = ["## Step 1", "", "first", "", "## Step 10", "", "tenth"];
      // Only one block exactly equals "## Step 1" (line 0).
      expect(findBlockInsertionLine(lines, "## Step 1", 0)).toBe(1);
      expect(findBlockInsertionLine(lines, "## Step 1", 1)).toBe(null);
    });

    it("doesn't count thread blockquote content as an anchor match", () => {
      // A previous reply that mentions the snippet must not be counted as
      // an occurrence of the heading itself.
      const lines = [
        "## Step 1",
        "",
        "> [H]: I think `## Step 1` should be renamed",
        "> [A]: Got it.",
        "",
        "## Step 1",
        "",
        "second",
      ];
      // There are two real "## Step 1" headings (line 0 and line 5). The
      // blockquote does not count.
      expect(findBlockInsertionLine(lines, "## Step 1", 0)).toBe(1);
      expect(findBlockInsertionLine(lines, "## Step 1", 1)).toBe(6);
      expect(findBlockInsertionLine(lines, "## Step 1", 2)).toBe(null);
    });

    it("matches a fenced code block that contains a blank line", () => {
      // A fenced code block is ONE markdown block, even when its body has
      // a blank line. The renderer exposes a single gutter for it, so the
      // watcher must treat it as one block too — not three sub-blocks
      // split on blank lines.
      const source =
        "```ts\n" +
        "function foo() {\n" +
        "\n" +
        "  return 1;\n" +
        "}\n" +
        "```\n" +
        "\n" +
        "Some prose after.\n";
      const lines = source.split("\n");
      const fencedBlock = "```ts\nfunction foo() {\n\n  return 1;\n}\n```";
      // The fenced block spans lines 0–5; insertion after it is line 6.
      expect(findBlockInsertionLine(lines, fencedBlock)).toBe(6);
    });

    it("matches an individual list item, not the whole list", () => {
      // The renderer anchors each list item separately so users can
      // comment per item. The watcher must therefore find a single item
      // by its source text and return the line right after it.
      const source =
        "- item one\n- item two\n- item three\n\nNext paragraph.\n";
      const lines = source.split("\n");
      // Insertion after "- item one" is line 1 (right between items).
      expect(findBlockInsertionLine(lines, "- item one")).toBe(1);
      expect(findBlockInsertionLine(lines, "- item two")).toBe(2);
      expect(findBlockInsertionLine(lines, "- item three")).toBe(3);
    });

    it("matches list items in ordered lists by their full marker", () => {
      const source = "1. first step\n2. second step\n\nNext paragraph.\n";
      const lines = source.split("\n");
      expect(findBlockInsertionLine(lines, "1. first step")).toBe(1);
      expect(findBlockInsertionLine(lines, "2. second step")).toBe(2);
    });

    it("counts occurrences across identical list items in the doc", () => {
      const source = "- repeat\n- repeat\n\nNext paragraph.\n";
      const lines = source.split("\n");
      expect(findBlockInsertionLine(lines, "- repeat", 0)).toBe(1);
      expect(findBlockInsertionLine(lines, "- repeat", 1)).toBe(2);
      expect(findBlockInsertionLine(lines, "- repeat", 2)).toBeNull();
    });

    it("matches a GFM table as one block (renderer uses remark-gfm)", () => {
      // The renderer parses with remark-gfm, which treats this as one
      // `table` block. Without gfm in the watcher parser, the table rows
      // would parse as paragraphs and we'd split incorrectly.
      const source =
        "| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n\nAfter table.\n";
      const lines = source.split("\n");
      const tableBlock = "| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";
      expect(findBlockInsertionLine(lines, tableBlock)).toBe(4);
    });
  });

  describe("findExistingThreadRange", () => {
    it("returns null when no thread exists", () => {
      const lines = ["paragraph", "", "another paragraph"];
      expect(findExistingThreadRange(lines, 1)).toBe(null);
    });

    it("identifies a contiguous thread block", () => {
      const lines = [
        "paragraph",
        "",
        "> [H]: question",
        "> [A]: answer",
        "",
        "next",
      ];
      const range = findExistingThreadRange(lines, 1);
      expect(range).toEqual({ start: 2, end: 4 });
    });

    it("includes a trailing `[resolved]` marker", () => {
      const lines = [
        "paragraph",
        "",
        "> [H]: question",
        "> [A]: answer",
        "> [resolved]",
        "",
        "next",
      ];
      const range = findExistingThreadRange(lines, 1);
      expect(range).toEqual({ start: 2, end: 5 });
    });
  });

  describe("formatThreadLine", () => {
    it("emits a single-line blockquote with the speaker tag", () => {
      expect(formatThreadLine("H", "hello world")).toBe("> [H]: hello world");
    });
    it("collapses newlines in the message", () => {
      expect(formatThreadLine("A", "line one\n  line two")).toBe(
        "> [A]: line one line two",
      );
    });
  });
});

describe("PlansWatcherService.appendThreadMessage / resolveThread", () => {
  let tmpDir: string;
  let plansDir: string;
  let service: PlansWatcherService;
  let savedConfigDir: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "plans-watcher-test-"));
    plansDir = path.join(tmpDir, "claude", "plans");
    await fs.mkdir(plansDir, { recursive: true });
    savedConfigDir = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = path.join(tmpDir, "claude");

    const registryStub = {
      isShutdown: false,
      register: vi.fn(),
      unregister: vi.fn(),
    } as unknown as WatcherRegistryService;
    service = new PlansWatcherService(registryStub);
  });

  afterEach(async () => {
    if (savedConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = savedConfigDir;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("appends a thread under the requested occurrence of a repeated block", async () => {
    const planPath = path.join(plansDir, "plan.md");
    const original = [
      "## Step 1",
      "",
      "First step content",
      "",
      "## Step 1",
      "",
      "Second step content",
      "",
    ].join("\n");
    await fs.writeFile(planPath, original, "utf8");

    await service.appendThreadMessage({
      filePath: planPath,
      blockText: "## Step 1",
      occurrence: 1,
      message: "Why is the same heading used twice?",
      speaker: "H",
    });

    const updated = await fs.readFile(planPath, "utf8");
    const lines = updated.split("\n");
    // The thread must be attached to the SECOND occurrence (line index 4),
    // not the first.
    const threadIdx = lines.findIndex((l) =>
      l.startsWith("> [H]: Why is the same heading"),
    );
    expect(threadIdx).toBeGreaterThan(4);
    // And the first "## Step 1" must NOT have a thread directly after it.
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("First step content");
  });

  it("inserts a blank line AFTER the new thread when the next line is non-blank", async () => {
    // In CommonMark, `## Heading\nNext paragraph` is two blocks with no
    // blank between them. If we insert `> [H]: msg` right after the
    // heading without a trailing blank, "Next paragraph" becomes lazy
    // continuation of the new blockquote and `remarkPlanThreads` can't
    // parse it as a thread anymore.
    const planPath = path.join(plansDir, "plan.md");
    await fs.writeFile(planPath, "## Heading\nNext paragraph\n", "utf8");

    await service.appendThreadMessage({
      filePath: planPath,
      blockText: "## Heading",
      occurrence: 0,
      message: "Why this heading?",
      speaker: "H",
    });

    const updated = await fs.readFile(planPath, "utf8");
    // The thread line must be sandwiched by blank lines on both sides.
    const lines = updated.split("\n");
    const threadIdx = lines.findIndex((l) => l.startsWith("> [H]: Why"));
    expect(threadIdx).toBeGreaterThan(0);
    expect(lines[threadIdx - 1]).toBe("");
    expect(lines[threadIdx + 1]).toBe("");
    expect(lines[threadIdx + 2]).toBe("Next paragraph");
  });

  it("inserts a blank line AFTER `> [resolved]` when the next line is non-blank", async () => {
    // Defensively also keep the resolve marker separated from any
    // following non-thread content.
    const planPath = path.join(plansDir, "plan.md");
    // Manually construct a state where the next line after the thread
    // is non-blank. This shouldn't normally happen (the agent and the
    // append helper produce a trailing blank), but we want to be robust.
    await fs.writeFile(
      planPath,
      "Anchor para.\n\n> [H]: q\nNot a thread line\n",
      "utf8",
    );

    // The renderer wouldn't actually surface this as a thread (the
    // mdast blockquote contains lazy-continuation text), so we exercise
    // the resolve helper directly.
    await service.resolveThread({
      filePath: planPath,
      blockText: "Anchor para.",
      occurrence: 0,
    });

    const updated = await fs.readFile(planPath, "utf8");
    const lines = updated.split("\n");
    const resolvedIdx = lines.findIndex((l) => l.trim() === "> [resolved]");
    expect(resolvedIdx).toBeGreaterThan(0);
    // The line after `> [resolved]` must be blank to terminate the
    // blockquote.
    expect(lines[resolvedIdx + 1]).toBe("");
  });

  it("appends a thread anchored to a single list item", async () => {
    const planPath = path.join(plansDir, "plan.md");
    const original = ["- First item", "- Second item", "- Third item", ""].join(
      "\n",
    );
    await fs.writeFile(planPath, original, "utf8");

    await service.appendThreadMessage({
      filePath: planPath,
      blockText: "- Second item",
      occurrence: 0,
      message: "Why is this here?",
      speaker: "H",
    });

    const updated = await fs.readFile(planPath, "utf8");
    const lines = updated.split("\n");
    const threadIdx = lines.findIndex((l) => l.startsWith("> [H]: Why"));
    // Thread must come AFTER "- Second item" and BEFORE "- Third item".
    const secondIdx = lines.indexOf("- Second item");
    const thirdIdx = lines.indexOf("- Third item");
    expect(threadIdx).toBeGreaterThan(secondIdx);
    expect(threadIdx).toBeLessThan(thirdIdx);
  });

  it("resolves the thread under the requested occurrence", async () => {
    const planPath = path.join(plansDir, "plan.md");
    const original = [
      "## Step",
      "",
      "> [H]: question about first",
      "",
      "## Step",
      "",
      "> [H]: question about second",
      "",
    ].join("\n");
    await fs.writeFile(planPath, original, "utf8");

    await service.resolveThread({
      filePath: planPath,
      blockText: "## Step",
      occurrence: 1,
    });

    const updated = await fs.readFile(planPath, "utf8");
    // First thread must NOT be resolved
    expect(updated.match(/> \[resolved\]/g) ?? []).toHaveLength(1);
    // The resolved marker must appear AFTER the second thread question
    const resolvedIdx = updated.indexOf("> [resolved]");
    const secondQuestionIdx = updated.indexOf("question about second");
    expect(resolvedIdx).toBeGreaterThan(secondQuestionIdx);
  });
});
