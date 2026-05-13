import { trpcClient } from "@renderer/trpc/client";
import { useEffect, useState } from "react";

const cache = new Map<string, string>();

export function useChatDir(chatId: string | null): string | null {
  const [dir, setDir] = useState<string | null>(
    chatId ? (cache.get(chatId) ?? null) : null,
  );

  useEffect(() => {
    if (!chatId) {
      setDir(null);
      return;
    }
    const cached = cache.get(chatId);
    if (cached) {
      setDir(cached);
      return;
    }
    let cancelled = false;
    trpcClient.os.getChatDir
      .query({ chatId })
      .then((path) => {
        cache.set(chatId, path);
        if (!cancelled) setDir(path);
      })
      .catch(() => {
        if (!cancelled) setDir(null);
      });
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  return dir;
}

export async function resolveChatDir(chatId: string): Promise<string> {
  const cached = cache.get(chatId);
  if (cached) return cached;
  const path = await trpcClient.os.getChatDir.query({ chatId });
  cache.set(chatId, path);
  return path;
}
