import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/hooks/use-toast";
import { listKitchenOrders, updateKitchenOrderStatus } from "@/lib/kitchen";
import KitchenMonitor from "@/pages/dashboard/KitchenMonitor";

const { authUser } = vi.hoisted(() => ({ authUser: { id: "owner-1" } }));

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
});
