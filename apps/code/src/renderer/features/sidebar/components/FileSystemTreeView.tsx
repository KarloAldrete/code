import { Code, Hash } from "@phosphor-icons/react";
import { AlertDialog, Button, Flex, Spinner, Text } from "@radix-ui/themes";
import { navigateToTaskDetail } from "@renderer/navigationBridge";
import { useState } from "react";
import { useDesktopFileSystemMutations } from "../hooks/useDesktopFileSystem";
import { useSidebarStore } from "../stores/sidebarStore";
import type { FileSystemTreeNode } from "../utils/fileSystemTree";
import { SidebarItem } from "./SidebarItem";
import { SidebarSection } from "./SidebarSection";

// Persisted collapse state is shared with the task view's repo groups; namespace
// file system keys so the two never collide.
const collapseKey = (path: string) => `fs:${path}`;

// Cap the visual indent so deeply nested paths don't push labels off-screen,
// while keeping the true depth available for keys.
const MAX_VISUAL_DEPTH = 6;

interface FileSystemTreeNodeRowProps {
  node: FileSystemTreeNode;
  depth: number;
  collapsedSections: Set<string>;
  toggleSection: (id: string) => void;
  onDeleteChannel: (node: FileSystemTreeNode) => void;
}

function FileSystemTreeNodeRow({
  node,
  depth,
  collapsedSections,
  toggleSection,
  onDeleteChannel,
}: FileSystemTreeNodeRowProps) {
  const visualDepth = Math.min(depth, MAX_VISUAL_DEPTH);

  if (!node.isFolder) {
    // Task leaves (filed via the task context menu) carry `ref = taskId`;
    // clicking navigates to the task detail in the main pane.
    const isTask = node.item?.type === "task";
    const taskRef = isTask && node.item?.ref ? node.item.ref : null;
    return (
      <SidebarItem
        depth={Math.min(visualDepth + 1, MAX_VISUAL_DEPTH)}
        label={node.name}
        icon={isTask ? <Code size={14} className="text-gray-10" /> : undefined}
        onClick={taskRef ? () => navigateToTaskDetail(taskRef) : undefined}
      />
    );
  }

  const key = collapseKey(node.path);
  const isExpanded = !collapsedSections.has(key);
  // Only real top-level channel rows are deletable: depth 0 with a backing cloud
  // row (derived intermediate folders have no item/id and can't be removed).
  const isDeletableChannel = depth === 0 && Boolean(node.item?.id);

  return (
    <SidebarSection
      id={key}
      label={node.name}
      icon={<Hash size={14} className="text-gray-10" />}
      depth={visualDepth}
      isExpanded={isExpanded}
      onToggle={() => toggleSection(key)}
      addSpacingBefore={false}
      tooltipContent={node.path}
      onDelete={isDeletableChannel ? () => onDeleteChannel(node) : undefined}
      deleteTooltip="Delete channel"
    >
      {node.children.map((child) => (
        <FileSystemTreeNodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
          onDeleteChannel={onDeleteChannel}
        />
      ))}
    </SidebarSection>
  );
}

export function FileSystemTreeView({ nodes }: { nodes: FileSystemTreeNode[] }) {
  const collapsedSections = useSidebarStore((state) => state.collapsedSections);
  const toggleSection = useSidebarStore((state) => state.toggleSection);
  const { deleteChannel, isDeleting } = useDesktopFileSystemMutations();
  const [pendingDelete, setPendingDelete] = useState<FileSystemTreeNode | null>(
    null,
  );

  const confirmDelete = async () => {
    const id = pendingDelete?.item?.id;
    if (!id) return;
    try {
      await deleteChannel(id);
    } finally {
      setPendingDelete(null);
    }
  };

  if (nodes.length === 0) {
    return (
      <Flex direction="column" align="center" className="px-4 pt-6 pb-4">
        <Text className="text-[13px] text-gray-10">No channels yet</Text>
      </Flex>
    );
  }

  return (
    <>
      <Flex direction="column">
        {nodes.map((node) => (
          <FileSystemTreeNodeRow
            key={node.id}
            node={node}
            depth={0}
            collapsedSections={collapsedSections}
            toggleSection={toggleSection}
            onDeleteChannel={setPendingDelete}
          />
        ))}
      </Flex>

      <AlertDialog.Root
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDelete(null);
        }}
      >
        <AlertDialog.Content maxWidth="420px" size="1">
          <AlertDialog.Title className="text-sm">
            Delete channel "{pendingDelete?.name}"?
          </AlertDialog.Title>
          <AlertDialog.Description>
            <Text color="gray" className="text-[13px]">
              This removes the channel for everyone in your project. This can't
              be undone here.
            </Text>
          </AlertDialog.Description>
          <Flex justify="end" gap="3" mt="3">
            <AlertDialog.Cancel>
              <Button
                variant="soft"
                color="gray"
                size="1"
                disabled={isDeleting}
              >
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant="solid"
              color="red"
              size="1"
              disabled={isDeleting}
              onClick={confirmDelete}
            >
              {isDeleting ? <Spinner size="1" /> : null}
              Delete
            </Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}
