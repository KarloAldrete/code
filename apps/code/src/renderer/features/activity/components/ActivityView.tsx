import { useSetHeaderContent } from "@hooks/useSetHeaderContent";
import { ArrowClockwise, MagnifyingGlass, Pulse } from "@phosphor-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@posthog/quill";
import { Box, Button, Flex, Text, TextField } from "@radix-ui/themes";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { EventsTab } from "./EventsTab";
import { PersonsTab } from "./PersonsTab";
import { RecordingsTab } from "./RecordingsTab";

type ActivityTab = "events" | "recordings" | "persons";

export function ActivityView() {
  const [activeTab, setActiveTab] = useState<ActivityTab>("events");
  const [search, setSearch] = useState("");

  const headerContent = useMemo(
    () => (
      <Flex align="center" gap="2" className="w-full min-w-0">
        <Pulse size={12} className="shrink-0 text-gray-10" />
        <Text
          className="truncate whitespace-nowrap font-medium text-[13px]"
          title="Activity"
        >
          Activity
        </Text>
      </Flex>
    ),
    [],
  );
  useSetHeaderContent(headerContent);

  const searchPlaceholder =
    activeTab === "events"
      ? "Filter by event name..."
      : activeTab === "persons"
        ? "Search persons by email or distinct ID..."
        : "Search recordings...";

  return (
    <Flex direction="column" height="100%" className="overflow-hidden">
      <Box px="5" py="3" className="shrink-0 border-gray-6 border-b">
        <Text as="div" size="3" weight="medium">
          Activity
        </Text>
        <Text as="div" size="1" className="text-(--gray-11)">
          Dig into raw events to make sure tracking is working and see what
          users are doing in your product.
        </Text>
      </Box>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as ActivityTab);
          setSearch("");
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Flex
          align="center"
          justify="between"
          px="5"
          py="2"
          gap="3"
          className="shrink-0 border-gray-6 border-b"
        >
          <TabsList>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="recordings">Session recordings</TabsTrigger>
            <TabsTrigger value="persons">Persons</TabsTrigger>
          </TabsList>

          <Flex align="center" gap="2" className="min-w-0 flex-1 justify-end">
            <TextField.Root
              size="2"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80 max-w-full"
            >
              <TextField.Slot>
                <MagnifyingGlass size={14} />
              </TextField.Slot>
            </TextField.Root>
            <RefreshButton tab={activeTab} />
          </Flex>
        </Flex>

        <TabsContent value="events" className="min-h-0 flex-1 overflow-hidden">
          <EventsTab eventFilter={search} />
        </TabsContent>
        <TabsContent
          value="recordings"
          className="min-h-0 flex-1 overflow-hidden"
        >
          <RecordingsTab search={search} />
        </TabsContent>
        <TabsContent value="persons" className="min-h-0 flex-1 overflow-hidden">
          <PersonsTab search={search} />
        </TabsContent>
      </Tabs>
    </Flex>
  );
}

function RefreshButton({ tab }: { tab: ActivityTab }) {
  const queryClient = useQueryClient();
  return (
    <Button
      size="1"
      variant="soft"
      color="gray"
      onClick={() => {
        queryClient.invalidateQueries({ queryKey: ["activity", tab] });
      }}
      title={`Refresh ${tab}`}
    >
      <ArrowClockwise size={12} />
      Refresh
    </Button>
  );
}
