import { getTeamMemberAvatar } from "@features/sessions/components/session-update/parseFileMentions";
import { UserIcon } from "@phosphor-icons/react";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@posthog/quill";
import type { SuggestionItem } from "../types";

export function TeamMemberSuggestionRow({ item }: { item: SuggestionItem }) {
  const avatar = getTeamMemberAvatar(item.id);
  return (
    <Item size="xs" className="border-0 p-0">
      <ItemMedia variant="icon" className="mt-0.5 self-start">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="size-5 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-5 items-center justify-center rounded-full bg-(--gray-4) text-(--gray-11)">
            <UserIcon size={12} weight="fill" />
          </span>
        )}
      </ItemMedia>
      <ItemContent variant="menuItem">
        <ItemTitle className="truncate text-left">{item.label}</ItemTitle>
        {item.description && (
          <ItemDescription className="truncate text-left">
            {item.description}
          </ItemDescription>
        )}
      </ItemContent>
    </Item>
  );
}
