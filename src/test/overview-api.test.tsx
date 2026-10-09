import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OverviewDto } from "@/lib/business-api.types";
import { fetchOwnedOverview } from "@/lib/overview";
import Overview from "@/pages/dashboard/Overview";

const { authUser } = vi.hoisted(() => ({ authUser: { id: "owner-1" } }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ refetch: vi.fn() }),
}));

vi.mock("@/lib/overview", () => ({
  fetchOwnedOverview: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const response: OverviewDto = {
  period: "week",
  periodStart: "2026-09-20T00:00:00.000Z",
  restaurant: {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Vapt Burger",
    paymentMode: "open_tab",
    onboardingCompleted: true,
    deliveryEnabled: false,
  },
  orders: [{
    id: "30000000-0000-4000-8000-000000000001",
    displayId: "9007199254740993",
    totalPrice: "59.80",
    status: "delivered",
    createdAt: "2026-09-25T12:00:00.000Z",
    updatedAt: "2026-09-25T12:20:00.000Z",
    items: [{ productName: "Executivo", quantity: 2, unitPrice: "29.90" }],
  }],
  feedback: [],
};

describe("overview API cutover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchOwnedOverview).mockImplementation(async (period) => ({ ...response, period }));
  });

  it("loads the owner-scoped server period without Supabase fan-out", async () => {
    render(<MemoryRouter><Overview /></MemoryRouter>);

    expect(await screen.findByText("Vapt Burger")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 59,80").length).toBeGreaterThan(0);
    expect(fetchOwnedOverview).toHaveBeenCalledWith("week");
  });

  it("requests a new complete server snapshot when the period changes", async () => {
    render(<MemoryRouter><Overview /></MemoryRouter>);
    await screen.findByText("Vapt Burger");

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    await waitFor(() => expect(fetchOwnedOverview).toHaveBeenLastCalledWith("day"));
  });
});
