import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  RestaurantDto,
  TableSessionDetailDto,
  TableSessionSummaryDto,
} from "@/lib/business-api.types";
import { fetchOwnedRestaurant } from "@/lib/restaurants";
import {
  closeTableSession,
  getTableSession,
  listTableSessions,
  transferTableSession,
} from "@/lib/table-sessions";
import CashierPage from "@/pages/dashboard/CashierPage";

const { authUser } = vi.hoisted(() => ({ authUser: { id: "owner-1" } }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock("@/components/FeatureGate", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/restaurants", () => ({
  fetchOwnedRestaurant: vi.fn(),
}));

vi.mock("@/lib/table-sessions", () => ({
  listTableSessions: vi.fn(),
  getTableSession: vi.fn(),
  closeTableSession: vi.fn(),
  transferTableSession: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const restaurant = {
  id: "10000000-0000-4000-8000-000000000001",
  maxTables: 2,
  totalTables: 2,
} as RestaurantDto;

const session: TableSessionSummaryDto = {
  id: "30000000-0000-4000-8000-000000000001",
  restaurantId: restaurant.id,
  tableNumber: "1",
  status: "check_requested",
  openedAt: "2026-09-26T12:00:00.000Z",
  closedAt: null,
  sessionTotal: "9007199254740993.42",
  orderCount: 1,
};

const detail: TableSessionDetailDto = {
  session,
  orders: [{
    id: "40000000-0000-4000-8000-000000000001",
    displayId: "9007199254740993",
    totalPrice: "29.90",
    status: "ready",
    createdAt: "2026-09-26T12:05:00.000Z",
    paymentStatus: "paid",
    paymentConfirmedAt: "2026-09-26T12:06:00.000Z",
    items: [{
      id: "50000000-0000-4000-8000-000000000001",
      productName: "Executivo",
      quantity: 1,
      unitPrice: "29.90",
      notes: "Sem cebola",
    }],
  }],
};

describe("cashier API cutover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchOwnedRestaurant).mockResolvedValue(restaurant);
    vi.mocked(listTableSessions).mockResolvedValue([session]);
    vi.mocked(getTableSession).mockResolvedValue(detail);
    vi.mocked(closeTableSession).mockResolvedValue({
      sessionId: session.id,
      status: "closed",
      closedAt: "2026-09-26T13:00:00.000Z",
      deliveredOrderIds: [detail.orders[0]!.id],
    });
    vi.mocked(transferTableSession).mockResolvedValue({
      sessionId: session.id,
      tableNumber: "2",
      updatedOrderIds: [detail.orders[0]!.id],
    });
  });

  it("loads owner-scoped sessions with the exact API aggregate", async () => {
    render(<MemoryRouter><CashierPage /></MemoryRouter>);

    expect(await screen.findByText("1 pedido · R$ 9007199254740993,42")).toBeInTheDocument();
    expect(listTableSessions).toHaveBeenCalledWith();
    expect(fetchOwnedRestaurant).toHaveBeenCalledWith();
  });

  it("loads detail and closes the whole session through one atomic API call", async () => {
    vi.mocked(listTableSessions)
      .mockResolvedValueOnce([session])
      .mockResolvedValueOnce([]);
    render(<MemoryRouter><CashierPage /></MemoryRouter>);
    fireEvent.click(await screen.findByText("Mesa 1"));

    expect(await screen.findByText("Pedido #9007199254740993")).toBeInTheDocument();
    expect(getTableSession).toHaveBeenCalledWith(session.id);
    fireEvent.click(screen.getByRole("button", { name: "Finalizar Conta" }));

    await waitFor(() => expect(closeTableSession).toHaveBeenCalledWith(session.id));
    await waitFor(() => expect(listTableSessions).toHaveBeenCalledTimes(2));
  });

  it("transfers the session and all linked orders through one API call", async () => {
    render(<MemoryRouter><CashierPage /></MemoryRouter>);
    fireEvent.click(await screen.findByText("Mesa 1"));
    await screen.findByText("Pedido #9007199254740993");

    fireEvent.change(screen.getByPlaceholderText("Nº"), { target: { value: " 2 " } });
    fireEvent.click(screen.getByRole("button", { name: "Transferir" }));

    await waitFor(() => expect(transferTableSession).toHaveBeenCalledWith(session.id, "2"));
    await waitFor(() => expect(listTableSessions).toHaveBeenCalledTimes(2));
  });
});
