import { describe, expect, it } from "vitest";

import {
  applyOperationMode,
  createSlug,
  getOperationMode,
  mapOnboardingSaveError,
  validateBasics,
  validateOperation,
} from "@/features/onboarding/onboarding-form";

describe("onboarding form", () => {
  it("validates required restaurant basics", () => {
    expect(validateBasics({ name: "", slug: "" })).toEqual({
      name: "Informe o nome do restaurante.",
      slug: "Informe o endereço do cardápio.",
    });
  });

  it("normalizes a restaurant name into a public slug", () => {
    expect(createSlug("  Café do João  ")).toBe("cafe-do-joao");
  });

  it("maps operation flags and rejects an empty mode", () => {
    expect(getOperationMode(true, false)).toBe("local");
    expect(getOperationMode(false, true)).toBe("delivery");
    expect(getOperationMode(true, true)).toBe("both");
    expect(applyOperationMode("delivery")).toEqual({
      localEnabled: false,
      deliveryEnabled: true,
    });
    expect(validateOperation({
      localEnabled: false,
      deliveryEnabled: false,
      totalTables: 1,
    })).toHaveProperty("operationMode");
  });

  it("requires a positive table count only for local operation", () => {
    expect(validateOperation({
      localEnabled: true,
      deliveryEnabled: false,
      totalTables: 0,
    })).toHaveProperty("totalTables");
    expect(validateOperation({
      localEnabled: false,
      deliveryEnabled: true,
      totalTables: 0,
    })).toEqual({});
  });

  it("maps a Postgres unique conflict to the slug field", () => {
    expect(mapOnboardingSaveError({ code: "23505" })).toEqual({
      field: "slug",
      message: "Este endereço de cardápio já está em uso.",
    });
  });
});
