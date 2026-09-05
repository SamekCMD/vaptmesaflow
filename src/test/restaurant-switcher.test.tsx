import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  switchAsync: vi.fn(),
}));

import { RestaurantSwitcher } from "@/features/restaurants/RestaurantSwitcher";

const bootstrap = {
  userId: "user-1",
  currentOrganizationId: "org-1",
  currentRestaurantId: "rest-1",
  destination: "dashboard" as const,
  organizations: [{ id: "org-1", name: "Grupo Vapt", role: "owner" as const }],
  restaurants: [
    { id: "rest-1", organizationId: "org-1", name: "Centro", slug: "centro", onboardingStatus: "complete" as const },
    { id: "rest-2", organizationId: "org-1", name: "Zona Sul", slug: "zona-sul", onboardingStatus: "complete" as const },
  ],
};

describe("restaurant switcher", () => {
  beforeEach(() => mocks.switchAsync.mockReset().mockResolvedValue(undefined));

  it("persists another accessible restaurant before marking it selected", async () => {
    render(
      <MemoryRouter>
        <RestaurantSwitcher
          bootstrap={bootstrap}
          entitlement={{ canCreate: true, currentRestaurants: 2, maxRestaurants: 25, planType: "business", role: "owner", reason: null }}
          onSwitch={mocks.switchAsync}
        />
      </MemoryRouter>,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: /restaurante atual: centro/i }), {
      key: "Enter",
      code: "Enter",
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: /zona sul/i }));

    await waitFor(() => expect(mocks.switchAsync).toHaveBeenCalledWith("rest-2"));
  });

  it("offers restaurant creation only when the server capability allows it", async () => {
    const { rerender } = render(
      <MemoryRouter>
        <RestaurantSwitcher
          bootstrap={bootstrap}
          entitlement={{ canCreate: true, currentRestaurants: 2, maxRestaurants: 25, planType: "business", role: "owner", reason: null }}
          onSwitch={mocks.switchAsync}
        />
      </MemoryRouter>,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: /restaurante atual: centro/i }), {
      key: "Enter",
      code: "Enter",
    });
    expect(screen.getByRole("menuitem", { name: /adicionar restaurante/i })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape", code: "Escape" });

    rerender(
      <MemoryRouter>
        <RestaurantSwitcher
          bootstrap={bootstrap}
          entitlement={{ canCreate: false, currentRestaurants: 1, maxRestaurants: 1, planType: "starter", role: "owner", reason: "plan_limit" }}
          onSwitch={mocks.switchAsync}
        />
      </MemoryRouter>,
    );

    const trigger = await screen.findByRole("button", { name: /restaurante atual: centro/i });
    fireEvent.keyDown(trigger, {
      key: "Enter",
      code: "Enter",
    });
    expect(screen.queryByRole("menuitem", { name: /adicionar restaurante/i })).not.toBeInTheDocument();
    expect(screen.getByText(/limite de 1 restaurante atingido/i)).toBeInTheDocument();
  });
});
