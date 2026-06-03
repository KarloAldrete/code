import { Hash, ListChecks } from "@phosphor-icons/react";
import { Button, cn } from "@posthog/quill";
import { Flex } from "@radix-ui/themes";

type SidebarPanel = "tasks" | "files";

// The "files" value is persisted as activePanel in the sidebar store; keep it as
// "files" so existing persisted state isn't orphaned. Only the visible label is
// "Channels".
const PANELS: { value: SidebarPanel; label: string; icon: React.ReactNode }[] =
  [
    { value: "files", label: "Channels", icon: <Hash size={14} /> },
    { value: "tasks", label: "Tasks", icon: <ListChecks size={14} /> },
  ];

interface SidebarPanelToggleProps {
  activePanel: SidebarPanel;
  onChange: (panel: SidebarPanel) => void;
}

// Segmented control letting the user switch between the file-system tree and
// their task list when the file-system sidebar flag is on.
export function SidebarPanelToggle({
  activePanel,
  onChange,
}: SidebarPanelToggleProps) {
  return (
    <Flex gap="1" className="mb-2 rounded-md bg-gray-2 p-[2px]">
      {PANELS.map(({ value, label, icon }) => {
        const isActive = activePanel === value;
        return (
          <Button
            key={value}
            type="button"
            size="xs"
            className={cn(
              "flex flex-1 items-center justify-center gap-[6px] font-medium",
              isActive
                ? "bg-gray-1 text-gray-12 shadow-sm hover:bg-gray-1"
                : "bg-transparent text-gray-10 hover:bg-transparent hover:text-gray-12",
            )}
            onClick={() => onChange(value)}
          >
            {icon}
            {label}
          </Button>
        );
      })}
    </Flex>
  );
}
