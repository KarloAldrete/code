import type { FeedItem } from "./types";

export interface FeedEventStyle {
  label: string;
  className: string;
}

export function getEventStyle(item: FeedItem): FeedEventStyle {
  if (item.kind === "feature_flag") {
    if (item.event === "rolled_out_100") {
      return {
        label: "Feature Flag Rolled Out to 100%",
        className: "text-(--iris-11)",
      };
    }
    return {
      label: "New Feature Flag Launched",
      className: "text-(--green-11)",
    };
  }
  if (item.kind === "survey") {
    return { label: "New Survey Launched", className: "text-(--blue-11)" };
  }
  if (item.event === "concluded") {
    return { label: "Experiment Concluded", className: "text-(--amber-11)" };
  }
  return { label: "New Experiment Launched", className: "text-(--purple-11)" };
}

export function formatRelative(iso: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diffMs = Date.now() - t;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const m = Math.max(1, Math.floor(diffMs / minute));
    return `${m}m ago`;
  }
  if (diffMs < day) {
    const h = Math.floor(diffMs / hour);
    return `${h}h ago`;
  }
  const d = Math.floor(diffMs / day);
  return `${d}d ago`;
}
