import { ChatCircleText, Flag, TestTube } from "@phosphor-icons/react";
import type { FeedItemKind } from "../types";

export function iconForKind(kind: FeedItemKind, size = 16) {
  if (kind === "feature_flag") return <Flag size={size} />;
  if (kind === "survey") return <ChatCircleText size={size} />;
  return <TestTube size={size} />;
}
