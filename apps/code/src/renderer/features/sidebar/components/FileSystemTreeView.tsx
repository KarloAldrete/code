import { Hash } from "@phosphor-icons/react";
import { Flex, Text } from "@radix-ui/themes";
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
}

function FileSystemTreeNodeRow({
  node,
  depth,
  collapsedSections,
  toggleSection,
}: FileSystemTreeNodeRowProps) {
  const visualDepth = Math.min(depth, MAX_VISUAL_DEPTH);

  if (!node.isFolder) {
    // Leaf rows are inert for now — a click hook is intentionally left unwired.
    return <SidebarItem depth={visualDepth} label={node.name} />;
  }

  const key = collapseKey(node.path);
  const isExpanded = !collapsedSections.has(key);

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
    >
      {node.children.map((child) => (
        <FileSystemTreeNodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
        />
      ))}
    </SidebarSection>
  );
}

export function FileSystemTreeView({ nodes }: { nodes: FileSystemTreeNode[] }) {
  const collapsedSections = useSidebarStore((state) => state.collapsedSections);
  const toggleSection = useSidebarStore((state) => state.toggleSection);

  if (nodes.length === 0) {
    return (
      <Flex direction="column" align="center" className="px-4 pt-6 pb-4">
        <Text className="text-[13px] text-gray-10">Nothing here yet</Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column">
      {nodes.map((node) => (
        <FileSystemTreeNodeRow
          key={node.id}
          node={node}
          depth={0}
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
        />
      ))}
    </Flex>
  );
}
