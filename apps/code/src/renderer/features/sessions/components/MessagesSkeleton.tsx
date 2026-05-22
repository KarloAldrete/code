import { Flex } from "@radix-ui/themes";
import { CHAT_CONTENT_MAX_WIDTH } from "../constants";

function UserBubble({ widthClass }: { widthClass: string }) {
  return (
    <Flex justify="end" className="px-2 py-1.5">
      <div className={`h-9 rounded-2xl bg-(--gray-3) ${widthClass}`} />
    </Flex>
  );
}

function AssistantLines({ widths }: { widths: string[] }) {
  return (
    <Flex direction="column" gap="2" className="px-2 py-2">
      {widths.map((w) => (
        <div key={w} className={`h-3 rounded-md bg-(--gray-4) ${w}`} />
      ))}
    </Flex>
  );
}

export function MessagesSkeleton() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-background">
      <div
        className="mx-auto animate-pulse pt-6"
        style={{ maxWidth: CHAT_CONTENT_MAX_WIDTH }}
      >
        <UserBubble widthClass="w-1/2" />
        <AssistantLines widths={["w-full", "w-11/12", "w-2/3"]} />
        <UserBubble widthClass="w-1/3" />
        <AssistantLines widths={["w-5/6", "w-full", "w-3/5", "w-2/5"]} />
      </div>
    </div>
  );
}
