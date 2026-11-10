import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicMenu from "@/pages/menu/PublicMenu";
import { vaptApiRequest } from "@/lib/vapt-api-client";
import { catalogState } from "./public-catalog-fixture";
import type { PublicCatalogView } from "@/lib/catalog/controller";
import OrderSummaryDrawer from "@/components/menu/OrderSummaryDrawer";
import { orderClient } from "@/lib/order-client";
import type { PublicMenuItem } from "@/lib/restaurant-config";
import { paymentClient } from "@/lib/payment-client";
const events = vi.hoisted(() => ({ view: null as PublicCatalogView | null, refresh: vi.fn() }));
vi.mock("@/hooks/use-public-catalog", () => ({ usePublicCatalog: () => ({ ...events.view, refresh: events.refresh }) }));
vi.mock("@/lib/env", async original => ({ ENV: { ...(await original<typeof import("@/lib/env")>()).ENV, publicCatalogEventsEnabled: true } }));
vi.mock("@/lib/vapt-api-client", async original => ({ ...(await original<typeof import("@/lib/vapt-api-client")>()), vaptApiRequest: vi.fn() }));
// Keep the real ProductDrawer/cart behavior, but isolate Vaul's animated portal:
// jsdom does not complete its modal accessibility teardown like a browser does.
vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ open, children }) => open ? <div>{children}</div> : null,
  DrawerContent: ({ children }) => <div>{children}</div>, DrawerHeader: ({ children }) => <div>{children}</div>,
  DrawerTitle: ({ children }) => <h2>{children}</h2>, DrawerFooter: ({ children }) => <div>{children}</div>,
  DrawerClose: ({ children }) => <div>{children}</div>, DrawerDescription: ({ children }) => <p>{children}</p>,
}));
function state(version = "11") {
  const value = catalogState(version);
  value.catalog.items = [{ id: "33333333-3333-4333-8333-333333333333", restaurantId: value.catalog.restaurant.id, name: "Prato do dia", price: "23.50", description: "Almoço",
    category: "Pratos", available: true, imageUrl: null, availableFrom: null, availableUntil: null, badge: null, isChefSuggestion: false, prepTimeMinutes: 15,
    createdAt: "2026-10-16T00:00:00Z", updatedAt: "2026-10-16T00:00:00Z", variations: [] }];
  return value;
}
function Location() { const value = useLocation(); return <output aria-label="Endereço atual">{value.pathname}{value.search}</output>; }
const page = () => <MemoryRouter initialEntries={["/menu/bistro?table=2"]}><Location /><Routes><Route path="/menu/:slug" element={<PublicMenu />} /></Routes></MemoryRouter>;
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); events.view = { state: state(), status: "ready", errorCode: null }; vi.mocked(vaptApiRequest).mockResolvedValue(state().catalog); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe("local menu published catalog integration", () => {
  it("keeps the selected item but blocks order confirmation when its published price changes", async () => {
    const view = render(page()); await screen.findByText("Prato do dia");
    fireEvent.click(screen.getByRole("button", { name: /Prato do dia/ }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes do item" }));
    fireEvent.click(screen.getByRole("button", { name: /Revisar pedido.*1 item/ }));
    expect(screen.getByRole("button", { name: "Enviar para a cozinha" })).toBeEnabled();
    const next = state("12"); next.catalog.items[0]!.price = "30.00";
    events.view = { state: next, status: "ready", errorCode: null }; view.rerender(page());
    expect(screen.getByRole("button", { name: "Enviar para a cozinha" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Revise o carrinho/);
  });
  it("a pending route change invalidates checkout before the next tenant is known", async () => {
    let resolve!: (value: never) => void;
    vi.spyOn(orderClient, "create").mockImplementation(() => new Promise(done => { resolve = done; }));
    const hosted = vi.spyOn(paymentClient, "startHosted").mockRejectedValue(new Error("Must not start old payment"));
    const value = state();
    const props = { open: true, onClose() {}, items: [{ item: { ...value.catalog.items[0]!, price: 23.5 } as PublicMenuItem, quantity: 1, notes: "" }], totalPrice: 23.5,
      onUpdateQuantity() {}, onRemove() {}, onClearCart() {}, primaryColor: "#123456", restaurantId: value.catalog.restaurant.id,
      restaurantSlug: "bistro", paymentMode: "prepaid" as const, navigationEpoch: 0 };
    const view = render(<OrderSummaryDrawer {...props} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Pagar online" })); });
    view.rerender(<OrderSummaryDrawer {...props} orderingEnabled={false} navigationEpoch={1} />);
    await act(async () => { resolve({ restaurantId: value.catalog.restaurant.id, orderId: "66666666-6666-4666-8666-666666666666", publicToken: "synthetic-public-token-long-enough", displayId: "41", status: "waiting_payment" } as never); });
    expect(hosted).not.toHaveBeenCalled();
  });
  it("applies restaurant/items atomically without legacy polling or GETs on cart edits", async () => {
    vi.useFakeTimers(); let view: ReturnType<typeof render>;
    await act(async () => { view = render(page()); });
    expect(screen.getByText("Prato do dia")).toBeInTheDocument(); expect(vaptApiRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Prato do dia/ }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes do item" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByRole("button", { name: /Revisar pedido.*1 item/ })).toBeInTheDocument();
    const next = state("12"); next.catalog.restaurant.name = "Bistrô Novo"; next.catalog.restaurant.primaryColor = "#ff0000";
    next.catalog.items[0]!.name = "Prato atualizado"; next.catalog.items[0]!.price = "30.00";
    events.view = { state: next, status: "ready", errorCode: null }; await act(async () => { view.rerender(page()); });
    expect(screen.getByText("Bistrô Novo")).toBeInTheDocument(); expect(screen.getByText("Prato atualizado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revisar pedido.*1 item/ })).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--menu-primary")).toBe("0 100% 50%");
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); }); expect(vaptApiRequest).not.toHaveBeenCalled();
  });
  it("canonical slug retains the table query; disabling the channel preserves cart and order access", async () => {
    const view = render(page()); await screen.findByText("Prato do dia");
    fireEvent.click(screen.getByRole("button", { name: /Prato do dia/ })); fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes do item" }));
    await screen.findByRole("button", { name: /Revisar pedido.*1 item/ });
    const next = state("12"); next.catalog.restaurant.slug = "novo-bistro"; next.catalog.restaurant.localEnabled = false;
    events.view = { state: next, status: "ready", errorCode: null }; view.rerender(page());
    expect(screen.getByLabelText("Endereço atual")).toHaveTextContent("/menu/novo-bistro?table=2");
    expect(screen.getByRole("button", { name: /Revisar pedido.*1 item/ })).toBeInTheDocument();
    expect(screen.getByText("Novos pedidos na mesa estão pausados.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Prato do dia/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Acompanhar pedidos" })).toBeEnabled();
  });
  it("a different restaurant cannot inherit a prior tenant's cart", async () => {
    const view = render(page()); await screen.findByText("Prato do dia");
    fireEvent.click(screen.getByRole("button", { name: /Prato do dia/ })); fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes do item" }));
    const next = state("12"); next.catalog.restaurant.id = "44444444-4444-4444-8444-444444444444"; next.catalog.items[0]!.restaurantId = next.catalog.restaurant.id;
    events.view = { state: next, status: "ready", errorCode: null }; view.rerender(page());
    expect(screen.getByRole("button", { name: "Montar pedido" })).toBeInTheDocument();
  });
  it("an open product receives new public price/variation data before the next addition", async () => {
    const view = render(page()); await screen.findByText("Prato do dia"); fireEvent.click(screen.getByRole("button", { name: /Prato do dia/ }));
    const next = state("12"); next.catalog.items[0]!.name = "Prato atualizado"; next.catalog.items[0]!.price = "30.00";
    next.catalog.items[0]!.variations = [{ id: "55555555-5555-4555-8555-555555555555", name: "Tamanho", required: true, options: ["Grande"] }];
    events.view = { state: next, status: "ready", errorCode: null }; view.rerender(page());
    expect(screen.getByRole("heading", { level: 2, name: "Prato atualizado" })).toBeInTheDocument();
    expect(screen.getByText("Tamanho")).toBeInTheDocument(); expect(screen.getByRole("button", { name: /Adicionar.*30,00/ })).toBeInTheDocument();
  });
  it("item schedule transitions happen locally at the boundary without any catalog GET", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 16, 11, 59, 30)); vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const value = state(); value.catalog.items[0]!.availableFrom = "12:00"; value.catalog.items[0]!.availableUntil = "12:00";
    events.view = { state: value, status: "ready", errorCode: null };
    await act(async () => { render(page()); });
    expect(screen.getByRole("button", { name: /Prato do dia/ })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByRole("button", { name: /Prato do dia/ })).toBeEnabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByRole("button", { name: /Prato do dia/ })).toBeDisabled(); expect(vaptApiRequest).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it("a restaurant change during pending order checks cannot submit the prior tenant's cart", async () => {
    const restaurantId = state().catalog.restaurant.id;
    localStorage.setItem(`orders_${restaurantId}`, JSON.stringify([{ orderId: "66666666-6666-4666-8666-666666666666", publicToken: "synthetic-public-token-long-enough" }]));
    let resolve!: (value: never) => void; vi.spyOn(orderClient, "get").mockImplementation(() => new Promise(done => { resolve = done; }));
    const create = vi.spyOn(orderClient, "create").mockResolvedValue({ orderId: "synthetic", publicToken: "synthetic", displayId: "1", status: "pending" } as never);
    const item = { ...state().catalog.items[0]!, price: 23.5 } as PublicMenuItem;
    const props = { open: true, onClose() {}, items: [{ item, quantity: 1, notes: "" }], totalPrice: 23.5, onUpdateQuantity() {}, onRemove() {}, onClearCart() {},
      primaryColor: "#123456", restaurantId, restaurantSlug: "bistro", orderingEnabled: true };
    const view = render(<OrderSummaryDrawer {...props} />); fireEvent.click(screen.getByRole("button", { name: "Enviar para a cozinha" }));
    view.rerender(<OrderSummaryDrawer {...props} restaurantId="77777777-7777-4777-8777-777777777777" restaurantSlug="other-bistro" />);
    await act(async () => { resolve({ status: "pending" } as never); }); expect(create).not.toHaveBeenCalled();
  });
  it("late order creation cannot notify or clear another restaurant's cart", async () => {
    vi.useFakeTimers(); const value = state(); let resolve!: (value: never) => void;
    vi.spyOn(orderClient, "create").mockImplementation(() => new Promise(done => { resolve = done; }));
    const placed = vi.fn(); const clear = vi.fn();
    const props = { open: true, onClose() {}, items: [{ item: { ...value.catalog.items[0]!, price: 23.5 } as PublicMenuItem, quantity: 1, notes: "" }], totalPrice: 23.5,
      onUpdateQuantity() {}, onRemove() {}, onClearCart: clear, onOrderPlaced: placed, primaryColor: "#123456", restaurantId: value.catalog.restaurant.id, restaurantSlug: "bistro" };
    const view = render(<OrderSummaryDrawer {...props} />); await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Enviar para a cozinha" })); });
    view.rerender(<OrderSummaryDrawer {...props} restaurantId="77777777-7777-4777-8777-777777777777" restaurantSlug="other-bistro" />);
    await act(async () => { resolve({ restaurantId: value.catalog.restaurant.id, orderId: "66666666-6666-4666-8666-666666666666", publicToken: "synthetic-public-token-long-enough", displayId: "1", status: "pending" } as never); });
    expect(placed).not.toHaveBeenCalled(); await act(async () => { await vi.advanceTimersByTimeAsync(2600); }); expect(clear).not.toHaveBeenCalled();
  });
});
