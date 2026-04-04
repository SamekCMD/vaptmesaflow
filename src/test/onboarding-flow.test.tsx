import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    refetch: vi.fn(),
  }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => children ?? null,
  BarChart: ({ children }: any) => children ?? null,
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
import { supabase } from "@/lib/supabase";
import {
  EMPTY_GUIDE_PROGRESS,
  POST_SETUP_PRIMARY_ACTION,
  POST_SETUP_SECONDARY_ACTION,
  markGuideModuleComplete,
} from "@/lib/onboarding";

afterEach(() => {
  vi.clearAllMocks();
});

describe("onboarding flow", () => {
  const clickNext = () => fireEvent.click(screen.getByRole("button", { name: /próximo/i }));

  it("keeps the starter menu inputs on step 2 and the operation setup on step 3", () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Nome do Restaurante"), {
      target: { value: "Vapt Burger" },
    });
    clickNext();
    clickNext();

    expect(screen.getByRole("heading", { name: "Primeiro prato" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do Prato")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço (R$)")).toBeInTheDocument();
    expect(screen.getByLabelText("Categoria")).toBeInTheDocument();
    expect(screen.getByLabelText("Descrição")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nome do Prato"), {
      target: { value: "X-Burguer Especial" },
    });
    fireEvent.change(screen.getByLabelText("Preço (R$)"), {
      target: { value: "29.90" },
    });
    clickNext();

    expect(screen.getByRole("heading", { name: "Primeira operação" })).toBeInTheDocument();
    expect(screen.getByLabelText("Número inicial de mesas")).toBeInTheDocument();
    expect(screen.getByText(/você pode alterar isso depois nas configurações\./i)).toBeInTheDocument();
  });

  it("creates the restaurant with trial defaults and the starter menu item on finish", async () => {
    const restaurantInsert = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: "rest-1" }, error: null }),
      }),
    }));
    const menuInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "restaurants") {
        return { insert: restaurantInsert } as any;
      }
      if (table === "menu_items") {
        return { insert: menuInsert } as any;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Nome do Restaurante"), {
      target: { value: "Vapt Burger" },
    });
    clickNext();
    clickNext();

    fireEvent.change(screen.getByLabelText("Nome do Prato"), {
      target: { value: "X-Burguer Especial" },
    });
    fireEvent.change(screen.getByLabelText("Preço (R$)"), {
      target: { value: "29.90" },
    });
    clickNext();

    fireEvent.change(screen.getByLabelText("Número inicial de mesas"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Finalizar" }));

    await waitFor(() => {
      expect(restaurantInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          owner_id: "user-1",
          name: "Vapt Burger",
          slug: "vapt-burger",
          plan_type: "starter",
          plan_status: "trialing",
          total_tables: 3,
          max_tables: 3,
          trial_ends_at: expect.any(String),
        })
      );
      expect(menuInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurant_id: "rest-1",
          name: "X-Burguer Especial",
          price: 29.9,
        })
      );
    });
  });

  it("shows the post-setup choice state with caixa and guide actions after finish", async () => {
    const restaurantInsert = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: "rest-1" }, error: null }),
      }),
    }));
    const menuInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "restaurants") {
        return { insert: restaurantInsert } as any;
      }
      if (table === "menu_items") {
        return { insert: menuInsert } as any;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Nome do Restaurante"), {
      target: { value: "Vapt Burger" },
    });
    clickNext();
    clickNext();

    fireEvent.change(screen.getByLabelText("Nome do Prato"), {
      target: { value: "X-Burguer Especial" },
    });
    fireEvent.change(screen.getByLabelText("Preço (R$)"), {
      target: { value: "29.90" },
    });
    clickNext();

    fireEvent.change(screen.getByLabelText("Número inicial de mesas"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Finalizar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: POST_SETUP_PRIMARY_ACTION.label })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: POST_SETUP_SECONDARY_ACTION.label })
      ).toBeInTheDocument();
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
      <MemoryRouter>
        <OverviewGuideChecklist guideProgress={EMPTY_GUIDE_PROGRESS} />
      </MemoryRouter>
    );

    expect(screen.getByText("Próximos passos")).toBeInTheDocument();
    expect(screen.getByText("Caixa")).toBeInTheDocument();
    expect(screen.getByText("Cardápio")).toBeInTheDocument();
    expect(screen.getByText("Cozinha")).toBeInTheDocument();
    expect(screen.getByText("Configurações")).toBeInTheDocument();
    expect(screen.getByText("Visão geral / métricas")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <OverviewGuideChecklist
          guideProgress={{
            cashier: true,
            menu: true,
            kitchen: true,
            settings: true,
            overview: true,
          }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText("Próximos passos")).toBeNull();
    });
  });
});
