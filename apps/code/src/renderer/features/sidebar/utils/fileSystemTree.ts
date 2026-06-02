import type { Schemas } from "@renderer/api/generated";

const FOLDER_TYPE = "folder";

export interface FileSystemTreeNode {
  /** Stable id/key: the full slash-delimited path. Unique within the tree. */
  id: string;
  /** Display label = last path segment. */
  name: string;
  /** Full path, e.g. "Insights/Web/My insight". */
  path: string;
  isFolder: boolean;
  /** The originating flat row, if any (absent for derived intermediate folders). */
  item?: Schemas.FileSystem;
  children: FileSystemTreeNode[];
}

/**
 * Turn the flat list returned by the desktop file system endpoint into a nested
 * tree. Paths are slash-delimited. Folders may be explicit rows
 * (`type === "folder"`) or only implied by a leaf's path; intermediate folder
 * nodes are created on demand. Children are sorted folders-first, then
 * alphabetically.
 */
export function buildFileSystemTree(
  items: Schemas.FileSystem[],
): FileSystemTreeNode[] {
  const root: FileSystemTreeNode = {
    id: "",
    name: "",
    path: "",
    isFolder: true,
    children: [],
  };
  const byPath = new Map<string, FileSystemTreeNode>();
  byPath.set("", root);

  // Split on "/" and drop empty segments produced by leading/trailing/double
  // slashes so we never create blank-named nodes.
  const segmentsOf = (path: string): string[] =>
    path.split("/").filter((segment) => segment.length > 0);

  // Ensure a folder node exists for the given segment list, creating ancestors
  // as needed. An empty list resolves to the root.
  function ensureFolder(segments: string[]): FileSystemTreeNode {
    const path = segments.join("/");
    const existing = byPath.get(path);
    if (existing) return existing;
    const parent = ensureFolder(segments.slice(0, -1));
    const node: FileSystemTreeNode = {
      id: path,
      name: segments[segments.length - 1] ?? path,
      path,
      isFolder: true,
      children: [],
    };
    byPath.set(path, node);
    parent.children.push(node);
    return node;
  }

  for (const item of items) {
    const segments = segmentsOf(item.path);
    if (segments.length === 0) continue;
    const name = segments[segments.length - 1];
    const normalizedPath = segments.join("/");

    if (item.type === FOLDER_TYPE) {
      const node = ensureFolder(segments);
      node.item = item;
      node.name = name;
      continue;
    }

    // Leaf. If a folder already claims this exact path, keep folder semantics
    // and just attach the source row.
    const existing = byPath.get(normalizedPath);
    if (existing?.isFolder) {
      existing.item = existing.item ?? item;
      continue;
    }

    const parent = ensureFolder(segments.slice(0, -1));
    const leaf: FileSystemTreeNode = {
      id: normalizedPath,
      name,
      path: normalizedPath,
      isFolder: false,
      item,
      children: [],
    };
    byPath.set(normalizedPath, leaf);
    parent.children.push(leaf);
  }

  sortChildren(root);
  return root.children;
}

function sortChildren(node: FileSystemTreeNode): void {
  node.children.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) sortChildren(child);
}
