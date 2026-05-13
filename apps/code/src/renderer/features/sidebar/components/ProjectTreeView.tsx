import { DotsCircleSpinner } from "@components/DotsCircleSpinner";
import { Tooltip } from "@components/ui/Tooltip";
import { useFolders } from "@features/folders/hooks/useFolders";
import { useFeatureScanStore } from "@features/sidebar/stores/featureScanStore";
import { useAuthenticatedMutation } from "@hooks/useAuthenticatedMutation";
import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";
import {
  CaretDown,
  CaretRight,
  Folder,
  MagicWand,
  Trash,
} from "@phosphor-icons/react";
import { ScrollArea } from "@posthog/quill";
import { AlertDialog, Button, Flex, Select, Text } from "@radix-ui/themes";
import { trpcClient } from "@renderer/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@utils/toast";
import { useMemo, useState } from "react";
import { SidebarItem } from "./SidebarItem";

interface FolderNode {
  name: string;
  path: string;
  depth: number;
  id?: string;
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
      const isLeaf = i === segments.length - 1;
      let node = index.get(currentPath);
      if (!node) {
        node = {
          name,
          path: currentPath,
          depth: i,
          children: [],
        };
        const parent = index.get(parentPath);
        if (parent) parent.children.push(node);
        index.set(currentPath, node);
      }
      if (isLeaf && folder.id && !node.id) {
        node.id = folder.id;
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
  onRequestDelete: (node: FolderNode) => void;
}

function FolderRow({
  node,
  expanded,
  onToggle,
  onRequestDelete,
}: FolderRowProps) {
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

  const endContent = node.id ? (
    <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
      <Tooltip content="Delete folder" side="top">
        {/* biome-ignore lint/a11y/useSemanticElements: Cannot use button inside parent button (SidebarItem) */}
        <span
          role="button"
          tabIndex={0}
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-gray-10 transition-colors hover:bg-gray-4 hover:text-gray-12"
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete(node);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onRequestDelete(node);
            }
          }}
        >
          <Trash size={12} />
        </span>
      </Tooltip>
    </span>
  ) : undefined;

  return (
    <>
      <SidebarItem
        depth={node.depth}
        icon={icon}
        label={node.name}
        endContent={endContent}
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
              onRequestDelete={onRequestDelete}
            />
          ))
        : null}
    </>
  );
}

export function ProjectTreeView() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data, isLoading } = useAuthenticatedQuery(
    ["file-system", "folders"] as const,
    (client) => client.getFileSystem({ limit: 200 }),
  );

  const { folders } = useFolders();
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    undefined,
  );

  const [pendingDelete, setPendingDelete] = useState<FolderNode | null>(null);

  const isScanning = useFeatureScanStore((s) =>
    Object.values(s.state).some((v) => v === "scanning"),
  );

  const activeFolderId =
    selectedFolderId ??
    [...folders].sort(
      (a, b) =>
        new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime(),
    )[0]?.id;

  const invalidateFileSystem = () =>
    queryClient.invalidateQueries({ queryKey: ["file-system"] });

  const deleteFolder = useAuthenticatedMutation(
    (client, { id }: { id: string }) => client.deleteFileSystem(id),
    {
      onSuccess: () => {
        invalidateFileSystem();
        setPendingDelete(null);
        toast.success("Folder deleted");
      },
      onError: (err: Error) => {
        toast.error("Could not delete folder", {
          description: err.message,
        });
      },
    },
  );

  const handleScanClick = async () => {
    if (!activeFolderId) {
      toast.error("No folder connected", {
        description: "Connect a folder first via onboarding or task creation.",
      });
      return;
    }
    try {
      await trpcClient.folders.triggerFeatureScan.mutate({
        folderId: activeFolderId,
      });
    } catch (err) {
      toast.error("Failed to trigger scan", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete?.id) return;
    deleteFolder.mutate({ id: pendingDelete.id });
  };

  const tree = useMemo(() => {
    const results = (data?.results ?? []) as FileSystemResult[];
    const folderResults = results.filter((r) => r.type === "folder");
    return buildTree(folderResults);
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
      <Flex direction="column" py="2" px="2" gap="2">
        {folders.length > 0 && (
          <Flex
            direction="column"
            gap="1"
            px="2"
            py="2"
            className="rounded-(--radius-2) border border-(--gray-5) bg-(--gray-2)"
          >
            <Select.Root
              size="1"
              value={activeFolderId}
              onValueChange={setSelectedFolderId}
            >
              <Select.Trigger placeholder="Select folder" />
              <Select.Content>
                {folders.map((f) => (
                  <Select.Item key={f.id} value={f.id}>
                    {f.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <Button
              size="1"
              variant="soft"
              onClick={handleScanClick}
              disabled={isScanning || !activeFolderId}
            >
              <MagicWand size={12} />
              {isScanning ? "Scanning…" : "Scan for features"}
            </Button>
          </Flex>
        )}
        {isScanning && (
          <SidebarItem
            depth={0}
            icon={<DotsCircleSpinner size={12} className="text-gray-10" />}
            label="Scanning repository…"
            disabled
          />
        )}
        {isLoading ? (
          <SidebarItem
            depth={0}
            icon={<DotsCircleSpinner size={12} className="text-gray-10" />}
            label="Loading folders..."
            disabled
          />
        ) : tree.length === 0 && !isScanning ? (
          <SidebarItem depth={0} label="No folders" disabled />
        ) : (
          tree.map((node) => (
            <FolderRow
              key={node.path}
              node={node}
              expanded={expanded}
              onToggle={toggle}
              onRequestDelete={setPendingDelete}
            />
          ))
        )}
      </Flex>

      <AlertDialog.Root
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialog.Content maxWidth="400px" size="2">
          <AlertDialog.Title className="text-base">
            Delete folder?
          </AlertDialog.Title>
          <AlertDialog.Description size="2">
            Delete <Text className="font-mono">{pendingDelete?.path}</Text>?
            This cannot be undone.
          </AlertDialog.Description>
          <Flex justify="end" gap="2" mt="4">
            <AlertDialog.Cancel>
              <Button
                variant="soft"
                color="gray"
                size="1"
                disabled={deleteFolder.isPending}
              >
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant="solid"
              color="red"
              size="1"
              onClick={handleConfirmDelete}
              loading={deleteFolder.isPending}
            >
              Delete
            </Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </ScrollArea>
  );
}
