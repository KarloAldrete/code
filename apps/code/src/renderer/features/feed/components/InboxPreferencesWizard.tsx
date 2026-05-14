import { Button } from "@posthog/quill";
import { Box, Checkbox, Flex, Text } from "@radix-ui/themes";
import {
  type InboxTopicKey,
  useInboxPreferencesStore,
} from "../stores/inboxPreferencesStore";

interface InboxPreferencesWizardProps {
  onDone: () => void;
  submitLabel?: string;
  showIntro?: boolean;
  layout?: "page" | "modal";
}

interface TopicSection {
  title: string;
  description?: string;
  topics: { key: InboxTopicKey; label: string; hint?: string }[];
}

const SECTIONS: TopicSection[] = [
  {
    title: "Internally",
    description: "Changes your team is shipping inside PostHog.",
    topics: [
      { key: "newFeatureFlags", label: "New feature flags" },
      { key: "newExperiments", label: "New experiments" },
      { key: "launchedSurveys", label: "Launched surveys" },
    ],
  },
  {
    title: "About your users",
    description: "Behavior signals from people using your product.",
    topics: [
      {
        key: "events",
        label: "Events",
        hint: "Every time they occur — high volume",
      },
      { key: "metricAnomalies", label: "Metric anomalies" },
      { key: "customerRiskScoreChanges", label: "Customer risk score changes" },
      { key: "errors", label: "Errors" },
    ],
  },
  {
    title: "Coding",
    description: "Suggestions for your codebase.",
    topics: [
      { key: "codeFixesAndSuggestions", label: "Code fixes and suggestions" },
    ],
  },
];

export function InboxPreferencesWizard({
  onDone,
  submitLabel = "Save and continue",
  showIntro = true,
  layout = "page",
}: InboxPreferencesWizardProps) {
  const preferences = useInboxPreferencesStore((s) => s.preferences);
  const setPreference = useInboxPreferencesStore((s) => s.setPreference);
  const completeWizard = useInboxPreferencesStore((s) => s.completeWizard);

  const handleSubmit = () => {
    completeWizard();
    onDone();
  };

  const body = (
    <>
      {showIntro && (
        <Box mb="6">
          <Text as="div" size="5" weight="medium" className="text-(--gray-12)">
            Set up your Inbox
          </Text>
          <Text as="div" size="2" mt="2" className="text-(--gray-11)">
            Inbox helps you keep up to date with how users are using your
            product and what changes engineers are building in your product.
            Pick what you want to hear about — you can edit this later.
          </Text>
        </Box>
      )}

      <Flex direction="column" gap="5">
        {SECTIONS.map((section) => (
          <Box key={section.title}>
            <Text
              as="div"
              size="2"
              weight="medium"
              className="text-(--gray-12)"
            >
              {section.title}
            </Text>
            {section.description && (
              <Text as="div" size="1" mt="1" className="text-(--gray-11)">
                {section.description}
              </Text>
            )}
            <Flex direction="column" gap="2" mt="3">
              {section.topics.map((topic) => (
                // biome-ignore lint/a11y/noLabelWithoutControl: Radix Checkbox renders as button[role=checkbox] inside the label
                <label
                  key={topic.key}
                  className="flex cursor-pointer items-start gap-3 rounded-(--radius-2) border border-(--gray-5) bg-(--gray-1) px-3 py-2 hover:bg-(--gray-2)"
                >
                  <Checkbox
                    checked={preferences[topic.key]}
                    onCheckedChange={(checked) =>
                      setPreference(topic.key, checked === true)
                    }
                  />
                  <Box className="flex-1">
                    <Text as="div" size="2" className="text-(--gray-12)">
                      {topic.label}
                    </Text>
                    {topic.hint && (
                      <Text as="div" size="1" className="text-(--gray-10)">
                        {topic.hint}
                      </Text>
                    )}
                  </Box>
                </label>
              ))}
            </Flex>
          </Box>
        ))}
      </Flex>

      <Flex justify="end" gap="2" mt="6">
        <Button onClick={handleSubmit}>{submitLabel}</Button>
      </Flex>
    </>
  );

  if (layout === "modal") {
    return <Box>{body}</Box>;
  }

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      className="h-full overflow-y-auto"
    >
      <Box className="w-full max-w-xl px-6 py-10">{body}</Box>
    </Flex>
  );
}
