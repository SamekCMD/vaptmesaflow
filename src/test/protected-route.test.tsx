import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProtectedRoute from "@/components/ProtectedRoute";

const authState = vi.hoisted(() => ({
  user: { id: "user-1" },
  loading: false,
  recoveryMode: false,
}));

const bootstrapState = vi.hoisted(() => ({
  data: null,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/features/auth/use-account-bootstrap", () => ({
  useAccountBootstrap: () => bootstrapState,
}));

describe("protected route", () => {
  beforeEach(() => {
    authState.user = { id: "user-1" };
    authState.loading = false;
    authState.recoveryMode = false;
    bootstrapState.data = null;
    bootstrapState.isLoading = false;
    bootstrapState.isError = false;
    bootstrapState.refetch.mockReset();
  });

  const renderRoute = (mode: "dashboard" | "onboarding" | "create-restaurant", initialEntry = "/protected") =>
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<div>Login</div>} />
          <Route path="/onboarding" element={<div>Onboarding destination</div>} />
          <Route path="/restaurants/select" element={<div>Restaurant selector</div>} />
          <Route path="/dashboard" element={<div>Dashboard destination</div>} />
          <Route path="/reset-password" element={<div>Password recovery</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute mode={mode}>
                <div>Protected content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

  it("routes unauthenticated users to login", () => {
    authState.user = null;

    renderRoute("dashboard");

    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("prioritizes password recovery even while bootstrap is loading", () => {
    authState.recoveryMode = true;
    bootstrapState.isLoading = true;

    renderRoute("dashboard");

    expect(screen.getByText("Password recovery")).toBeInTheDocument();
  });

  it("shows a retry action when account bootstrap fails", () => {
    bootstrapState.isError = true;

    renderRoute("dashboard");

    expect(screen.getByText("Não foi possível carregar sua conta.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(bootstrapState.refetch).toHaveBeenCalledOnce();
  });

  it("keeps onboarding users on the onboarding route", () => {
    bootstrapState.data = {
      destination: "onboarding",
      currentOrganizationId: "org-1",
      currentRestaurantId: "rest-1",
    };

    renderRoute("onboarding");

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("redirects dashboard routes to onboarding when bootstrap requires setup", () => {
    bootstrapState.data = {
      destination: "onboarding",
      currentOrganizationId: "org-1",
      currentRestaurantId: null,
    };

    renderRoute("dashboard");

    expect(screen.getByText("Onboarding destination")).toBeInTheDocument();
  });

  it("redirects onboarding routes to dashboard when the account is ready", () => {
    bootstrapState.data = {
      destination: "dashboard",
      currentOrganizationId: "org-1",
      currentRestaurantId: "rest-1",
    };

    renderRoute("onboarding");

    expect(screen.getByText("Dashboard destination")).toBeInTheDocument();
  });

  it("redirects ambiguous dashboard state to the selector", () => {
    bootstrapState.data = {
      destination: "select-restaurant",
      currentOrganizationId: "org-1",
      currentRestaurantId: null,
    };

    renderRoute("dashboard");

    expect(screen.getByText("Restaurant selector")).toBeInTheDocument();
  });

  it("renders protected content when the dashboard destination is ready", () => {
    bootstrapState.data = {
      destination: "dashboard",
      currentOrganizationId: "org-1",
      currentRestaurantId: "rest-1",
    };

    renderRoute("dashboard");

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("allows an authenticated ready account to enter explicit restaurant creation", () => {
    bootstrapState.data = {
      destination: "dashboard",
      currentOrganizationId: "org-1",
      currentRestaurantId: "rest-1",
    };

    renderRoute("create-restaurant");

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
