import { afterEach, describe, expect, test, vi } from "vitest";

import { VaptApiClientError, vaptApiRequest } from "@/lib/vapt-api-client";

describe("vaptApiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("authenticated API requests use cookies without Supabase bearer tokens", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchSpy);

    await vaptApiRequest({ method: "GET", route: "/restaurants/me" });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.test.example.com/restaurants/me",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      }),
    );
  });

  test("server 401 responses retain the invalid session error contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "unauthorized", message: "Sessão inválida. Faça login novamente." },
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })));

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
