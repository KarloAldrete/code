import { useExtensionsStore } from "@features/extensions/stores/extensionsStore";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExtensionView } from "./ExtensionView";

const toastInfoMock = vi.hoisted(() => vi.fn());
const toastWarningMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const logInfoMock = vi.hoisted(() => vi.fn());
const handleViewMessageMock = vi.hoisted(() => vi.fn());

vi.mock("@renderer/trpc/client", () => ({
  trpcClient: {
    extensions: {
      handleViewMessage: {
        mutate: handleViewMessageMock,
      },
    },
  },
}));

vi.mock("@utils/toast", () => ({
  toast: {
    info: toastInfoMock,
    warning: toastWarningMock,
    error: toastErrorMock,
  },
}));

vi.mock("@utils/logger", () => ({
  logger: {
    scope: () => ({
      info: logInfoMock,
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

function setExtensionSidebarItem(sidebarItem: {
  id: string;
  title: string;
  entry?: string;
  url?: string;
  html?: string;
}): void {
  useExtensionsStore.getState().actions.setExtensions([
    {
      id: "demo-extension",
      name: "demo-extension",
      displayName: "Demo Extension",
      version: "1.0.0",
      installPath: "/extensions/demo-extension",
      commands: [],
      prompts: [],
      sidebar: [
        {
          extensionId: "demo-extension",
          location: "sidebar",
          ...sidebarItem,
        },
      ],
      statusBar: [],
      skillCount: 0,
      loadErrors: [],
    },
  ]);
}

describe("ExtensionView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExtensionsStore.getState().actions.clear();
  });

  it("renders sandboxed iframe for installed sidebar contribution", () => {
    setExtensionSidebarItem({
      id: "demo-extension.dashboard",
      title: "Dashboard",
      entry: "frontend/index.html",
      url: "file:///extensions/demo-extension/frontend/index.html",
    });

    render(<ExtensionView sidebarItemId="demo-extension.dashboard" />);

    const frame = screen.getByTitle("Dashboard");
    expect(frame).toHaveAttribute(
      "src",
      "file:///extensions/demo-extension/frontend/index.html",
    );
    expect(frame).toHaveAttribute(
      "sandbox",
      "allow-forms allow-popups allow-scripts",
    );
  });

  it("renders runtime inline html views with srcDoc", () => {
    setExtensionSidebarItem({
      id: "demo-extension.inline",
      title: "Inline View",
      html: "<h1>Inline</h1>",
    });

    render(<ExtensionView sidebarItemId="demo-extension.inline" />);

    const frame = screen.getByTitle("Inline View");
    expect(frame).toHaveAttribute("srcdoc", "<h1>Inline</h1>");
    expect(frame).not.toHaveAttribute("src");
  });

  it("responds to ready bridge messages from the matching iframe", () => {
    setExtensionSidebarItem({
      id: "demo-extension.inline",
      title: "Inline View",
      html: "<h1>Inline</h1>",
    });
    render(<ExtensionView sidebarItemId="demo-extension.inline" />);
    const frame = screen.getByTitle("Inline View") as HTMLIFrameElement;
    const postMessage = vi
      .spyOn(frame.contentWindow as Window, "postMessage")
      .mockImplementation(() => {});

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "posthogCode.ready", version: 1 },
        source: frame.contentWindow,
      }),
    );

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "posthogCode.hostReady",
        version: 1,
        extensionId: "demo-extension",
        viewId: "demo-extension.inline",
        location: "sidebar",
        repoPath: null,
        theme: "light",
      },
      "*",
    );
  });

  it("forwards bridge request messages to the extension runtime", async () => {
    setExtensionSidebarItem({
      id: "demo-extension.inline",
      title: "Inline View",
      html: "<h1>Inline</h1>",
    });
    handleViewMessageMock.mockResolvedValue({
      handled: true,
      payload: { ok: true },
    });
    render(<ExtensionView sidebarItemId="demo-extension.inline" />);
    const frame = screen.getByTitle("Inline View") as HTMLIFrameElement;
    const postMessage = vi
      .spyOn(frame.contentWindow as Window, "postMessage")
      .mockImplementation(() => {});

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "posthogCode.request",
          requestId: "request-1",
          payload: { type: "demo" },
        },
        source: frame.contentWindow,
      }),
    );

    await waitFor(() => {
      expect(handleViewMessageMock).toHaveBeenCalledWith({
        viewId: "demo-extension.inline",
        message: { type: "demo" },
        repoPath: null,
      });
    });
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "posthogCode.response",
        requestId: "request-1",
        ok: true,
        payload: { ok: true },
      },
      "*",
    );
  });

  it("handles notify and log bridge messages from the matching iframe only", () => {
    setExtensionSidebarItem({
      id: "demo-extension.inline",
      title: "Inline View",
      html: "<h1>Inline</h1>",
    });
    render(<ExtensionView sidebarItemId="demo-extension.inline" />);
    const frame = screen.getByTitle("Inline View") as HTMLIFrameElement;

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "posthogCode.notify",
          level: "info",
          message: "Loaded",
        },
        source: frame.contentWindow,
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "posthogCode.log",
          level: "info",
          message: "View log",
          data: { ok: true },
        },
        source: frame.contentWindow,
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "posthogCode.notify",
          level: "info",
          message: "Wrong source",
        },
        source: window,
      }),
    );

    expect(toastInfoMock).toHaveBeenCalledTimes(1);
    expect(toastInfoMock).toHaveBeenCalledWith("Loaded");
    expect(logInfoMock).toHaveBeenCalledWith("View log", {
      extensionId: "demo-extension",
      viewId: "demo-extension.inline",
      data: { ok: true },
    });
  });

  it("shows not found after sidebar contribution is removed", () => {
    render(<ExtensionView sidebarItemId="missing.dashboard" />);

    expect(screen.getByText("Extension view not found")).toBeInTheDocument();
  });
});
