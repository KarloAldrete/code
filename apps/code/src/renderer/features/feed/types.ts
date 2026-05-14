export type FeedItemKind = "feature_flag" | "survey" | "experiment";

export type FeedEventType = "launched" | "concluded" | "rolled_out_100";

export interface FeedItem {
  id: string;
  kind: FeedItemKind;
  title: string;
  description: string | null;
  /** ISO timestamp used for sorting and display. */
  timestamp: string;
  /** What happened — drives the colored header label. */
  event: FeedEventType;
  /** PostHog app URL for the underlying resource. */
  url: string | null;
}
