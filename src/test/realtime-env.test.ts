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

describe("public catalog events opt-in is independent of private realtime", () => {
  it.each([undefined, "false", "TRUE", "1", " true "])("defaults disabled for %s", async value => {
    vi.stubEnv("VITE_PUBLIC_CATALOG_EVENTS_ENABLED", value); vi.stubEnv("VITE_REALTIME_ENABLED", "true"); vi.resetModules();
    const { ENV } = await import("@/lib/env"); expect((ENV as { publicCatalogEventsEnabled?: boolean }).publicCatalogEventsEnabled).toBe(false);
  });
  it("enables only for literal true", async () => {
    vi.stubEnv("VITE_PUBLIC_CATALOG_EVENTS_ENABLED", "true"); vi.resetModules();
    const { ENV } = await import("@/lib/env"); expect((ENV as { publicCatalogEventsEnabled?: boolean }).publicCatalogEventsEnabled).toBe(true);
  });
});

describe("catalog writer can remain enabled during reader rollback", () => {
  it.each([undefined, "false", "TRUE", "1", " true "])("defaults writer disabled for %s", async value => {
    vi.stubEnv("VITE_PUBLIC_CATALOG_EVENTS_ENABLED", "false"); vi.stubEnv("VITE_PUBLIC_CATALOG_WRITER_ENABLED", value); vi.resetModules();
    const { ENV } = await import("@/lib/env"); expect(ENV).toHaveProperty("publicCatalogWriterEnabled", false);
  });
  it("supports reader off and writer on independently", async () => {
    vi.stubEnv("VITE_PUBLIC_CATALOG_EVENTS_ENABLED", "false"); vi.stubEnv("VITE_PUBLIC_CATALOG_WRITER_ENABLED", "true"); vi.resetModules();
    const { ENV } = await import("@/lib/env"); expect(ENV.publicCatalogEventsEnabled).toBe(false); expect(ENV).toHaveProperty("publicCatalogWriterEnabled", true);
  });
});
