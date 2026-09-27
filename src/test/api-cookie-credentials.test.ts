import { afterEach, describe, expect, it, vi } from "vitest";
import { n8nClient } from "@/lib/n8n-client";
import { VaptApiClientError, vaptApiRequest } from "@/lib/vapt-api-client";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("transporte de autenticação por cookie", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("inclui cookies em chamadas protegidas sem construir bearer token", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchSpy);

    await vaptApiRequest({ method: "GET", route: "/restaurants/me" });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.test.example.com/restaurants/me",
      expect.objectContaining({
        credentials: "include",
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      }),
    );
  });

  it("omite cookies em chamadas explicitamente públicas", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ restaurant: null, items: [] }));
    vi.stubGlobal("fetch", fetchSpy);

    await vaptApiRequest({
      method: "GET",
      route: "/public/restaurants/vapt/catalog",
      requireAuth: false,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.test.example.com/public/restaurants/vapt/catalog",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("mantém clientes protegidos derivados, como n8n, no transporte por cookie", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({
      planType: "starter",
      planStatus: "active",
      trialEndsAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    }));
    vi.stubGlobal("fetch", fetchSpy);

    await n8nClient.stripe.getSubscriptionStatus("restaurant-1");

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("billing/stripe/subscription"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("preserva o erro tipado para resposta 401 do servidor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: {
        code: "unauthorized",
        message: "Sessão inválida. Faça login novamente.",
      },
    }, 401)));

    await expect(vaptApiRequest({
      method: "GET",
      route: "/restaurants/me",
    })).rejects.toEqual(expect.objectContaining<VaptApiClientError>({
      code: "unauthorized",
      message: "Sessão inválida. Faça login novamente.",
      status: 401,
    }));
  });
});
