import { registerRendererStateStorage } from "@posthog/ui/shell/rendererStorage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RECENT_CLOUD_REPOSITORIES_LIMIT,
  useSettingsStore,
} from "./settingsStore";

const getItem = vi.fn();
const setItem = vi.fn();
const removeItem = vi.fn();

registerRendererStateStorage({ getItem, setItem, removeItem });

describe("feature settingsStore cloud selections", () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    getItem.mockResolvedValue(null);
    setItem.mockResolvedValue(undefined);
    removeItem.mockResolvedValue(undefined);

    useSettingsStore.setState({
      allowBypassPermissions: false,
      lastUsedCloudRepository: null,
      recentCloudRepositories: [],
    });
  });

  it("persists the last used cloud repository", async () => {
    useSettingsStore.getState().setLastUsedCloudRepository("posthog/posthog");

    await vi.waitFor(() => {
      expect(setItem).toHaveBeenCalled();
    });

    const lastCall = setItem.mock.calls[setItem.mock.calls.length - 1];
    const persisted = JSON.parse(lastCall[1]);

    expect(persisted.state.lastUsedCloudRepository).toBe("posthog/posthog");
  });

  it("rehydrates the last used cloud repository", async () => {
    getItem.mockResolvedValue(
      JSON.stringify({
        state: {
          lastUsedCloudRepository: "posthog/posthog",
        },
        version: 0,
      }),
    );

    useSettingsStore.setState({
      lastUsedCloudRepository: null,
    });

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().lastUsedCloudRepository).toBe(
      "posthog/posthog",
    );
  });

  it("tracks recently used cloud repositories most-recent first", () => {
    const { addRecentCloudRepository } = useSettingsStore.getState();

    addRecentCloudRepository("posthog/posthog");
    addRecentCloudRepository("posthog/posthog-js");
    addRecentCloudRepository("PostHog/Code");

    expect(useSettingsStore.getState().recentCloudRepositories).toEqual([
      "posthog/code",
      "posthog/posthog-js",
      "posthog/posthog",
    ]);
  });

  it("dedupes and promotes a re-selected repository to the front", () => {
    const { addRecentCloudRepository } = useSettingsStore.getState();

    addRecentCloudRepository("posthog/posthog");
    addRecentCloudRepository("posthog/posthog-js");
    addRecentCloudRepository("posthog/posthog");

    expect(useSettingsStore.getState().recentCloudRepositories).toEqual([
      "posthog/posthog",
      "posthog/posthog-js",
    ]);
  });

  it("caps the recent repositories list", () => {
    const { addRecentCloudRepository } = useSettingsStore.getState();

    for (let i = 0; i < RECENT_CLOUD_REPOSITORIES_LIMIT + 3; i++) {
      addRecentCloudRepository(`posthog/repo-${i}`);
    }

    expect(useSettingsStore.getState().recentCloudRepositories).toHaveLength(
      RECENT_CLOUD_REPOSITORIES_LIMIT,
    );
  });

  it("rehydrates the unsafe mode toggle", async () => {
    getItem.mockResolvedValue(
      JSON.stringify({
        state: {
          allowBypassPermissions: true,
        },
        version: 0,
      }),
    );

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().allowBypassPermissions).toBe(true);
  });

  it.each([
    ["lastUsedWorkspaceMode", "local", "cloud"],
    ["debugLogsCloudRuns", false, true],
  ] as const)("rehydrates %s", async (field, initial, persisted) => {
    getItem.mockResolvedValue(
      JSON.stringify({ state: { [field]: persisted }, version: 0 }),
    );

    useSettingsStore.setState({ [field]: initial } as Parameters<
      typeof useSettingsStore.setState
    >[0]);

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState()[field]).toBe(persisted);
  });

  it("flips _hasHydrated once the persisted snapshot lands", async () => {
    getItem.mockResolvedValue(JSON.stringify({ state: {}, version: 0 }));

    useSettingsStore.setState({ _hasHydrated: false });

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState()._hasHydrated).toBe(true);
  });
});

describe("feature settingsStore terminal font", () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    getItem.mockResolvedValue(null);
    setItem.mockResolvedValue(undefined);
    removeItem.mockResolvedValue(undefined);

    useSettingsStore.setState({
      terminalFont: "berkeley-mono",
      terminalCustomFontFamily: "",
    });
  });

  it("defaults to berkeley-mono with no custom override", () => {
    expect(useSettingsStore.getState().terminalFont).toBe("berkeley-mono");
    expect(useSettingsStore.getState().terminalCustomFontFamily).toBe("");
  });

  it("persists terminal font selection and custom family", async () => {
    useSettingsStore.getState().setTerminalFont("custom");
    useSettingsStore.getState().setTerminalCustomFontFamily("Fira Code");

    await vi.waitFor(() => {
      expect(setItem).toHaveBeenCalled();
    });

    const lastCall = setItem.mock.calls[setItem.mock.calls.length - 1];
    const persisted = JSON.parse(lastCall[1]);

    expect(persisted.state.terminalFont).toBe("custom");
    expect(persisted.state.terminalCustomFontFamily).toBe("Fira Code");
  });

  it("rehydrates terminal font selection and custom family", async () => {
    getItem.mockResolvedValue(
      JSON.stringify({
        state: {
          terminalFont: "jetbrains-mono",
          terminalCustomFontFamily: "Cascadia Code",
        },
        version: 0,
      }),
    );

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().terminalFont).toBe("jetbrains-mono");
    expect(useSettingsStore.getState().terminalCustomFontFamily).toBe(
      "Cascadia Code",
    );
  });
});
