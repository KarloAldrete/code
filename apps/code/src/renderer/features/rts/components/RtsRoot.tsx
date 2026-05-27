import { BgmPlayer } from "@features/rts/audio/BgmPlayer";
import { SfxBridge } from "@features/rts/audio/SfxBridge";
import { useRtsPrGraphRouter } from "@features/rts/hooks/useRtsPrGraphRouter";
import { useRtsPromptRouter } from "@features/rts/hooks/useRtsPromptRouter";
import { useFeatureFlag } from "@hooks/useFeatureFlag";
import { RTS_FLAG } from "@shared/constants";

// Wrapping the RTS background services (prompt router, PR-graph router) and
// audio bridges in a single flag-gated boundary keeps non-RTS users from
// creating Audio elements (which trigger a network fetch from the RTS asset
// CDN at mount) or opening tRPC subscriptions they'll never use.
function RtsActive() {
  useRtsPromptRouter();
  useRtsPrGraphRouter();
  return (
    <>
      <BgmPlayer />
      <SfxBridge />
    </>
  );
}

export function RtsRoot() {
  const rtsEnabled = useFeatureFlag(RTS_FLAG, import.meta.env.DEV);
  if (!rtsEnabled) return null;
  return <RtsActive />;
}
