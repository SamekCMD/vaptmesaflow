import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    session: null,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ refetch: vi.fn() }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => children ?? null,
  BarChart: ({ children }: { children?: ReactNode }) => children ?? null,
  CartesianGrid: () => null,
  Bar: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

import { getGuideChecklistState, OverviewGuideChecklist } from "@/pages/dashboard/Overview";
import {
  EMPTY_GUIDE_PROGRESS,
  markGuideModuleComplete,
} from "@/lib/onboarding";

afterEach(() => {
  vi.clearAllMocks();
});

describe("onboarding flow", () => {
  it("shows overview checklist only when guide modules remain incomplete", () => {
    const guideState = getGuideChecklistState({
      ...EMPTY_GUIDE_PROGRESS,
      cashier: true,
      overview: true,
    });

    expect(guideState.showGuideChecklist).toBe(true);
    expect(guideState.remainingGuideModules).toEqual(["menu", "kitchen", "settings"]);
  });

  it("marks modules complete when the user opens guided modules from the overview flow", () => {
    const progress = markGuideModuleComplete(EMPTY_GUIDE_PROGRESS, "cashier");

    expect(progress.cashier).toBe(true);
    expect(progress.menu).toBe(false);
  });

  it("lists the five guide modules and hides itself when all are complete", async () => {
    const { rerender } = render(
      <MemoryRouter><OverviewGuideChecklist guideProgress={EMPTY_GUIDE_PROGRESS} /></MemoryRouter>,
    );

    expect(screen.getByText("Próximos passos")).toBeInTheDocument();
    expect(screen.getByText("Caixa")).toBeInTheDocument();
    expect(screen.getByText("Cardápio")).toBeInTheDocument();
    expect(screen.getByText("Cozinha")).toBeInTheDocument();
    expect(screen.getByText("Configurações")).toBeInTheDocument();
    expect(screen.getByText("Visão geral / métricas")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <OverviewGuideChecklist guideProgress={{
          cashier: true,
          menu: true,
          kitchen: true,
          settings: true,
          overview: true,
        }} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryByText("Próximos passos")).toBeNull());
  });
});
