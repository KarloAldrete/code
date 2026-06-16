import { SparkleIcon } from "@phosphor-icons/react";
import { Button } from "@posthog/ui/primitives/Button";
import { useConciergeStore } from "./conciergeStore";

/**
 * Opens the concierge dock and seeds it with a prompt — the render surfaces'
 * hand-off into authoring ("edit with AI"). The concierge does the actual edits
 * server-side via staged draft revisions; this just starts the conversation
 * with the right context.
 */
export function EditWithAIButton({
  prompt,
  agentSlug,
  label = "Ask the concierge",
  variant = "soft",
  size = "1",
}: {
  prompt: string;
  agentSlug?: string | null;
  label?: string;
  variant?: "soft" | "ghost" | "outline";
  size?: "1" | "2";
}) {
  const startConcierge = useConciergeStore((s) => s.startConcierge);
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => startConcierge(prompt, agentSlug)}
    >
      <SparkleIcon size={14} weight="fill" />
      {label}
    </Button>
  );
}
