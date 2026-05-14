import { useAuthStateValue } from "@features/auth/hooks/authQueries";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { getCloudUrlFromRegion } from "@shared/utils/urls";
import { openUrlInBrowser } from "@utils/browser";

interface InsightFrameProps {
  shareToken: string;
  /** Optional fully-qualified PostHog URL for the "Open in PostHog" link
   *  rendered when the iframe fails to load. */
  posthogUrl?: string;
}

/** Embeds a PostHog insight via its sharing access token. PostHog renders
 *  `/embedded/{token}` without an X-Frame-Options header specifically for
 *  this use case, so an `<iframe>` is enough — no special sandbox needed. */
export function InsightFrame({ shareToken, posthogUrl }: InsightFrameProps) {
  const cloudRegion = useAuthStateValue((s) => s.cloudRegion);
  if (!cloudRegion) {
    return <ConnectPlaceholder posthogUrl={posthogUrl} />;
  }
  const cloudUrl = getCloudUrlFromRegion(cloudRegion);
  const embedUrl = `${cloudUrl}/embedded/${encodeURIComponent(shareToken)}?legend=false`;
  return (
    <Box className="relative h-full w-full overflow-hidden">
      <iframe
        src={embedUrl}
        title="PostHog insight"
        className="h-full w-full border-0"
        // PostHog embed needs to make its own API calls; allow-same-origin is
        // safe here because the source is a known posthog.com domain.
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
      />
    </Box>
  );
}

function ConnectPlaceholder({ posthogUrl }: { posthogUrl?: string }) {
  return (
    <Flex
      align="center"
      justify="center"
      direction="column"
      gap="2"
      className="h-full px-4 py-3 text-center text-(--gray-10) text-[12px]"
    >
      <Text as="span">Connect a PostHog project to load this insight.</Text>
      {posthogUrl && (
        <button
          type="button"
          onClick={() => openUrlInBrowser(posthogUrl)}
          className="inline-flex items-center gap-1 text-(--gray-11) hover:text-(--gray-12)"
        >
          Open in PostHog
          <ArrowSquareOut size={10} weight="bold" />
        </button>
      )}
    </Flex>
  );
}
