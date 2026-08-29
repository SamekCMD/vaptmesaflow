import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KitchenMonitor from "@/pages/dashboard/KitchenMonitor";

const mocks = vi.hoisted(() => {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));
  const orders = [
    {
      id: "order-1",
      display_id: 110,
      table_number: null,
      total_price: 25,
      status: "pending",
      order_channel: "delivery",
      payment_status: "CONFIRMED",
      created_at: "2026-08-29T20:00:00.000Z",
      updated_at: null,
      order_items: [
        {
          id: "item-1",
          product_name: "Hamburger",
          quantity: 1,
          unit_price: 25,
          notes: "",
        },
      ],
    },
  ];

  return { updateEq, update, orders };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/restaurants", () => ({
  fetchOwnedRestaurant: vi.fn().mockResolvedValue({ id: "restaurant-1" }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            order: vi.fn().mockResolvedValue({ data: mocks.orders }),
          }),
        }),
      }),
      update: mocks.update,
    })),
  },
}));

afterEach(() => {
  cleanup();
});

describe("KDS touch interactions", () => {
  beforeEach(() => {
    mocks.update.mockClear();
    mocks.updateEq.mockClear();
  });

  it("does not advance an order when the card itself is touched", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/kitchen"]}>
        <KitchenMonitor />
      </MemoryRouter>,
    );

    const card = await screen.findByTestId("kds-order-card-order-1");
    fireEvent.click(card);

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("advances an order only from the explicit action button", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/kitchen"]}>
        <KitchenMonitor />
      </MemoryRouter>,
    );

    const action = await screen.findByRole("button", { name: /preparar pedido #110/i });
    fireEvent.click(action);

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith({ status: "preparing" });
    });
  });
});
