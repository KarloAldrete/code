import { GithubRefChip } from "@features/editor/components/GithubRefChip";
import {
  baseComponents,
  defaultRemarkPlugins,
} from "@features/editor/components/MarkdownRenderer";
import { File, User, Warning } from "@phosphor-icons/react";
import { Text } from "@radix-ui/themes";
import { unescapeXmlAttr } from "@utils/xml";
import type { ReactNode } from "react";
import { memo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";

const MENTION_TAG_REGEX =
  /<file\s+path="([^"]+)"\s*\/>|<(github_issue|github_pr)\s+number="([^"]+)"(?:\s+title="([^"]*)")?(?:\s+url="([^"]*)")?\s*\/>|<error_context\s+label="([^"]*)">[\s\S]*?<\/error_context>|<team_member\s+uuid="([^"]+)"\s+name="([^"]+)"\s*\/>/g;
const MENTION_TAG_TEST =
  /<(?:file\s+path|github_issue\s+number|github_pr\s+number|error_context\s+label|team_member\s+uuid)="[^"]+"/;
const TEAM_MEMBER_TAG_REGEX =
  /<team_member\s+uuid="([^"]+)"\s+name="([^"]+)"\s*\/>/g;
const SLASH_COMMAND_START = /^\/([a-zA-Z][\w-]*)(?=\s|$)/;

export interface TeamMemberRef {
  uuid: string;
  name: string;
  avatar?: string;
}

export function extractTeamMembers(content: string): TeamMemberRef[] {
  const seen = new Set<string>();
  const members: TeamMemberRef[] = [];
  for (const match of content.matchAll(TEAM_MEMBER_TAG_REGEX)) {
    const uuid = unescapeXmlAttr(match[1]);
    if (seen.has(uuid)) continue;
    seen.add(uuid);
    members.push({
      uuid,
      name: unescapeXmlAttr(match[2]),
      avatar: getTeamMemberAvatar(uuid),
    });
  }
  return members;
}

// HACKATHON SHORTCUT — until we have a real /api/profiles endpoint, the
// stub-org-member uuids are their emails. Map them to the small face avatars
// from posthog.com/teams. Keep in sync with STUB_ORG_MEMBERS.
interface StubMember {
  name: string;
  avatar: string;
}
const STUB_TEAM_MEMBERS: Record<string, StubMember> = {
  "james@posthog.com": {
    name: "James Hawkins",
    avatar:
      "https://res.cloudinary.com/dmukukwp6/image/upload/v1738943658/James_H_5cb4c53d9a.png",
  },
  "joe@posthog.com": {
    name: "Joe Martin",
    avatar:
      "https://res.cloudinary.com/dmukukwp6/image/upload/v1688578142/joe_5c087079c2.png",
  },
  "charles@posthog.com": {
    name: "Charles Cook",
    avatar:
      "https://res.cloudinary.com/dmukukwp6/image/upload/v1688579622/charles_525b6ac4e2.png",
  },
  "andy@posthog.com": {
    name: "Andy Vandervell",
    avatar:
      "https://res.cloudinary.com/dmukukwp6/image/upload/v1695024176/andy_86a7232754.png",
  },
  "cleo@posthog.com": {
    name: "Cleo Lant",
    avatar:
      "https://res.cloudinary.com/dmukukwp6/image/upload/v1761768467/Cleo_s_Portrait_1_e0d9ac23b6.png",
  },
};

export function getTeamMemberAvatar(uuid: string): string | undefined {
  return STUB_TEAM_MEMBERS[uuid.toLowerCase()]?.avatar;
}

export function getTeamMemberDisplay(uuid: string): {
  name: string;
  avatar?: string;
} {
  const entry = STUB_TEAM_MEMBERS[uuid.toLowerCase()];
  if (entry) return entry;
  // Fallback: derive a display name from email-style uuids.
  const base = uuid.split("@")[0] ?? uuid;
  const name = base.charAt(0).toUpperCase() + base.slice(1);
  return { name };
}

export function listKnownTeamMembers(): Array<{
  uuid: string;
  name: string;
  avatar: string;
}> {
  return Object.entries(STUB_TEAM_MEMBERS).map(([uuid, { name, avatar }]) => ({
    uuid,
    name,
    avatar,
  }));
}

const inlineComponents: Components = {
  ...baseComponents,
  p: ({ children }) => (
    <Text as="span" color="gray" highContrast className="text-[13px]">
      {children}
    </Text>
  ),
};

export const InlineMarkdown = memo(function InlineMarkdown({
  content,
}: {
  content: string;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={defaultRemarkPlugins}
      components={inlineComponents}
    >
      {content}
    </ReactMarkdown>
  );
});

export function hasMentionTags(content: string): boolean {
  return MENTION_TAG_TEST.test(content) || SLASH_COMMAND_START.test(content);
}

export const hasFileMentions = hasMentionTags;

const chipClass =
  "inline-flex min-w-0 max-w-full items-center gap-1 rounded-[var(--radius-1)] bg-[var(--accent-a3)] px-1 py-px align-middle font-medium text-[var(--accent-11)]";

export function MentionChip({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  const style = { margin: "0 2px" };

  const content = (
    <>
      {icon}
      <span className="truncate">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`${chipClass} cursor-pointer border-none text-[13px]`}
        onClick={onClick}
        style={style}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={`${chipClass} text-[13px]`} style={style}>
      {content}
    </span>
  );
}

export function parseMentionTags(content: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  const slashMatch = content.match(SLASH_COMMAND_START);
  if (slashMatch) {
    parts.push(
      <MentionChip key="slash-cmd" icon={null} label={`/${slashMatch[1]}`} />,
    );
    lastIndex = slashMatch[0].length;
  }

  for (const match of content.matchAll(MENTION_TAG_REGEX)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex < lastIndex) continue;

    if (matchIndex > lastIndex) {
      parts.push(
        <InlineMarkdown
          key={`text-${lastIndex}`}
          content={content.slice(lastIndex, matchIndex)}
        />,
      );
    }

    if (match[1]) {
      const filePath = unescapeXmlAttr(match[1]);
      const segments = filePath.split("/").filter(Boolean);
      const fileName = segments.pop() ?? filePath;
      const parentDir = segments.pop();
      const label = parentDir ? `${parentDir}/${fileName}` : fileName;
      parts.push(
        <MentionChip
          key={`file-${matchIndex}`}
          icon={<File size={12} />}
          label={label}
        />,
      );
    } else if (match[2]) {
      const kind = match[2] === "github_pr" ? "pr" : "issue";
      const issueNumber = match[3];
      const issueTitle = match[4] ? unescapeXmlAttr(match[4]) : undefined;
      const issueUrl = match[5] ? unescapeXmlAttr(match[5]) : "";
      const label = issueTitle
        ? `#${issueNumber} - ${issueTitle}`
        : `#${issueNumber}`;
      parts.push(
        <GithubRefChip
          key={`${match[2]}-${matchIndex}`}
          href={issueUrl}
          kind={kind}
        >
          {label}
        </GithubRefChip>,
      );
    } else if (match[6]) {
      parts.push(
        <MentionChip
          key={`error-ctx-${matchIndex}`}
          icon={<Warning size={12} />}
          label={unescapeXmlAttr(match[6])}
        />,
      );
    } else if (match[8]) {
      const uuid = unescapeXmlAttr(match[7]);
      const name = unescapeXmlAttr(match[8]);
      const avatar = getTeamMemberAvatar(uuid);
      parts.push(
        <MentionChip
          key={`team-${matchIndex}`}
          icon={
            avatar ? (
              <img
                src={avatar}
                alt=""
                className="size-3.5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <User size={12} weight="fill" />
            )
          }
          label={`@${name}`}
        />,
      );
    }

    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(
      <InlineMarkdown
        key={`text-${lastIndex}`}
        content={content.slice(lastIndex)}
      />,
    );
  }

  return parts;
}

export const parseFileMentions = parseMentionTags;
