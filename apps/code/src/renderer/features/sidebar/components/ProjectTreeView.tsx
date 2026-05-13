import { DotsCircleSpinner } from "@components/DotsCircleSpinner";
import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";
import { CaretDown, CaretRight, Folder } from "@phosphor-icons/react";
import { ScrollArea } from "@posthog/quill";
import { Flex } from "@radix-ui/themes";
import { useMemo, useState } from "react";
import { SidebarItem } from "./SidebarItem";

interface FolderNode {
  name: string;
  path: string;
  depth: number;
  children: FolderNode[];
}

interface FileSystemResult {
  id?: string;
  path: string;
  type?: string | null;
}

function buildTree(folders: FileSystemResult[]): FolderNode[] {
  const root: FolderNode = { name: "", path: "", depth: -1, children: [] };
  const index = new Map<string, FolderNode>();
  index.set("", root);

  const sorted = [...folders].sort((a, b) => a.path.localeCompare(b.path));

  for (const folder of sorted) {
    const segments = folder.path.split("/").filter(Boolean);
    let parentPath = "";
    for (let i = 0; i < segments.length; i++) {
      const name = segments[i];
      const currentPath = segments.slice(0, i + 1).join("/");
      if (!index.has(currentPath)) {
        const node: FolderNode = {
          name,
          path: currentPath,
          depth: i,
          children: [],
        };
        const parent = index.get(parentPath);
        if (parent) parent.children.push(node);
        index.set(currentPath, node);
      }
      parentPath = currentPath;
    }
  }

  return root.children;
}

interface FolderRowProps {
  node: FolderNode;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}

function FolderRow({ node, expanded, onToggle }: FolderRowProps) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.path);
  const icon = hasChildren ? (
    isOpen ? (
      <CaretDown size={12} weight="bold" />
    ) : (
      <CaretRight size={12} weight="bold" />
    )
  ) : (
    <Folder size={14} />
  );

  return (
    <>
      <SidebarItem
        depth={node.depth}
        icon={icon}
        label={node.name}
        onClick={() => {
          if (hasChildren) onToggle(node.path);
        }}
      />
      {hasChildren && isOpen
        ? node.children.map((child) => (
            <FolderRow
              key={child.path}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))
        : null}
    </>
  );
}

export function ProjectTreeView() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useAuthenticatedQuery(
    ["file-system", "folders"] as const,
    (client) => client.getFileSystem({ limit: 200 }),
  );

  const tree = useMemo(() => {
    const results = (data?.results ?? []) as FileSystemResult[];
    const folders = results.filter((r) => r.type === "folder");
    return buildTree(folders);
  }, [data]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <ScrollArea className="h-full overflow-y-auto overflow-x-hidden">
      <Flex direction="column" py="2" px="2" gap="1px">
        {isLoading ? (
          <SidebarItem
            depth={0}
            icon={<DotsCircleSpinner size={12} className="text-gray-10" />}
            label="Loading folders..."
            disabled
          />
        ) : tree.length === 0 ? (
          <SidebarItem depth={0} label="No folders" disabled />
        ) : (
          tree.map((node) => (
            <FolderRow
              key={node.path}
              node={node}
              expanded={expanded}
              onToggle={toggle}
            />
          ))
        )}
      </Flex>
    </ScrollArea>
  );
}
