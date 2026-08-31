import { afterEach, describe, expect, it, vi } from "vitest";

import { n8nClient } from "@/lib/n8n-client";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { access_token: "access-token" } } }),
    },
  },
}));

describe("n8n subscription client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends organization ownership with the compatibility restaurant id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            clientSecret: "seti_test",
            subscriptionId: "sub-1",
            customerId: "cus-1",
            autoCharged: false,
          }),
        ),
    });
    vi.stubGlobal("fetch", fetchMock);

    await n8nClient.stripe.createSubscription({
      organizationId: "organization-1",
      restaurantId: "restaurant-1",
      email: "owner@vapt.test",
      planType: "pro",
      priceId: "price-pro",
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody).toMatchObject({
      organizationId: "organization-1",
      restaurantId: "restaurant-1",
    });
  });
});
