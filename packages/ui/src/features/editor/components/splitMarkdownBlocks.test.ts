import { describe, expect, it } from "vitest";
import {
  hasOpenCodeFence,
  parseOpenFence,
  splitMarkdownBlocks,
} from "./splitMarkdownBlocks";

describe("splitMarkdownBlocks", () => {
  it.each([
    "",
    "single line",
    "para one\n\npara two\n\npara three",
    "# Heading\n\nText with **bold**.\n\n- a\n- b\n",
    "Intro\n\n```ts\nconst x = 1;\nconst y = 2;\n```\n\nOutro",
    "trailing blanks\n\n\n\n",
  ])("joins back to the exact input, dropping no text: %j", (src) => {
    expect(splitMarkdownBlocks(src).join("")).toBe(src);
  });

  it("splits paragraphs at blank lines", () => {
    expect(splitMarkdownBlocks("a\n\nb\n\nc")).toEqual(["a\n\n", "b\n\n", "c"]);
  });

  it("keeps a fenced code block (with blank lines inside) as one block", () => {
    const md = "```\nline1\n\nline2\n```\n\nafter";
    expect(splitMarkdownBlocks(md)).toEqual([
      "```\nline1\n\nline2\n```\n\n",
      "after",
    ]);
  });

  it("does not split inside an unterminated fence (the tail stays whole)", () => {
    const md = "intro\n\n```ts\nconst a = 1;\n\nconst b = 2;";
    const blocks = splitMarkdownBlocks(md);
    expect(blocks[blocks.length - 1]).toContain("const b = 2;");
    expect(blocks.join("")).toBe(md);
  });
});

describe("hasOpenCodeFence", () => {
  it.each<[string, boolean]>([
    ["```ts\nconst a = 1;", true],
    ["```ts\nconst a = 1;\n```", false],
    ["no code here", false],
    ["text\n\n```\npartial", true],
  ])("%j -> open=%s", (src, expected) => {
    expect(hasOpenCodeFence(src)).toBe(expected);
  });
});

describe("parseOpenFence", () => {
  it("splits the prose before the open fence from the code so far", () => {
    const { before, code } = parseOpenFence("Here:\n```ts\nconst a = 1;");
    expect(before).toBe("Here:\n");
    expect(code).toBe("const a = 1;");
  });

  it("targets the LAST open fence, leaving an earlier completed fence in `before`", () => {
    // A completed fence, then text, then an open fence — all one block (no
    // blank lines). The earlier fence must not be swallowed into plain text.
    const block = "```ts\ndone\n```\ntext\n```ts\npartial";
    const { before, code } = parseOpenFence(block);
    expect(before).toBe("```ts\ndone\n```\ntext\n");
    expect(code).toBe("partial");
  });
});
