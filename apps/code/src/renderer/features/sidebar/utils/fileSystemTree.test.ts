import type { Schemas } from "@renderer/api/generated";
import { describe, expect, it } from "vitest";
import { buildFileSystemTree } from "./fileSystemTree";

function item(partial: Partial<Schemas.FileSystem>): Schemas.FileSystem {
  return {
    id: partial.path ?? "id",
    path: "",
    depth: null,
    created_at: "2026-01-01T00:00:00Z",
    last_viewed_at: null,
    ...partial,
  };
}

describe("buildFileSystemTree", () => {
  it("returns an empty array for no items", () => {
    expect(buildFileSystemTree([])).toEqual([]);
  });

  it("derives intermediate folder nodes from a leaf path", () => {
    const tree = buildFileSystemTree([
      item({ path: "Insights/Web/My insight", type: "insight", href: "/x" }),
    ]);

    expect(tree).toHaveLength(1);
    const insights = tree[0];
    expect(insights.name).toBe("Insights");
    expect(insights.isFolder).toBe(true);
    expect(insights.item).toBeUndefined(); // derived, no explicit row

    const web = insights.children[0];
    expect(web.name).toBe("Web");
    expect(web.isFolder).toBe(true);

    const leaf = web.children[0];
    expect(leaf.name).toBe("My insight");
    expect(leaf.isFolder).toBe(false);
    expect(leaf.item?.href).toBe("/x");
  });

  it("attaches explicit folder rows to their node", () => {
    const tree = buildFileSystemTree([
      item({ path: "Reports", type: "folder" }),
      item({ path: "Reports/Sales", type: "dashboard", href: "/d" }),
    ]);

    expect(tree).toHaveLength(1);
    const reports = tree[0];
    expect(reports.isFolder).toBe(true);
    expect(reports.item?.type).toBe("folder");
    expect(reports.children.map((c) => c.name)).toEqual(["Sales"]);
  });

  it("sorts folders first, then alphabetically", () => {
    const tree = buildFileSystemTree([
      item({ path: "zeta", type: "insight", href: "/z" }),
      item({ path: "alpha", type: "insight", href: "/a" }),
      item({ path: "Mango", type: "folder" }),
      item({ path: "Apple", type: "folder" }),
    ]);

    expect(tree.map((n) => n.name)).toEqual([
      "Apple",
      "Mango",
      "alpha",
      "zeta",
    ]);
  });

  it("guards against empty path segments", () => {
    const tree = buildFileSystemTree([
      item({ path: "/Leading/slash", type: "insight", href: "/l" }),
      item({ path: "Trailing/slash/", type: "folder" }),
    ]);

    const leading = tree.find((n) => n.name === "Leading");
    expect(leading).toBeDefined();
    expect(leading?.children[0].name).toBe("slash");
    // No blank-named nodes anywhere.
    const names = new Set<string>();
    const walk = (nodes: ReturnType<typeof buildFileSystemTree>) => {
      for (const n of nodes) {
        names.add(n.name);
        walk(n.children);
      }
    };
    walk(tree);
    expect(names.has("")).toBe(false);
  });

  it("keeps folder semantics when a leaf collides with a folder path", () => {
    const tree = buildFileSystemTree([
      item({ path: "Shared", type: "folder" }),
      item({ path: "Shared", type: "insight", href: "/s" }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].isFolder).toBe(true);
  });
});
