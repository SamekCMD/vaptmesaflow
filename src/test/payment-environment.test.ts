import { describe, expect, it } from "vitest";

import { ENV } from "@/lib/env";

describe("ambiente do provedor de pagamentos", () => {
  it("usa produção quando o deploy não define um ambiente diferente", () => {
    expect(ENV.paymentEnvironment).toBe("production");
  });
});
