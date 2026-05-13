import { Text } from "@components/text";
import { View } from "react-native";

interface AutomationStatusBadgeProps {
  enabled: boolean;
  lastRunStatus: string | null;
}

function renderRunStatus(lastRunStatus: string | null) {
  switch (lastRunStatus) {
    case "running":
      return {
        label: "Running",
        className: "bg-status-info/20 text-status-info",
      };
    case "success":
      return {
        label: "Success",
        className: "bg-status-success/20 text-status-success",
      };
    case "failed":
      return {
        label: "Failed",
        className: "bg-status-error/20 text-status-error",
      };
    default:
      return {
        label: "Never run",
        className: "bg-gray-4 text-gray-11",
      };
  }
}

export function AutomationStatusBadge({
  enabled,
  lastRunStatus,
}: AutomationStatusBadgeProps) {
  const runStatus = renderRunStatus(lastRunStatus);

  return (
    <View className="flex-row flex-wrap gap-2">
      <View
        className={`rounded px-1.5 py-0.5 ${
          enabled ? "bg-accent-3" : "bg-gray-4"
        }`}
      >
        <Text
          className={`text-xs ${enabled ? "text-accent-11" : "text-gray-11"}`}
        >
          {enabled ? "Enabled" : "Paused"}
        </Text>
      </View>
      <View className={`rounded px-1.5 py-0.5 ${runStatus.className}`}>
        <Text className={`text-xs ${runStatus.className.split(" ")[1]}`}>
          {runStatus.label}
        </Text>
      </View>
    </View>
  );
}
