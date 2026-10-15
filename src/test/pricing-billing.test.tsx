import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PricingPage from "@/pages/PricingPage";
const state = vi.hoisted(() => ({ user: { id: "owner-1" } as { id: string } | null,
  planType: "starter", planStatus: "expired", restaurantId: "restaurant-1", loading: false,
  canManageBilling: false, canStartCheckout: true, billingError: null }));
const checkout = vi.hoisted(() => vi.fn()); const portal = vi.hoisted(() => vi.fn()); const redirect = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state }));
vi.mock("@/hooks/useSubscription", () => ({ useSubscription: () => state }));
vi.mock("@/lib/billing-client", () => ({ billingClient: { createCheckout: checkout, createPortal: portal }, redirectToBilling: redirect }));
beforeEach(() => { vi.clearAllMocks(); Object.assign(state, { user: { id: "owner-1" }, planStatus: "expired", canManageBilling: false, canStartCheckout: true }); });
afterEach(cleanup);
function show() { render(<MemoryRouter initialEntries={["/pricing"]}><Routes><Route path="/pricing" element={<PricingPage />} /><Route path="/login" element={<p>Entrar</p>} /></Routes></MemoryRouter>); }
it("pricing selected plan uses hosted Checkout without the deleted modal", async () => {
  checkout.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/vapt" }); show();
  fireEvent.click(screen.getAllByRole("button", { name: "Assinar Agora" })[1]);
  await waitFor(() => expect(checkout).toHaveBeenCalledWith({ restaurantId: "restaurant-1", planType: "pro" }));
  expect(redirect).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/vapt");
});
it("pricing active subscription opens Portal and never another Checkout", async () => {
  Object.assign(state, { planStatus: "active", canManageBilling: true, canStartCheckout: false }); portal.mockResolvedValue({ url: "https://billing.stripe.com/p/session/vapt" }); show();
  fireEvent.click(screen.getByRole("button", { name: "Gerenciar cobrança" }));
  await waitFor(() => expect(portal).toHaveBeenCalledWith("restaurant-1")); expect(checkout).not.toHaveBeenCalled();
});
it("pricing unauthenticated selection goes to login", async () => {
  state.user = null; show(); fireEvent.click(screen.getAllByRole("button", { name: "Assinar Agora" })[0]);
  expect(await screen.findByText("Entrar")).toBeInTheDocument(); expect(checkout).not.toHaveBeenCalled();
});
it("pricing Customer-only trial resumes Checkout instead of forcing Portal", async () => {
  Object.assign(state, { planStatus: "trialing", canManageBilling: true, canStartCheckout: true });
  checkout.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/vapt" }); show();
  fireEvent.click(screen.getAllByRole("button", { name: "Assinar Agora" })[1]);
  await waitFor(() => expect(checkout).toHaveBeenCalledWith({ restaurantId: "restaurant-1", planType: "pro" }));
  expect(portal).not.toHaveBeenCalled();
});
