import type { IMainWindow } from "@posthog/platform/main-window";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/logger.js", () => ({
  logger: {
    scope: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

import type { DeepLinkHandler, DeepLinkService } from "../deep-link/service";
import { NewTaskLinkEvent, NewTaskLinkService } from "./service";

function makeDeepLinkService() {
  const handlers = new Map<string, DeepLinkHandler>();
  const service = {
    registerHandler: vi.fn((key: string, handler: DeepLinkHandler) => {
      handlers.set(key, handler);
    }),
    trigger: (key: string, params = new URLSearchParams()) => {
      const handler = handlers.get(key);
      if (!handler) throw new Error(`No handler for ${key}`);
      return handler("", params);
    },
  };
  return service as unknown as DeepLinkService & {
    trigger: (key: string, params?: URLSearchParams) => boolean;
  };
}

function makeMainWindow() {
  return {
    focus: vi.fn(),
    restore: vi.fn(),
    isMinimized: vi.fn().mockReturnValue(false),
  } as unknown as IMainWindow & {
    focus: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    isMinimized: ReturnType<typeof vi.fn>;
  };
}

describe("NewTaskLinkService", () => {
  let deepLinkService: ReturnType<typeof makeDeepLinkService>;
  let mainWindow: ReturnType<typeof makeMainWindow>;
  let service: NewTaskLinkService;

  beforeEach(() => {
    deepLinkService = makeDeepLinkService();
    mainWindow = makeMainWindow();
    service = new NewTaskLinkService(deepLinkService, mainWindow);
  });

  it("registers a 'new' handler on the DeepLinkService", () => {
    expect(deepLinkService.registerHandler).toHaveBeenCalledWith(
      "new",
      expect.any(Function),
    );
  });

  it("emits OpenNewTask when a listener is attached", () => {
    const listener = vi.fn();
    service.on(NewTaskLinkEvent.OpenNewTask, listener);

    const result = deepLinkService.trigger(
      "new",
      new URLSearchParams({ prompt: "Fix this issue" }),
    );

    expect(result).toBe(true);
    expect(listener).toHaveBeenCalledWith({ prompt: "Fix this issue" });
  });

  it("queues a pending deep link when no listener is attached", () => {
    deepLinkService.trigger(
      "new",
      new URLSearchParams({ prompt: "Fix this later" }),
    );

    expect(service.consumePendingDeepLink()).toEqual({
      prompt: "Fix this later",
    });
    expect(service.consumePendingDeepLink()).toBeNull();
  });

  it("returns false when prompt is missing", () => {
    const listener = vi.fn();
    service.on(NewTaskLinkEvent.OpenNewTask, listener);

    const result = deepLinkService.trigger("new");

    expect(result).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it("returns false when prompt is blank", () => {
    const result = deepLinkService.trigger(
      "new",
      new URLSearchParams({ prompt: "   " }),
    );

    expect(result).toBe(false);
  });

  it("focuses the main window on link arrival", () => {
    deepLinkService.trigger(
      "new",
      new URLSearchParams({ prompt: "Fix this issue" }),
    );

    expect(mainWindow.focus).toHaveBeenCalledTimes(1);
    expect(mainWindow.restore).not.toHaveBeenCalled();
  });

  it("restores the main window when it is minimized", () => {
    mainWindow.isMinimized.mockReturnValue(true);

    deepLinkService.trigger(
      "new",
      new URLSearchParams({ prompt: "Fix this issue" }),
    );

    expect(mainWindow.restore).toHaveBeenCalledTimes(1);
    expect(mainWindow.focus).toHaveBeenCalledTimes(1);
  });
});
