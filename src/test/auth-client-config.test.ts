import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAuthClient } = vi.hoisted(() => ({
  createAuthClient: vi.fn(() => ({ client: "better-auth" })),
}));

vi.mock("better-auth/react", () => ({ createAuthClient }));

describe("cliente Better Auth", () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthClient.mockClear();
  });

  it("usa a API do Vapt e envia cookies em todas as requisições", async () => {
    const { authClient } = await import("@/lib/auth-client");

    expect(createAuthClient).toHaveBeenCalledWith({
      baseURL: "https://api.test.example.com",
      fetchOptions: { credentials: "include" },
    });
    expect(authClient).toEqual({ client: "better-auth" });
  });
});
