import type { SessionConfigOption } from "@agentclientprotocol/sdk";
import { Lightning } from "@phosphor-icons/react";
import { Button } from "@posthog/quill";
import { Tooltip } from "@posthog/ui/primitives/Tooltip";
import { flattenSelectOptions } from "../sessionStore";

interface ServiceTierSelectorProps {
  serviceTierOption?: SessionConfigOption;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export function ServiceTierSelector({
  serviceTierOption,
  onChange,
  disabled,
}: ServiceTierSelectorProps) {
  if (!serviceTierOption || serviceTierOption.type !== "select") {
    return null;
  }

  const options = flattenSelectOptions(serviceTierOption.options);
  const supportsFastMode = options.some((opt) => opt.value === "fast");
  if (!supportsFastMode) return null;

  const activeTier = serviceTierOption.currentValue;
  const fastModeEnabled = activeTier === "fast";

  const handleClick = () => {
    onChange?.(fastModeEnabled ? "standard" : "fast");
  };

  return (
    <Tooltip content="1.5x speed, increased usage" side="top">
      <span className="inline-flex">
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={disabled}
          aria-label="Fast Mode"
          aria-pressed={fastModeEnabled}
          className={
            fastModeEnabled
              ? "border-(--amber-7) bg-(--amber-3) text-amber-11 hover:bg-(--amber-4)"
              : "text-muted-foreground"
          }
          onClick={handleClick}
        >
          <Lightning size={14} weight={fastModeEnabled ? "fill" : "regular"} />
        </Button>
      </span>
    </Tooltip>
  );
}
