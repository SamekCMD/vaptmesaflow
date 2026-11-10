import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicDelivery from "@/pages/delivery/PublicDelivery";
import { vaptApiRequest } from "@/lib/vapt-api-client";
import { catalogState } from "./public-catalog-fixture";
import type { PublicCatalogView } from "@/lib/catalog/controller";
import { orderClient } from "@/lib/order-client";
import { paymentClient } from "@/lib/payment-client";
const events = vi.hoisted(() => ({ view: null as PublicCatalogView | null, refresh: vi.fn() }));
vi.mock("@/hooks/use-public-catalog", () => ({ usePublicCatalog: () => ({ ...events.view, refresh: events.refresh }) }));
vi.mock("@/lib/env", async original => ({ ENV: { ...(await original<typeof import("@/lib/env")>()).ENV, publicCatalogEventsEnabled: true } }));
vi.mock("@/lib/vapt-api-client", async original => ({ ...(await original<typeof import("@/lib/vapt-api-client")>()), vaptApiRequest: vi.fn() }));
function state(version = "11") {
  const value = catalogState(version);
  value.catalog.items = [{ id: "33333333-3333-4333-8333-333333333333", restaurantId: value.catalog.restaurant.id, name: "Prato do dia", price: "23.50", description: "Almoço",
    category: "Pratos", available: true, imageUrl: null, availableFrom: null, availableUntil: null, badge: null, isChefSuggestion: false, prepTimeMinutes: 15,
    createdAt: "2026-10-16T00:00:00Z", updatedAt: "2026-10-16T00:00:00Z", variations: [] }]; return value;
}
function Location() { const location = useLocation(); const navigate = useNavigate(); return <><output aria-label="Endereço atual">{location.pathname}</output><button onClick={() => navigate("/delivery/other-bistro")}>Outro restaurante</button></>; }
const page = () => <MemoryRouter initialEntries={["/delivery/bistro"]}><Location /><Routes><Route path="/delivery/:slug" element={<PublicDelivery />} /></Routes></MemoryRouter>;
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); events.view = { state: state(), status: "ready", errorCode: null }; vi.mocked(vaptApiRequest).mockResolvedValue(state().catalog); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe("delivery published catalog integration", () => {
  it("blocks payment with a stale cart price instead of silently ordering at the new price", async () => {
    const restaurantId = state().catalog.restaurant.id;
    localStorage.setItem(`vapt_delivery_address_${restaurantId}`, JSON.stringify({ customerName: "Teste", phone: "11999999999", street: "Rua Teste", number: "1", neighborhood: "Centro" }));
    const create = vi.spyOn(orderClient, "create").mockRejectedValue(new Error("Must review changed price first"));
    const view = render(page()); await screen.findByText("Prato do dia"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    const next = state("12"); next.catalog.items[0]!.price = "30.00";
    events.view = { state: next, status: "ready", errorCode: null }; view.rerender(page());
    const pay = screen.getByRole("button", { name: "Continuar para pagamento online" });
    expect(pay).toBeDisabled(); fireEvent.click(pay); expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Revise o carrinho/);
    expect(screen.queryByText("Seu carrinho está vazio.")).not.toBeInTheDocument();
  });
  it("invalidates old checkout immediately while the next restaurant is still loading", async () => {
    const restaurantId = state().catalog.restaurant.id;
    localStorage.setItem(`vapt_delivery_address_${restaurantId}`, JSON.stringify({ customerName: "Teste", phone: "11999999999", street: "Rua Teste", number: "1", neighborhood: "Centro" }));
    let resolve!: (value: never) => void;
    vi.spyOn(orderClient, "create").mockImplementation(() => new Promise(done => { resolve = done; }));
    const hosted = vi.spyOn(paymentClient, "startHosted").mockRejectedValue(new Error("Must not begin old payment"));
    render(page()); await screen.findByText("Prato do dia"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Continuar para pagamento online" })); });
    events.view = { state: null, status: "loading", errorCode: null };
    fireEvent.click(screen.getByRole("button", { name: "Outro restaurante" }));
    await act(async () => { resolve({ restaurantId, orderId: "66666666-6666-4666-8666-666666666666", publicToken: "synthetic-public-token-long-enough", displayId: "41", status: "waiting_payment", totalPrice: "23.50" } as never); });
    expect(hosted).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Endereço atual")).toHaveTextContent("/delivery/other-bistro");
    events.view = { state: null, status: "unavailable", errorCode: "not_found" };
    fireEvent.click(screen.getByRole("button", { name: "Outro restaurante" }));
    expect(screen.queryByText("Prato do dia")).not.toBeInTheDocument();
  });
  it("updates full restaurant/item data and canonical slug without resetting cart or fetching legacy DTO", async () => {
    const view = render(page()); await screen.findByText("Prato do dia"); expect(vaptApiRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    const next = state("12"); next.catalog.restaurant.name = "Delivery Novo"; next.catalog.restaurant.slug = "novo-bistro";
    next.catalog.items[0]!.name = "Prato atualizado"; events.view = { state: next, status: "ready", errorCode: null }; view.rerender(page());
    expect(screen.getByText("Delivery Novo")).toBeInTheDocument(); expect(screen.getAllByText("Prato atualizado").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Endereço atual")).toHaveTextContent("/delivery/novo-bistro");
    expect(screen.getAllByText("Prato do dia").length).toBeGreaterThan(0); expect(vaptApiRequest).not.toHaveBeenCalled();
  });
  it("disabling delivery retains the cart while blocking new additions and checkout", async () => {
    const view = render(page()); await screen.findByText("Prato do dia"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    const next = state("12"); next.catalog.restaurant.deliveryEnabled = false; events.view = { state: next, status: "ready", errorCode: null }; view.rerender(page());
    expect(screen.getByText("Novos pedidos de delivery estão pausados.")).toBeInTheDocument();
    expect(screen.getAllByText("Prato do dia").length).toBeGreaterThan(0); expect(screen.getByRole("button", { name: "Adicionar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continuar para pagamento online" })).toBeDisabled();
  });
  it("delivery respects published schedules without timer-based GETs", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 16, 11, 59, 30)); vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const value = state(); value.catalog.items[0]!.availableFrom = "12:00"; events.view = { state: value, status: "ready", errorCode: null };
    await act(async () => { render(page()); }); expect(screen.getByRole("button", { name: "Adicionar" })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); }); expect(screen.getByRole("button", { name: "Adicionar" })).toBeEnabled();
    expect(vaptApiRequest).not.toHaveBeenCalled();
  });
  it("a different restaurant never inherits cart or prior order state", async () => {
    const view = render(page()); await screen.findByText("Prato do dia"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    const next = state("12"); next.catalog.restaurant.id = "44444444-4444-4444-8444-444444444444"; next.catalog.items[0]!.restaurantId = next.catalog.restaurant.id;
    events.view = { state: next, status: "ready", errorCode: null }; view.rerender(page());
    expect(screen.getByText("Seu carrinho está vazio.")).toBeInTheDocument();
  });
  it("late checkout response cannot move an old order into a different restaurant", async () => {
    const restaurantId = state().catalog.restaurant.id;
    localStorage.setItem(`vapt_delivery_address_${restaurantId}`, JSON.stringify({ customerName: "Teste", phone: "11999999999", street: "Rua Teste", number: "1", neighborhood: "Centro" }));
    let resolve!: (value: never) => void; vi.spyOn(orderClient, "create").mockImplementation(() => new Promise(done => { resolve = done; }));
    const view = render(page()); await screen.findByText("Prato do dia"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: /Pagar na entrega/i })[0]!); });
    const next = state("12"); next.catalog.restaurant.id = "44444444-4444-4444-8444-444444444444"; next.catalog.items[0]!.restaurantId = next.catalog.restaurant.id;
    events.view = { state: next, status: "ready", errorCode: null }; view.rerender(page());
    await act(async () => { resolve({ restaurantId, orderId: "66666666-6666-4666-8666-666666666666", publicToken: "synthetic-public-token-long-enough", displayId: "41", status: "pending", totalPrice: "23.50" } as never); });
    expect(screen.queryAllByText(/#41/)).toHaveLength(0); expect(screen.getByText("Seu carrinho está vazio.")).toBeInTheDocument();
  });
  it("releases a completed checkout so the customer can explicitly place another order", async () => {
    const restaurantId = state().catalog.restaurant.id;
    localStorage.setItem(`vapt_delivery_address_${restaurantId}`, JSON.stringify({ customerName: "Teste", phone: "11999999999", street: "Rua Teste", number: "1", neighborhood: "Centro" }));
    const create = vi.spyOn(orderClient, "create").mockResolvedValue({ restaurantId, orderId: "66666666-6666-4666-8666-666666666666", publicToken: "synthetic-public-token-long-enough", displayId: "41", status: "pending", totalPrice: "23.50" } as never);
    render(page()); await screen.findByText("Prato do dia");
    for (let attempt = 0; attempt < 2; attempt++) {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
      await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: /Pagar na entrega/i })[0]!); });
    }
    expect(create).toHaveBeenCalledTimes(2);
  });
});
