import { Plug } from "@phosphor-icons/react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@posthog/quill";
import { Text } from "@radix-ui/themes";
import { useState } from "react";

interface ConnectorEntry {
  id: string;
  name: string;
  connected: boolean;
}

const CONNECTORS: ConnectorEntry[] = [
  { id: "posthog", name: "PostHog", connected: true },
  { id: "slack", name: "Slack", connected: true },
  { id: "buildbetter", name: "Buildbetter", connected: true },
  { id: "bigquery", name: "BigQuery", connected: false },
];

export interface ConnectorsMenuProps {
  disabled?: boolean;
  iconSize?: number;
}

export function ConnectorsMenu({
  disabled,
  iconSize = 16,
}: ConnectorsMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="default"
            size="icon-sm"
            disabled={disabled}
            aria-label="Connectors"
            title="Connectors"
          >
            <Plug size={iconSize} weight="bold" />
          </Button>
        }
      />
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={6}
        className="min-w-[200px]"
      >
        {CONNECTORS.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => undefined}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2">
              <span
                className={`block h-2 w-2 rounded-full ${
                  c.connected ? "bg-(--green-9)" : "bg-(--gray-7)"
                }`}
                aria-hidden="true"
              />
              <Text size="2" className="text-(--gray-12)">
                {c.name}
              </Text>
            </span>
            <Text size="1" className="text-(--gray-10)">
              {c.connected ? "Connected" : "Not connected"}
            </Text>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
