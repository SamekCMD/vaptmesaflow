import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppearancePage from "@/pages/dashboard/AppearancePage";
import SettingsPage from "@/pages/dashboard/SettingsPage";
import OnboardingPage from "@/pages/onboarding/OnboardingPage";
import { vaptApiRequest } from "@/lib/vapt-api-client";
import { catalogState } from "./public-catalog-fixture";
const auth = vi.hoisted(() => ({ user: { id: "owner", name: "Gestor", email: "owner@synthetic.test" }, updateName: vi.fn(), changePassword: vi.fn() }));
vi.mock("@/features/restaurants/current-restaurant",()=>({useCurrentRestaurant:()=>({scope:auth.user.id?{userId:auth.user.id,restaurantId:catalogState().catalog.restaurant.id}:null,organizationId:"test-org",restaurant:{id:catalogState().catalog.restaurant.id},capabilities:["restaurant.read","restaurant.operate","restaurant.manage","billing.read","billing.manage"],loading:false,error:null})}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/lib/env", async original => ({ ENV: { ...(await original<typeof import("@/lib/env")>()).ENV, publicCatalogEventsEnabled: true } }));
vi.mock("@/lib/vapt-api-client", async original => ({ ...(await original<typeof import("@/lib/vapt-api-client")>()), vaptApiRequest: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); localStorage.clear();
  vi.mocked(vaptApiRequest).mockImplementation(async input => input.method === "GET" ? catalogState().catalog.restaurant as never : {
    receipt: { operationId: input.headers?.["Idempotency-Key"], restaurantId: catalogState().catalog.restaurant.id,
      phase: "committed", version: "12", committed: true, retryable: true },
  } as never);
});
afterEach(cleanup);
describe("restaurant writer pages respect publication receipts", () => {
  it("appearance does not report published before ready and blocks repeated writes", async () => {
    render(<AppearancePage />); await screen.findByDisplayValue("Bistrô"); fireEvent.click(screen.getByRole("button", { name: "Salvar alteracoes" }));
    expect(await screen.findByText("Gravada; publicação pendente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar alteracoes" })).toBeDisabled();
    expect(vi.mocked(vaptApiRequest).mock.calls.find(([value]) => value.method === "PATCH")?.[0].headers?.["X-Vapt-Catalog-Protocol"]).toBe("1");
  });
  it("restaurant settings block a conflicting save while publication is pending", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>); await screen.findByDisplayValue("Bistrô");
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar/i })[0]!);
    expect(await screen.findByText("Gravada; publicação pendente")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Salvar/i })[0]).toBeDisabled();
  });
  it("onboarding cannot show operation ready or create a second restaurant after202", async () => {
    render(<MemoryRouter><OnboardingPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Nome do Restaurante"), { target: { value: "Bistrô" } }); fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    fireEvent.change(screen.getByLabelText("Nome do Prato"), { target: { value: "Prato" } }); fireEvent.change(screen.getByLabelText("Preço (R$)"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Finalizar" }));
    expect(screen.queryByText("Operação pronta")).not.toBeInTheDocument();
    expect(vi.mocked(vaptApiRequest).mock.calls.some(([input])=>input.method==="POST")).toBe(false);
  });
});
