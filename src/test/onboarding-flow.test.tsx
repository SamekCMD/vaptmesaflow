import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/restaurants", () => ({
  createOnboarding: vi.fn(),
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

import OnboardingPage from "@/pages/onboarding/OnboardingPage";
import { getGuideChecklistState, OverviewGuideChecklist } from "@/pages/dashboard/Overview";
import { createOnboarding } from "@/lib/restaurants";
import {
  EMPTY_GUIDE_PROGRESS,
  POST_SETUP_PRIMARY_ACTION,
  POST_SETUP_SECONDARY_ACTION,
  markGuideModuleComplete,
} from "@/lib/onboarding";

const mockedCreateOnboarding = vi.mocked(createOnboarding);

afterEach(() => {
  vi.clearAllMocks();
});

describe("onboarding flow", () => {
  const clickNext = () => fireEvent.click(screen.getByRole("button", { name: /próximo/i }));

  beforeEach(() => {
    mockedCreateOnboarding.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      name: "Vapt Burger",
      slug: "vapt-burger",
    } as never);
  });

  const fillAtomicOnboarding = () => {
    fireEvent.change(screen.getByLabelText("Nome do Restaurante"), {
      target: { value: "Vapt Burger" },
    });
    clickNext();
    fireEvent.change(screen.getByLabelText("Nome do Prato"), {
      target: { value: "X-Burguer Especial" },
    });
    fireEvent.change(screen.getByLabelText("Preço (R$)"), {
      target: { value: "29.90" },
    });
  };

  it("collects only the fields persisted by the atomic onboarding endpoint", () => {
    render(<MemoryRouter><OnboardingPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Nome do Restaurante"), {
      target: { value: "Vapt Burger" },
    });
    expect(screen.getByDisplayValue("vapt-burger")).toBeInTheDocument();
    expect(screen.queryByText(/whatsapp/i)).not.toBeInTheDocument();
    clickNext();

    expect(screen.getByRole("heading", { name: "Primeiro prato" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do Prato")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço (R$)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Categoria")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Descrição")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finalizar" })).toBeInTheDocument();
  });

  it("creates restaurant and first dish through the credentialed API contract", async () => {
    render(<MemoryRouter><OnboardingPage /></MemoryRouter>);

    fillAtomicOnboarding();
    fireEvent.click(screen.getByRole("button", { name: "Finalizar" }));

    await waitFor(() => expect(mockedCreateOnboarding).toHaveBeenCalledWith({
      restaurantName: "Vapt Burger",
      slug: "vapt-burger",
      dishName: "X-Burguer Especial",
      dishPrice: "29.90",
    }));
  });

  it("shows the post-setup choice state with caixa and guide actions after finish", async () => {
    render(<MemoryRouter><OnboardingPage /></MemoryRouter>);

    fillAtomicOnboarding();
    fireEvent.click(screen.getByRole("button", { name: "Finalizar" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: POST_SETUP_PRIMARY_ACTION.label })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: POST_SETUP_SECONDARY_ACTION.label })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Operação pronta" })).toBeInTheDocument();
    });
  });

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
