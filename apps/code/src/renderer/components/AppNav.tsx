import { useInboxSignalCount } from "@features/inbox/hooks/useInboxSignalCount";
import { CodeIcon, HashIcon, TrayIcon } from "@phosphor-icons/react";
import { Badge, Button } from "@posthog/quill";
import { Box, Flex } from "@radix-ui/themes";
import { useNavigate, useRouterState } from "@tanstack/react-router";

type AppNavItem = {
  id: "code" | "inbox" | "channels";
  label: string;
  icon: typeof CodeIcon;
  to: "/code" | "/inbox" | "/website";
  isActive: (pathname: string) => boolean;
};

// Slack-like app rail switching between top-level "spaces": Code (the existing
// task app), Inbox (the full-screen inbox), and Channels (the website space with
// its channel list + dashboards). Gated behind project-bluebird in __root.
const NAV_ITEMS: AppNavItem[] = [
  {
    id: "code",
    label: "Code",
    icon: CodeIcon,
    to: "/code",
    isActive: (pathname) =>
      pathname === "/code" || pathname.startsWith("/code/"),
  },
  {
    id: "inbox",
    label: "Inbox",
    icon: TrayIcon,
    to: "/inbox",
    isActive: (pathname) => pathname === "/inbox",
  },
  {
    id: "channels",
    label: "Channels",
    icon: HashIcon,
    to: "/website",
    isActive: (pathname) =>
      pathname === "/website" || pathname.startsWith("/website/"),
  },
];

function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function AppNav() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inboxCount = useInboxSignalCount();

  return (
    <Flex
      direction="column"
      align="center"
      gap="2"
      className="drag h-full shrink-0 border-gray-6 border-r bg-gray-2 px-2 pt-10 pb-2"
    >
      {NAV_ITEMS.map((item) => {
        const active = item.isActive(pathname);
        const Icon = item.icon;
        const badgeCount = item.id === "inbox" ? inboxCount : 0;
        return (
          <Box key={item.id} position="relative" className="no-drag">
            <Button
              size="icon-lg"
              variant="default"
              aria-selected={active}
              aria-label={item.label}
              title={item.label}
              onClick={() => navigate({ to: item.to })}
            >
              <Icon size={20} weight="regular" />
            </Button>
            {badgeCount > 0 && (
              <Badge
                variant="destructive"
                className="-top-1 -right-1 pointer-events-none absolute min-w-4 justify-center rounded-full px-1 tabular-nums"
                title={`${badgeCount} actionable report${badgeCount === 1 ? "" : "s"}`}
              >
                {formatBadgeCount(badgeCount)}
              </Badge>
            )}
          </Box>
        );
      })}
    </Flex>
  );
}
