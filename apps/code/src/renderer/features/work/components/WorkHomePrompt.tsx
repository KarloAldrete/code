import { PromptInput } from "@features/message-editor/components/PromptInput";
import { useNavigationStore } from "@stores/navigationStore";
import { logger } from "@utils/logger";
import { toast } from "@utils/toast";
import { useCallback, useState } from "react";
import { createProject } from "../canvas/useProjectCanvas";

const WORK_HOME_SESSION_ID = "work-home";
const log = logger.scope("work-home-prompt");

export function WorkHomePrompt() {
  const navigateToWorkProjectDetail = useNavigationStore(
    (s) => s.navigateToWorkProjectDetail,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSubmitting) return;
      setIsSubmitting(true);
      try {
        const project = await createProject({ fromPrompt: trimmed });
        navigateToWorkProjectDetail(project.id);
      } catch (error) {
        const description =
          error instanceof Error ? error.message : "Unknown error";
        toast.error("Could not start project", { description });
        log.error("Failed to create project from prompt", { error });
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, navigateToWorkProjectDetail],
  );

  return (
    <PromptInput
      sessionId={WORK_HOME_SESSION_ID}
      placeholder="Describe a project — I'll set up its canvas and chat."
      autoFocus
      clearOnSubmit
      editorHeight="large"
      enableCommands={false}
      enableBashMode={false}
      disabled={isSubmitting}
      isLoading={isSubmitting}
      onSubmit={handleSubmit}
    />
  );
}
