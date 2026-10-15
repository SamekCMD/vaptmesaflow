import { describe, expect, it } from "vitest";
import { compareVersion, parseCatalogSignal } from "@/lib/catalog/contracts";

describe("public catalog wire contracts", () => {
  it("compares canonical decimal revisions without rounding or lexical ordering", () => {
    expect(compareVersion("9007199254740993", "9007199254740992")).toBe(1);
    expect(compareVersion("9", "10")).toBe(-1);
    expect(compareVersion("12", "12")).toBe(0);
    expect(compareVersion("9223372036854775807", "1")).toBe(1);
    for (const version of ["0", "01", "-1", "1e3", "1.0", " 1", "", "9223372036854775808"]) {
      expect(() => compareVersion(version, "1")).toThrow();
      expect(() => compareVersion("1", version)).toThrow();
    }
  });

  it("accepts only versioned ready/catalog_changed public frames", () => {
    const ready = { protocol: "vapt.catalog.v1", type: "ready", version: "9007199254740993" };
    const changed = { ...ready, type: "catalog_changed", canonicalSlug: "novo-bistro" };
    expect(parseCatalogSignal(JSON.stringify(ready))).toEqual(ready);
    expect(parseCatalogSignal(JSON.stringify(changed))).toEqual(changed);
    for (const extra of ["ownerId", "sessionId", "orderId", "cnpj", "email", "token"]) {
      expect(parseCatalogSignal(JSON.stringify({ ...ready, [extra]: "private" }))).toBeNull();
    }
    for (const frame of ["null", "[]", "{}", "invalid", JSON.stringify({ ...ready, type: "write" }),
      JSON.stringify({ ...ready, version: 12 }), JSON.stringify({ ...ready, protocol: "vapt.realtime.v1" }),
      JSON.stringify({ ...ready, canonicalSlug: "../other" })]) {
      expect(parseCatalogSignal(frame)).toBeNull();
    }
  });

  it("enforces the 512 byte limit before parsing, including UTF-8 bytes", () => {
    const ready = { protocol: "vapt.catalog.v1", type: "ready", version: "1" };
    const padded = JSON.stringify(ready).padEnd(512, " ");
    expect(parseCatalogSignal(padded)).toEqual(ready);
    expect(parseCatalogSignal(padded + " ")).toBeNull();
    expect(parseCatalogSignal(padded.slice(0, -1) + "é")).toBeNull();
  });
});
