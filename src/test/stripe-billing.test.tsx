import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { billingClient, redirectToBilling } from "@/lib/billing-client";
import { VaptApiClientError } from "@/lib/vapt-api-client";
import SubscriptionPage from "@/pages/dashboard/SubscriptionPage";

const state = vi.hoisted(() => ({ planType: "starter", planStatus: "expired", isTrialing: false,
  trialDaysLeft: 0, restaurantId: "restaurant-1", loading: false, canManageBilling: false,
  canStartCheckout: true, requiresBillingAction: false, refetch: vi.fn() }));
vi.mock("@/hooks/useSubscription", () => ({ useSubscription: () => state }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "owner-1", email: "owner@example.com" } }) }));
vi.mock("@/lib/billing-client", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/billing-client")>(), redirectToBilling: vi.fn(),
}));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});
const checkout = { checkoutSessionId: "cs_test_vapt", url: "https://checkout.stripe.com/c/pay/vapt" };
beforeEach(() => {
  Object.assign(state, { planType: "starter", planStatus: "expired", isTrialing: false, canManageBilling: false,
    canStartCheckout: true, requiresBillingAction: false, loading: false });
  vi.clearAllMocks(); window.history.replaceState({}, "", "/dashboard/subscription");
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("cliente de cobrança hospedada", () => {
  it("usa cookies, UUID Idempotency-Key e apenas os campos permitidos", async () => {
    const fetchSpy = vi.fn().mockImplementation(async () => response(checkout)); vi.stubGlobal("fetch", fetchSpy);
    await billingClient.createCheckout({ restaurantId: "restaurant-1", planType: "pro" });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.test.example.com/billing/stripe/checkout");
    expect(init.credentials).toBe("include");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ restaurantId: "restaurant-1", planType: "pro" });
  });
  it("novo clique tem chave nova; Portal tem corpo restrito", async () => {
    const fetchSpy = vi.fn().mockImplementation(async () => response(checkout)); vi.stubGlobal("fetch", fetchSpy);
    await billingClient.createCheckout({ restaurantId: "restaurant-1", planType: "pro" });
    await billingClient.createCheckout({ restaurantId: "restaurant-1", planType: "pro" });
    expect(fetchSpy.mock.calls[0][1].headers["Idempotency-Key"]).not.toBe(fetchSpy.mock.calls[1][1].headers["Idempotency-Key"]);
    fetchSpy.mockResolvedValue(response({ url: "https://billing.stripe.com/p/session/vapt" }));
    await billingClient.createPortal("restaurant-1");
    expect(fetchSpy.mock.calls[2][0]).toContain("/billing/stripe/portal");
    expect(JSON.parse(fetchSpy.mock.calls[2][1].body)).toEqual({ restaurantId: "restaurant-1" });
  });
  it("recusa redirecionamentos inseguros ou de outro provedor", async () => {
    for (const url of ["http://checkout.stripe.com/vapt", "javascript:alert(1)", "https://evil.example/vapt", "https://user:secret@checkout.stripe.com/vapt"]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ...checkout, url })));
      await expect(billingClient.createCheckout({ restaurantId: "restaurant-1", planType: "pro" })).rejects.toMatchObject({ code: "invalid_billing_response" });
    }
  });
  it("preserva erros tipados do provedor e 401/409/503", async () => {
    for (const status of [401, 409, 503]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: { code: "billing_conflict", message: "Tente novamente" } }, status)));
      await expect(billingClient.createPortal("restaurant-1")).rejects.toEqual(expect.objectContaining({ code: "billing_conflict", status }));
    }
  });
});
describe("página de assinatura", () => {
  it("plano inativo redireciona para Checkout, sem declarar ativação", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(checkout))); render(<SubscriptionPage />);
    fireEvent.click(screen.getByRole("button", { name: "Assinar Pro" }));
    await waitFor(() => expect(redirectToBilling).toHaveBeenCalledWith(checkout.url));
    expect(state.planStatus).toBe("expired"); expect(state.refetch).not.toHaveBeenCalled();
  });
  it("plano ativo gerencia pelo Portal, não por change/cancel locais", async () => {
    Object.assign(state, { planStatus: "active", canManageBilling: true, canStartCheckout: false });
    const fetchSpy = vi.fn().mockResolvedValue(response({ url: "https://billing.stripe.com/p/session/vapt" })); vi.stubGlobal("fetch", fetchSpy);
    render(<SubscriptionPage />); fireEvent.click(screen.getByRole("button", { name: "Gerenciar cobrança" }));
    await waitFor(() => expect(redirectToBilling).toHaveBeenCalledWith("https://billing.stripe.com/p/session/vapt"));
    expect(fetchSpy.mock.calls[0][0]).toContain("/billing/stripe/portal");
    expect(screen.queryByRole("button", { name: /Assinar|Fazer Upgrade/ })).not.toBeInTheDocument();
  });
  it("retorno do Checkout refaz a leitura, mas não ativa pela query string", async () => {
    window.history.replaceState({}, "", "/dashboard/subscription?subscribed=true&checkout=returned"); render(<SubscriptionPage />);
    await waitFor(() => expect(state.refetch).toHaveBeenCalled());
    expect(state.planStatus).toBe("expired"); expect(screen.queryByText("Plano Ativo")).not.toBeInTheDocument();
  });
  it("past_due mostra ação necessária e Portal; trial local ainda pode assinar", async () => {
    Object.assign(state, { planStatus: "past_due", canManageBilling: true, canStartCheckout: false, requiresBillingAction: true }); render(<SubscriptionPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/pagamento|cobrança/i);
    expect(screen.getByRole("button", { name: "Gerenciar cobrança" })).toBeEnabled();
    cleanup(); Object.assign(state, { planStatus: "trialing", canManageBilling: false, canStartCheckout: true, requiresBillingAction: false, isTrialing: true });
    render(<SubscriptionPage />); expect(screen.getByRole("button", { name: "Assinar Pro" })).toBeEnabled();
  });
  it("trial com Customer sem Subscription mantém Checkout após abandono ou expiração", async () => {
    Object.assign(state, { planStatus: "trialing", canManageBilling: true, canStartCheckout: true, isTrialing: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(checkout)));
    render(<SubscriptionPage />);
    fireEvent.click(screen.getByRole("button", { name: "Assinar Pro" }));
    await waitFor(() => expect(redirectToBilling).toHaveBeenCalledWith(checkout.url));
    expect(screen.getByRole("button", { name: "Gerenciar cobrança" })).toBeEnabled();
  });
  it("falha mantém a página com mensagem e permite tentar novamente", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: { code: "stripe_unavailable", message: "raw provider error" } }, 503)));
    render(<SubscriptionPage />); fireEvent.click(screen.getByRole("button", { name: "Assinar Pro" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/tente novamente/i));
    expect(redirectToBilling).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Assinar Pro" })).toBeEnabled();
  });
  it("desabilita ações durante a requisição", async () => {
    let finish!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; })));
    render(<SubscriptionPage />); fireEvent.click(screen.getByRole("button", { name: "Assinar Pro" }));
    expect(screen.getAllByRole("button").every(button => button.hasAttribute("disabled"))).toBe(true);
    await act(async () => finish(response(checkout)));
  });
});
