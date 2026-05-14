import { PaperPlaneRight } from "@phosphor-icons/react";
import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import { useCopilotStore } from "../store";

export function Copilot() {
  const sendUserMessage = useCopilotStore((s) => s.sendUserMessage);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendUserMessage(trimmed);
    setDraft("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="-translate-x-1/2 pointer-events-none fixed bottom-6 left-1/2 z-50">
      <form
        onSubmit={submit}
        style={{ backgroundColor: "#ffffff" }}
        className="pointer-events-auto flex w-160 max-w-[90vw] items-center gap-2 rounded-full border border-(--gray-5) px-5 py-2 shadow-2xl"
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask PostHog AI to find or do anything…"
          rows={1}
          className="max-h-32 min-h-6 flex-1 resize-none bg-transparent text-(--gray-12) text-[14px] leading-snug outline-none placeholder:text-(--gray-10)"
        />
        <button
          type="submit"
          disabled={draft.trim().length === 0}
          aria-label="Send message"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--accent-9) text-white transition-opacity hover:bg-(--accent-10) disabled:opacity-40"
        >
          <PaperPlaneRight size={14} weight="fill" />
        </button>
      </form>
    </div>
  );
}
