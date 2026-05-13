import { afterEach, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      version: "0.0.0-test",
    },
  },
}));

vi.mock("@/lib/logger", () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    scope: () => mockLogger,
  };

  return {
    logger: mockLogger,
  };
});

afterEach(() => {
  vi.clearAllMocks();
});
