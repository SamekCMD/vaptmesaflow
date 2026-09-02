import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const onboardingMocks = vi.hoisted(() => ({
  draft: null as null | Record<string, unknown>,
  mutateAsync: vi.fn(),
  finalizeAsync: vi.fn(),
}));

vi.mock("@/features/auth/use-account-bootstrap", () => ({
  useAccountBootstrap: () => ({
    data: { currentOrganizationId: "org-1", currentRestaurantId: null },
  }),
}));

vi.mock("@/features/onboarding/use-onboarding-draft", () => ({
  useOnboardingDraft: () => ({ data: onboardingMocks.draft }),
  useSaveOnboardingDraft: () => ({ mutateAsync: onboardingMocks.mutateAsync }),
  useFinalizeOnboarding: () => ({ mutateAsync: onboardingMocks.finalizeAsync }),
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
import {
  getGuideChecklistState,
  OverviewGuideChecklist,
  shouldShowActivationChecklist,
} from "@/pages/dashboard/Overview";
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
  onboardingMocks.finalizeAsync.mockResolvedValue({
    id: "rest-1",
    organizationId: "org-1",
    status: "complete",
    completedAt: "2026-09-01T12:00:00.000Z",
  });
});

describe("onboarding flow", () => {
  const clickNext = async (expectedSaveCount: number) => {
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));
    await waitFor(() => expect(onboardingMocks.mutateAsync).toHaveBeenCalledTimes(expectedSaveCount));
  };

  const fillBasics = () => {
    fireEvent.change(screen.getByLabelText(/nome do restaurante/i), {
      target: { value: "Vapt Burger" },
    });
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
      localEnabled: true,
      deliveryEnabled: false,
    };

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Pronto para começar" })).toBeInTheDocument();
    expect(screen.getByText("Salão")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("uses the focused basics, operation and ready steps without forced activation tasks", async () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    fillBasics();
    await clickNext(1);
    expect(screen.getByRole("heading", { name: "Como você atende hoje?" })).toBeInTheDocument();
    expect(screen.queryByText("Logo do Restaurante")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nome do Prato")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Número inicial de mesas")).toBeInTheDocument();
    await clickNext(2);
    expect(screen.getByRole("heading", { name: "Pronto para começar" })).toBeInTheDocument();
  });

  it("reuses the persisted draft without writing legacy subscription fields", async () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    fillBasics();
    await clickNext(1);
    fireEvent.change(screen.getByLabelText(/número inicial de mesas/i), {
      target: { value: "3" },
    });
    await clickNext(2);
    fireEvent.click(screen.getByRole("button", { name: "Finalizar" }));

    await waitFor(() => {
      expect(onboardingMocks.mutateAsync).toHaveBeenLastCalledWith(
        expect.objectContaining({
          restaurantId: "rest-1",
          name: "Vapt Burger",
          slug: "vapt-burger",
          totalTables: 3,
          localEnabled: true,
          deliveryEnabled: false,
          onboardingStep: 2,
        })
      );
      expect(onboardingMocks.finalizeAsync).toHaveBeenCalledWith("rest-1");
    });

    expect(supabase.from).not.toHaveBeenCalledWith("restaurants");

    const restaurantPayload = onboardingMocks.mutateAsync.mock.calls.at(-1)?.[0];
    expect(restaurantPayload).not.toHaveProperty("plan_type");
    expect(restaurantPayload).not.toHaveProperty("plan_status");
    expect(restaurantPayload).not.toHaveProperty("trial_ends_at");
  });

  it("shows the post-setup choice state with caixa and guide actions after finish", async () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    fillBasics();
    await clickNext(1);
    await clickNext(2);
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

  it("keeps the ready step when atomic finalization fails", async () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    fillBasics();
    await clickNext(1);
    await clickNext(2);
    onboardingMocks.finalizeAsync.mockRejectedValueOnce(new Error("Falha na finalização"));
    fireEvent.click(screen.getByRole("button", { name: "Finalizar" }));

    await waitFor(() => expect(onboardingMocks.finalizeAsync).toHaveBeenCalledWith("rest-1"));
    expect(screen.getByRole("heading", { name: "Pronto para começar" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Operação pronta" })).not.toBeInTheDocument();
  });

  it("hides the table count for delivery and persists the selected mode", async () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    fillBasics();
    await clickNext(1);
    fireEvent.click(screen.getByRole("radio", { name: /delivery pedidos/i }));

    expect(screen.queryByLabelText(/número inicial de mesas/i)).not.toBeInTheDocument();
    await clickNext(2);
    expect(onboardingMocks.mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ localEnabled: false, deliveryEnabled: true, onboardingStep: 2 })
    );
  });

  it("saves before returning to the basics step", async () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    fillBasics();
    await clickNext(1);
    fireEvent.click(screen.getByRole("button", { name: /voltar/i }));

    await waitFor(() => expect(onboardingMocks.mutateAsync).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("heading", { name: "Vamos criar seu restaurante" })).toBeInTheDocument();
    expect(onboardingMocks.mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ restaurantId: "rest-1", onboardingStep: 0 })
    );
  });

  it("maps a duplicate slug to the field and keeps the entered data", async () => {
    onboardingMocks.mutateAsync.mockRejectedValueOnce({ code: "23505" });
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    fillBasics();
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));

    expect(await screen.findByText("Este endereço de cardápio já está em uso.")).toBeInTheDocument();
    expect(screen.getByLabelText(/nome do restaurante/i)).toHaveValue("Vapt Burger");
    expect(screen.getByRole("heading", { name: "Vamos criar seu restaurante" })).toBeInTheDocument();
  });

  it("keeps the current operation step when saving fails", async () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    fillBasics();
    await clickNext(1);
    fireEvent.click(screen.getByRole("radio", { name: /ambos salão/i }));
    onboardingMocks.mutateAsync.mockRejectedValueOnce(new Error("Falha temporária"));
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));

    await waitFor(() => expect(onboardingMocks.mutateAsync).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("heading", { name: "Como você atende hoje?" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /ambos salão/i })).toBeChecked();
  });

  it("disables navigation and ignores duplicate clicks while saving", async () => {
    let releaseSave: ((value: Record<string, unknown>) => void) | undefined;
    onboardingMocks.mutateAsync.mockImplementationOnce(
      () => new Promise<Record<string, unknown>>((resolve) => { releaseSave = resolve; })
    );
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    fillBasics();
    const nextButton = screen.getByRole("button", { name: /próximo/i });
    fireEvent.click(nextButton);

    expect(nextButton).toBeDisabled();
    fireEvent.click(nextButton);
    expect(onboardingMocks.mutateAsync).toHaveBeenCalledTimes(1);

    releaseSave?.({ id: "rest-1" });
    expect(await screen.findByRole("heading", { name: "Como você atende hoje?" })).toBeInTheDocument();
  });

  it("shows overview checklist only when guide modules remain incomplete", () => {
    const guideState = getGuideChecklistState({
      ...EMPTY_GUIDE_PROGRESS,
      cashier: true,
      overview: true,
    });

    expect(guideState.showGuideChecklist).toBe(true);
    expect(guideState.remainingGuideModules).toEqual(["menu", "kitchen", "settings"]);
    expect(shouldShowActivationChecklist({
      guideProgress: guideState,
      onboardingCompleted: true,
      hasLoadedProgress: true,
    })).toBe(true);
    expect(shouldShowActivationChecklist({
      guideProgress: guideState,
      onboardingCompleted: false,
      hasLoadedProgress: true,
    })).toBe(false);
    expect(shouldShowActivationChecklist({
      guideProgress: guideState,
      onboardingCompleted: true,
      hasLoadedProgress: false,
    })).toBe(false);
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

