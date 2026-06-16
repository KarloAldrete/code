import { describe, expect, it } from "vitest";
import { hasOpenCodeFence, splitMarkdownBlocks } from "./splitMarkdownBlocks";

describe("splitMarkdownBlocks", () => {
  it("never drops text — joining the blocks reproduces the input", () => {
    const samples = [
      "",
      "single line",
      "para one\n\npara two\n\npara three",
      "# Heading\n\nText with **bold**.\n\n- a\n- b\n",
      "Intro\n\n```ts\nconst x = 1;\nconst y = 2;\n```\n\nOutro",
      "trailing blanks\n\n\n\n",
    ];
    for (const s of samples) {
      expect(splitMarkdownBlocks(s).join("")).toBe(s);
    }
  });

  it("splits paragraphs at blank lines", () => {
    expect(splitMarkdownBlocks("a\n\nb\n\nc")).toEqual(["a\n\n", "b\n\n", "c"]);
  });

  it("keeps a fenced code block (with blank lines inside) as one block", () => {
    const md = "```\nline1\n\nline2\n```\n\nafter";
    const blocks = splitMarkdownBlocks(md);
    expect(blocks[0]).toBe("```\nline1\n\nline2\n```\n\n");
    expect(blocks[1]).toBe("after");
  });

  it("does not split inside an unterminated fence (the tail stays whole)", () => {
    const md = "intro\n\n```ts\nconst a = 1;\n\nconst b = 2;";
    const blocks = splitMarkdownBlocks(md);
    expect(blocks[blocks.length - 1]).toContain("const b = 2;");
    expect(blocks.join("")).toBe(md);
  });
});

describe("hasOpenCodeFence", () => {
  it("is true while a fence is open and false once it closes", () => {
    expect(hasOpenCodeFence("```ts\nconst a = 1;")).toBe(true);
    expect(hasOpenCodeFence("```ts\nconst a = 1;\n```")).toBe(false);
    expect(hasOpenCodeFence("no code here")).toBe(false);
    expect(hasOpenCodeFence("text\n\n```\npartial")).toBe(true);
  });
});
