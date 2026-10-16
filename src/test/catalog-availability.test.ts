import { describe, expect, it } from "vitest";
import { isCatalogWithinHours, nextCatalogAvailabilityBoundary } from "@/lib/catalog/availability";
describe("local catalog availability clock", () => {
  it("applies inclusive local minute windows, including overnight and one-sided schedules", () => {
    expect(isCatalogWithinHours(null, null, new Date(2026, 9, 16, 11, 0))).toBe(true);
    expect(isCatalogWithinHours("12:00", "12:00", new Date(2026, 9, 16, 12, 0, 59))).toBe(true);
    expect(isCatalogWithinHours("12:00", "12:00", new Date(2026, 9, 16, 12, 1))).toBe(false);
    expect(isCatalogWithinHours("23:00", "02:00", new Date(2026, 9, 16, 1, 0))).toBe(true);
    expect(isCatalogWithinHours("23:00", "02:00", new Date(2026, 9, 16, 14, 0))).toBe(false);
    expect(isCatalogWithinHours("12:00", null, new Date(2026, 9, 16, 0, 0))).toBe(false);
    expect(isCatalogWithinHours(null, "12:00", new Date(2026, 9, 16, 0, 0))).toBe(true);
  });
  it("has no recurring timer for unrestricted items", () => {
    expect(nextCatalogAvailabilityBoundary([{ availableFrom: null, availableUntil: null }], new Date(2026, 9, 16, 11, 59))).toBeNull();
  });
  it("schedules opening and inclusive last minute closing, not periodic refresh", () => {
    const items = [{ availableFrom: "12:00", availableUntil: "12:00" }];
    expect(nextCatalogAvailabilityBoundary(items, new Date(2026, 9, 16, 11, 59, 30))).toEqual(new Date(2026, 9, 16, 12, 0));
    expect(nextCatalogAvailabilityBoundary(items, new Date(2026, 9, 16, 12, 0))).toEqual(new Date(2026, 9, 16, 12, 1));
  });
  it("midnight resets single-sided windows and handles overnight ranges", () => {
    expect(nextCatalogAvailabilityBoundary([{ availableFrom: "10:00" }], new Date(2026, 9, 16, 23, 0))).toEqual(new Date(2026, 9, 17, 0, 0));
    expect(nextCatalogAvailabilityBoundary([{ availableFrom: "23:00", availableUntil: "02:00" }], new Date(2026, 9, 16, 23, 30))).toEqual(new Date(2026, 9, 17, 0, 0));
  });
});
