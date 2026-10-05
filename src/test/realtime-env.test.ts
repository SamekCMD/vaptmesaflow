import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("frontend realtime opt-in", () => {
  it.each([undefined, "", "false", "TRUE", "1", " true "])(
    "keeps realtime disabled for %s", async (value) => {
      vi.stubEnv("VITE_REALTIME_ENABLED", value);
      vi.resetModules();
      const { ENV } = await import("@/lib/env");
      expect((ENV as { realtimeEnabled?: boolean }).realtimeEnabled).toBe(false);
    },
  );

  it("enables realtime only for literal true", async () => {
    vi.stubEnv("VITE_REALTIME_ENABLED", "true");
    vi.resetModules();
    const { ENV } = await import("@/lib/env");
    expect((ENV as { realtimeEnabled?: boolean }).realtimeEnabled).toBe(true);
  });
});
