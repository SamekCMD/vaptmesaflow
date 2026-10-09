import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/hooks/use-toast";
import { listKitchenOrders, updateKitchenOrderStatus } from "@/lib/kitchen";
import KitchenMonitor from "@/pages/dashboard/KitchenMonitor";

const { authUser } = vi.hoisted(() => ({ authUser: { id: "owner-1" } }));
const realtime = vi.hoisted(() => ({ consumers: [] as Array<{ scope: any; signal: (value: any) => void; state: (value: any) => void }> }));
vi.mock("@/lib/env", async original => ({ ENV: { ...(await original<typeof import("@/lib/env")>()).ENV, realtimeEnabled: true } }));
vi.mock("@/lib/restaurants", () => ({ fetchOwnedRestaurant: async () => ({ id: "10000000-0000-4000-8000-000000000001" }) }));
vi.mock("@/lib/realtime/client", () => ({ subscribeRealtime: (scope, signal, state) => {
  const consumer = { scope, signal, state }; realtime.consumers.push(consumer);
  state("fallback"); return () => { realtime.consumers = realtime.consumers.filter(item => item !== consumer); };
} }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock("@/lib/kitchen", () => ({
  listKitchenOrders: vi.fn(),
  updateKitchenOrderStatus: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const pendingOrder = {
  id: "30000000-0000-4000-8000-000000000001",
  displayId: "42",
  restaurantId: "10000000-0000-4000-8000-000000000001",
  tableNumber: "7",
  totalPrice: "29.90",
  status: "pending" as const,
  channel: "local" as const,
  paymentStatus: "paid",
  createdAt: "2026-09-26T12:00:00.000Z",
  updatedAt: "2026-09-26T12:00:00.000Z",
  items: [{
    id: "40000000-0000-4000-8000-000000000001",
    productName: "X-Burguer",
    quantity: 1,
    unitPrice: "29.90",
    notes: "Sem cebola",
  }],
};

describe("kitchen monitor API cutover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    realtime.consumers = [];
    localStorage.setItem("vapt_kds_sound_enabled", "false");
    vi.mocked(listKitchenOrders).mockResolvedValue([pendingOrder]);
    vi.mocked(updateKitchenOrderStatus).mockResolvedValue({
      ...pendingOrder,
      status: "preparing",
      updatedAt: "2026-09-26T12:05:00.000Z",
    });
  });

  it("loads the owner-scoped active queue and its items", async () => {
    render(<MemoryRouter><KitchenMonitor /></MemoryRouter>);

    expect(await screen.findByText("#42")).toBeInTheDocument();
    expect(screen.getByText(/1x X-Burguer/)).toBeInTheDocument();
    expect(screen.getByText(/Sem cebola/)).toBeInTheDocument();
    expect(listKitchenOrders).toHaveBeenCalledWith();
  });

  it("advances with the server response instead of writing directly to Supabase", async () => {
    render(<MemoryRouter><KitchenMonitor /></MemoryRouter>);
    const card = await screen.findByRole("button", { name: /#42/ });

    fireEvent.click(card);

    await waitFor(() => expect(updateKitchenOrderStatus).toHaveBeenCalledWith(
      pendingOrder.id,
      "preparing",
    ));
    const updatedCard = await screen.findByRole("button", { name: /#42/ });
    expect(within(updatedCard).getByText("Finalizar")).toBeInTheDocument();
  });

  it("restores the complete optimistic order when the transition fails", async () => {
    vi.mocked(updateKitchenOrderStatus).mockRejectedValueOnce(new Error("Conflito de status"));
    render(<MemoryRouter><KitchenMonitor /></MemoryRouter>);
    const card = await screen.findByRole("button", { name: /#42/ });

    fireEvent.click(card);

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Erro",
      description: "Conflito de status",
      variant: "destructive",
    })));
    const restoredCard = await screen.findByRole("button", { name: /#42/ });
    expect(within(restoredCard).getByText("Preparar")).toBeInTheDocument();
    expect(within(restoredCard).getByText(/Sem cebola/)).toBeInTheDocument();
  });

  it("archives stale ready orders through the same API and clears timers on unmount", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T13:00:00.000Z"));
    const readyOrder = {
      ...pendingOrder,
      status: "ready" as const,
      updatedAt: "2026-09-26T12:58:00.000Z",
    };
    vi.mocked(listKitchenOrders).mockResolvedValueOnce([readyOrder]);
    vi.mocked(updateKitchenOrderStatus).mockResolvedValueOnce({
      ...readyOrder,
      status: "delivered",
    });
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const view = render(<MemoryRouter><KitchenMonitor /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("#42")).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(updateKitchenOrderStatus).toHaveBeenCalledWith(readyOrder.id, "delivered");
    expect(screen.queryByText("#42")).not.toBeInTheDocument();

    view.unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it("manual refresh joins an in-flight realtime snapshot instead of starting concurrent reads", async () => {
    let finish!: (orders: typeof pendingOrder[]) => void;
    const view = render(<MemoryRouter><KitchenMonitor /></MemoryRouter>);
    await screen.findByText("#42");
    vi.useFakeTimers();
    vi.mocked(listKitchenOrders).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    act(() => realtime.consumers[0].signal("connected"));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    const calls = vi.mocked(listKitchenOrders).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(listKitchenOrders).toHaveBeenCalledTimes(calls);
    await act(async () => { finish([pendingOrder]); });
    expect(screen.getByText("#42")).toBeInTheDocument(); expect(listKitchenOrders).toHaveBeenCalledTimes(calls + 1);
    view.unmount();
  });

  it("new order invalidations refresh the scoped queue without duplicate notification", async () => {
    localStorage.setItem("vapt_kds_sound_enabled", "true");
    const view = render(<MemoryRouter><KitchenMonitor /></MemoryRouter>);
    await screen.findByText("#42");
    await waitFor(() => expect(realtime.consumers).toHaveLength(1));
    expect(realtime.consumers[0].scope).toEqual({ mode: "owner", userId: "owner-1", restaurantId: pendingOrder.restaurantId });
    vi.useFakeTimers();
    vi.mocked(listKitchenOrders).mockResolvedValue([pendingOrder, { ...pendingOrder, id: "30000000-0000-4000-8000-000000000002", displayId: "43" }]);
    const initial = vi.mocked(listKitchenOrders).mock.calls.length;
    const event = { version: 1, eventId: pendingOrder.id, entityId: pendingOrder.id, sequence: 1, topic: "orders", reason: "created" };
    act(() => { realtime.consumers[0].signal(event); realtime.consumers[0].signal(event); });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(screen.getByText("#43")).toBeInTheDocument(); expect(listKitchenOrders).toHaveBeenCalledTimes(initial + 1);
    act(() => realtime.consumers[0].signal(event)); await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(vi.mocked(toast).mock.calls.filter(([value]) => value.title.includes("novo(s)")).length).toBe(1);
    view.unmount(); expect(realtime.consumers).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
  });
});
