import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const onboardingMocks = vi.hoisted(() => ({
  draft: null as null | Record<string, unknown>,
  mutateAsync: vi.fn(),
}));

vi.mock("@/features/auth/use-account-bootstrap", () => ({
  useAccountBootstrap: () => ({
    data: { currentOrganizationId: "org-1", currentRestaurantId: null },
  }),
}));

vi.mock("@/features/onboarding/use-onboarding-draft", () => ({
  useOnboardingDraft: () => ({ data: onboardingMocks.draft }),
  useSaveOnboardingDraft: () => ({ mutateAsync: onboardingMocks.mutateAsync }),
}));

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

vi.mock("@/lib/supabase", () => ({
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
import { supabase } from "@/lib/supabase";
import {
  EMPTY_GUIDE_PROGRESS,
  POST_SETUP_PRIMARY_ACTION,
  POST_SETUP_SECONDARY_ACTION,
  markGuideModuleComplete,
} from "@/lib/onboarding";

afterEach(() => {
  vi.clearAllMocks();
  onboardingMocks.draft = null;
});

beforeEach(() => {
  onboardingMocks.mutateAsync.mockImplementation(async (input) => ({
    ...input,
    id: input.restaurantId ?? "rest-1",
    organizationId: input.organizationId ?? "org-1",
  }));
});

describe("onboarding flow", () => {
  const clickNext = async (expectedSaveCount: number) => {
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));
    await waitFor(() => expect(onboardingMocks.mutateAsync).toHaveBeenCalledTimes(expectedSaveCount));
  };

  it("restores the saved fields and step after reopening onboarding", async () => {
    onboardingMocks.draft = {
      id: "rest-1",
      organizationId: "org-1",
      name: "Vapt Burger",
      slug: "vapt-burger",
      whatsapp: "11999999999",
      primaryColor: "#0ea573",
      secondaryColor: "#1e293b",
      totalTables: 8,
      onboardingStep: 2,
    };

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Primeiro prato" })).toBeInTheDocument();
  });

  it("keeps the starter menu inputs on step 2 and the operation setup on step 3", async () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Nome do Restaurante"), {
      target: { value: "Vapt Burger" },
    });
    await clickNext(1);
    await clickNext(2);

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
    await clickNext(3);

    expect(screen.getByRole("heading", { name: "Primeira operação" })).toBeInTheDocument();
    expect(screen.getByLabelText("Número inicial de mesas")).toBeInTheDocument();
    expect(screen.getByText(/você pode alterar isso depois nas configurações\./i)).toBeInTheDocument();
  });

  it("reuses the persisted draft without writing legacy subscription fields", async () => {
    const menuInsert = vi.fn().mockResolvedValue({ error: null });
    const restaurantUpdate = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "restaurants") {
        return { update: restaurantUpdate } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === "menu_items") {
        return { insert: menuInsert } as unknown as ReturnType<typeof supabase.from>;
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
    await clickNext(1);
    await clickNext(2);

    fireEvent.change(screen.getByLabelText("Nome do Prato"), {
      target: { value: "X-Burguer Especial" },
    });
    fireEvent.change(screen.getByLabelText("Preço (R$)"), {
      target: { value: "29.90" },
    });
    await clickNext(3);

    fireEvent.change(screen.getByLabelText("Número inicial de mesas"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Finalizar" }));

    await waitFor(() => {
      expect(onboardingMocks.mutateAsync).toHaveBeenLastCalledWith(
        expect.objectContaining({
          restaurantId: "rest-1",
          name: "Vapt Burger",
          slug: "vapt-burger",
          totalTables: 3,
          onboardingStep: 3,
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

    const restaurantPayload = onboardingMocks.mutateAsync.mock.calls.at(-1)?.[0];
    expect(restaurantPayload).not.toHaveProperty("plan_type");
    expect(restaurantPayload).not.toHaveProperty("plan_status");
    expect(restaurantPayload).not.toHaveProperty("trial_ends_at");
  });

  it("shows the post-setup choice state with caixa and guide actions after finish", async () => {
    const menuInsert = vi.fn().mockResolvedValue({ error: null });
    const restaurantUpdate = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "restaurants") {
        return { update: restaurantUpdate } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === "menu_items") {
        return { insert: menuInsert } as unknown as ReturnType<typeof supabase.from>;
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
    await clickNext(1);
    await clickNext(2);

    fireEvent.change(screen.getByLabelText("Nome do Prato"), {
      target: { value: "X-Burguer Especial" },
    });
    fireEvent.change(screen.getByLabelText("Preço (R$)"), {
      target: { value: "29.90" },
    });
    await clickNext(3);

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

