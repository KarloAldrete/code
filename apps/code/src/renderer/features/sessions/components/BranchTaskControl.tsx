import { Tooltip } from "@components/ui/Tooltip";
import { BranchTaskDialog } from "@features/sessions/components/BranchTaskDialog";
import type { Workspace } from "@main/services/workspace/schemas";
import { GitFork } from "@phosphor-icons/react";
import { Button as QuillButton } from "@posthog/quill";
import type { Task } from "@shared/types";
import { useState } from "react";

interface BranchTaskControlProps {
  task: Task;
  workspace: Workspace | null;
}

/** Header button that opens the "Branch task" dialog. */
export function BranchTaskControl({ task, workspace }: BranchTaskControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip content="Branch task">
        <div className="no-drag flex shrink-0 items-center">
          <QuillButton
            variant="outline"
            size="sm"
            aria-label="Branch task"
            onClick={() => setOpen(true)}
          >
            <GitFork size={14} weight="regular" className="shrink-0" />
          </QuillButton>
        </div>
      </Tooltip>
      {open && (
        <BranchTaskDialog
          task={task}
          workspace={workspace}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
