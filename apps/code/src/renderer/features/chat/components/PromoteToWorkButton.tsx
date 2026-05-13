import { ArrowRight } from "@phosphor-icons/react";
import { Button, Tooltip } from "@radix-ui/themes";
import { useSessionForTask } from "@renderer/features/sessions/stores/sessionStore";
import { useNavigationStore } from "@stores/navigationStore";
import { useCallback, useMemo } from "react";
import { flattenChatTranscript } from "../utils/transcript";

interface PromoteToWorkButtonProps {
  taskId: string;
}

export function PromoteToWorkButton({ taskId }: PromoteToWorkButtonProps) {
  const session = useSessionForTask(taskId);
  const setMode = useNavigationStore((s) => s.setMode);
  const navigateToWorkGenerateWithPrompt = useNavigationStore(
    (s) => s.navigateToWorkGenerateWithPrompt,
  );

  const transcript = useMemo(() => flattenChatTranscript(session), [session]);

  const handleClick = useCallback(() => {
    const header = "Context from a Chat session:\n\n";
    const prompt = transcript
      ? `${header}${transcript}\n\n---\n\nTurn this into a reusable Work skill.`
      : "Turn this chat into a reusable Work skill.";
    setMode("work");
    navigateToWorkGenerateWithPrompt(prompt);
  }, [transcript, setMode, navigateToWorkGenerateWithPrompt]);

  return (
    <Tooltip content="Turn this conversation into a reusable Work skill">
      <Button
        variant="soft"
        size="1"
        onClick={handleClick}
        className="cursor-pointer"
      >
        Promote to Work
        <ArrowRight size={12} weight="bold" />
      </Button>
    </Tooltip>
  );
}
