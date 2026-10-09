import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/hooks/use-toast";
import { orderClient, type PublicOrder } from "@/lib/order-client";
import { vaptApiRequest } from "@/lib/vapt-api-client";
import type { RealtimeScope } from "@/lib/realtime/contracts";
import type { subscribeRealtime, RealtimeState } from "@/lib/realtime/client";
import MyOrdersDrawer from "@/components/menu/MyOrdersDrawer";
import PublicMenu from "@/pages/menu/PublicMenu";

const realtime = vi.hoisted(() => ({ consumers: [] as Array<{
  scope: RealtimeScope; signal: Parameters<typeof subscribeRealtime>[1]; state: (value: RealtimeState) => void;
}> }));
vi.mock("@/lib/env", async original => ({ ENV: { ...(await original<typeof import("@/lib/env")>()).ENV, realtimeEnabled: true } }));
// External transport and HTTP boundaries only; the screens, refresh hook and storage are real.
vi.mock("@/lib/realtime/client", () => ({ subscribeRealtime: (scope, signal, state) => {
  const consumer = { scope, signal, state }; realtime.consumers.push(consumer);
  state("fallback"); return () => { realtime.consumers = realtime.consumers.filter(item => item !== consumer); };
} }));
vi.mock("@/lib/vapt-api-client", async original => ({ ...(await original<typeof import("@/lib/vapt-api-client")>()), vaptApiRequest: vi.fn() }));
vi.mock("@/lib/order-client", async original => {
  const actual = await original<typeof import("@/lib/order-client")>();
  return { ...actual, orderClient: { ...actual.orderClient, get: vi.fn() } };
});
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const restaurantId = "30000000-0000-4000-8000-000000000001";
const orderId = "20000000-0000-4000-8000-000000000001";
const otherOrderId = "20000000-0000-4000-8000-000000000002";
const publicToken = "synthetic-public-order-token-long-enough";
const catalog = {
  restaurant: { id: restaurantId, name: "Vapt Bistrô", slug: "vapt-bistro", whatsapp: null, address: null, phone: null,
    hours: null, description: null, primaryColor: "#0ea573", secondaryColor: "#1e293b", fontFamily: "modern", logoUrl: null,
    totalTables: 12, maxTables: 20, paymentMode: "open_tab", maxPendingOrders: 3, localEnabled: true, deliveryEnabled: true,
    updatedAt: "2026-10-06T12:00:00.000Z" },
  items: [{ id: "10000000-0000-4000-8000-000000000001", restaurantId, name: "Prato do dia", description: "Almoço",
    price: "23.50", category: "Pratos", imageUrl: null, available: true, availableFrom: null, availableUntil: null, badge: null,
    isChefSuggestion: false, prepTimeMinutes: null, createdAt: "2026-10-06T12:00:00.000Z", updatedAt: "2026-10-06T12:00:00.000Z", variations: [] }],
};
const initialOrder = (): PublicOrder => ({ orderId, displayId: "42", restaurantId, tableSessionId: null, totalPrice: "23.50",
  status: "pending", paymentStatus: "paid", channel: "local", tableNumber: "1", createdAt: new Date().toISOString(), items: [] });
function notify() {
  for (const consumer of realtime.consumers) consumer.signal({ version: 1, eventId: "40000000-0000-4000-8000-000000000001",
    sequence: 1, topic: "orders", entityId: orderId, reason: "updated" });
}

describe("public order realtime", () => {
  beforeEach(() => {
    vi.clearAllMocks(); realtime.consumers = []; localStorage.clear(); sessionStorage.clear();
    localStorage.setItem(`orders_${restaurantId}`, JSON.stringify([{ orderId, publicToken }]));
    sessionStorage.setItem("vapt_current_order_ids", JSON.stringify([orderId]));
    vi.mocked(orderClient.get).mockResolvedValue(initialOrder());
    vi.mocked(vaptApiRequest).mockImplementation(async options => {
      if (options.route !== "/public/restaurants/vapt-bistro/catalog") throw new Error("Unexpected HTTP route");
      return catalog as never;
    });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("resyncs only current authorized orders, notifies ready once, and retains catalog polling", async () => {
    localStorage.setItem(`orders_${restaurantId}`, JSON.stringify([{ orderId, publicToken }, { orderId: otherOrderId, publicToken: "another-synthetic-token" }]));
    vi.useFakeTimers();
    let view: ReturnType<typeof render>;
    await act(async () => { view = render(<MemoryRouter initialEntries={["/menu/vapt-bistro?table=1"]}><Routes>
      <Route path="/menu/:slug" element={<PublicMenu />} />
    </Routes></MemoryRouter>); });
    expect(screen.getByText("Prato do dia")).toBeInTheDocument();
    expect(realtime.consumers.map(item => item.scope)).toEqual([{ mode: "order", orderId, token: publicToken }]);
    vi.mocked(orderClient.get).mockResolvedValue({ ...initialOrder(), status: "ready" });
    const calls = vi.mocked(orderClient.get).mock.calls.length;
    await act(async () => { notify(); notify(); await vi.advanceTimersByTimeAsync(250); });
    expect(screen.getByRole("button", { name: "Pedido pronto" })).toBeInTheDocument();
    expect(orderClient.get).toHaveBeenCalledTimes(calls + 1);
    expect(vi.mocked(toast).mock.calls.filter(([value]) => value.title === "Pedido pronto")).toHaveLength(1);
    await act(async () => { notify(); await vi.advanceTimersByTimeAsync(250); });
    expect(vi.mocked(toast).mock.calls.filter(([value]) => value.title === "Pedido pronto")).toHaveLength(1);
    vi.mocked(vaptApiRequest).mockResolvedValue({ ...catalog, items: [{ ...catalog.items[0], name: "Prato atualizado" }] });
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(screen.getByText("Prato atualizado")).toBeInTheDocument();
    view.unmount(); expect(realtime.consumers).toHaveLength(0);
    const finalReads = vi.mocked(orderClient.get).mock.calls.length;
    const finalCatalogReads = vi.mocked(vaptApiRequest).mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(orderClient.get).toHaveBeenCalledTimes(finalReads);
    expect(vaptApiRequest).toHaveBeenCalledTimes(finalCatalogReads);
  });

  it("does not subscribe or poll a closed drawer and releases its order consumers on close", async () => {
    const view = render(<MyOrdersDrawer open={false} onClose={() => {}} restaurantId={restaurantId} primaryColor="#0ea573" />);
    expect(realtime.consumers).toHaveLength(0); expect(orderClient.get).not.toHaveBeenCalled();
    view.rerender(<MyOrdersDrawer open onClose={() => {}} restaurantId={restaurantId} primaryColor="#0ea573" />);
    expect(await screen.findByText("Pedido #42")).toBeInTheDocument();
    expect(realtime.consumers.map(item => item.scope)).toEqual([{ mode: "order", orderId, token: publicToken }]);
    vi.useFakeTimers();
    view.rerender(<MyOrdersDrawer open={false} onClose={() => {}} restaurantId={restaurantId} primaryColor="#0ea573" />);
    const calls = vi.mocked(orderClient.get).mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(orderClient.get).toHaveBeenCalledTimes(calls); expect(realtime.consumers).toHaveLength(0);
    view.unmount();
  });

  it("refreshes a drawer status immediately through its own order scope", async () => {
    const view = render(<MyOrdersDrawer open onClose={() => {}} restaurantId={restaurantId} primaryColor="#0ea573" />);
    expect(await screen.findByText("Na fila")).toBeInTheDocument();
    vi.useFakeTimers(); vi.mocked(orderClient.get).mockResolvedValue({ ...initialOrder(), status: "ready" });
    await act(async () => { notify(); await vi.advanceTimersByTimeAsync(250); });
    expect(screen.getByText("Pronto!")).toBeInTheDocument(); view.unmount();
  });
});
