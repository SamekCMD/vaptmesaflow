import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ preference: { currentOrganizationId: "org", currentRestaurantId: "a" }, save: vi.fn(), from: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user" }, recoveryMode: false }) }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/features/auth/account-preferences", async (original) => ({
  ...await original<typeof import("@/features/auth/account-preferences")>(),
  fetchAccountPreference: async () => ({ ...mocks.preference }),
  saveAccountPreference: mocks.save,
}));
import { useAccountBootstrap, useSwitchRestaurant } from "@/features/auth/use-account-bootstrap";

function Harness() {
  const query = useAccountBootstrap();
  const mutation = useSwitchRestaurant();
  const location = useLocation();
  return <>
    <p data-testid="selected">{query.data?.currentRestaurantId}</p>
    <p data-testid="location">{location.pathname}{location.search}{location.hash}</p>
    <button disabled={!query.data} onClick={() => mutation.mutate("b")}>Switch</button>
    {mutation.isError && <p>Switch failed</p>}
  </>;
}

describe("restaurant switch with route override", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.preference = { currentOrganizationId: "org", currentRestaurantId: "a" };
    mocks.save.mockImplementation(async (_user, preference) => { mocks.preference = preference; });
    mocks.from.mockImplementation((table) => ({ select: () => table === "organization_members"
      ? { eq: () => ({ eq: async () => ({ data: [{ organization_id: "org", role: "owner", organizations: { id: "org", name: "Org" } }], error: null }) }) }
      : { in: async () => ({ data: ["a", "b"].map((id) => ({ id, organization_id: "org", name: id, slug: id, onboarding_status: "complete" })), error: null }) }
    }));
  });

  const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter initialEntries={["/dashboard?restaurantId=a&guide=1#summary"]}><Harness /></MemoryRouter>
  </QueryClientProvider>);

  it("removes the old route override and persists only the explicit selection", async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent("a"));
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Switch"));
    await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent("b"));
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard?guide=1#summary");
    expect(mocks.preference.currentRestaurantId).toBe("b");
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  it("keeps the route and selection when saving the preference fails", async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent("a"));
    mocks.save.mockRejectedValue(new Error("offline"));
    fireEvent.click(screen.getByText("Switch"));
    expect(await screen.findByText("Switch failed")).toBeInTheDocument();
    expect(screen.getByTestId("selected")).toHaveTextContent("a");
    expect(screen.getByTestId("location")).toHaveTextContent("restaurantId=a");
  });
});
