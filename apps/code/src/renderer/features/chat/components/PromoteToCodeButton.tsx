import { ArrowRight } from "@phosphor-icons/react";
import { Button, Tooltip } from "@radix-ui/themes";
import { useSessionForTask } from "@renderer/features/sessions/stores/sessionStore";
import { useNavigationStore } from "@stores/navigationStore";
import { useCallback, useMemo } from "react";
import { flattenChatTranscript } from "../utils/transcript";

interface PromoteToCodeButtonProps {
  taskId: string;
}

export function PromoteToCodeButton({ taskId }: PromoteToCodeButtonProps) {
  const session = useSessionForTask(taskId);
  const setMode = useNavigationStore((s) => s.setMode);
  const navigateToTaskInput = useNavigationStore((s) => s.navigateToTaskInput);

  const transcript = useMemo(() => flattenChatTranscript(session), [session]);

  const handleClick = useCallback(() => {
    const header = "Context from a Chat session:\n\n";
    const initialPrompt = transcript
      ? `${header}${transcript}\n\n---\n\nLet's turn this into a code task.`
      : "Let's turn this chat into a code task.";
    setMode("code");
    navigateToTaskInput({ initialPrompt });
  }, [transcript, setMode, navigateToTaskInput]);

  return (
    <Tooltip content="Open this conversation as a Code task with a worktree">
      <Button
        variant="soft"
        size="1"
        onClick={handleClick}
        className="cursor-pointer"
      >
        Promote to Code
        <ArrowRight size={12} weight="bold" />
      </Button>
    </Tooltip>
  );
}
