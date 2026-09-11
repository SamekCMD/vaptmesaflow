import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tenant: "a" as string | null,
  user: { id: "user-1", email: "test@example.com", user_metadata: {} },
  load: vi.fn(), update: vi.fn(), updateEq: vi.fn(), rpc: vi.fn(),
  upload: vi.fn(), remove: vi.fn(), toast: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/features/restaurants/current-restaurant", () => ({
  useCurrentRestaurant: () => ({ restaurantId: mocks.tenant, restaurant: { id: mocks.tenant, organizationId: "org-1" } }),
}));
vi.mock("@/features/onboarding/use-activation-progress", () => ({ useCompleteActivationModule: () => ({ mutateAsync: vi.fn() }) }));
vi.mock("@/components/payments/CurrentPaymentMethodsCard", () => ({ default: () => null }));
vi.mock("@/components/payments/MercadoPagoSettingsCard", () => ({ default: () => null }));
vi.mock("@/hooks/use-toast", () => ({ toast: mocks.toast }));
vi.mock("@/lib/supabase", () => ({ supabase: {
  from: () => ({ select: () => ({ eq: (_: string, id: string) => ({ maybeSingle: () => mocks.load(id) }) }), update: mocks.update }),
  rpc: mocks.rpc,
  storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
} }));

import SettingsPage from "@/pages/dashboard/SettingsPage";
import AppearancePage from "@/pages/dashboard/AppearancePage";

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const row = (id: string) => ({ data: { id, name: `Restaurant ${id}`, slug: `slug-${id}`, logo_url: "", payment_mode: "open_tab" }, error: null });

function mount(Page: typeof SettingsPage) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["account-bootstrap", "user-1", null], { slug: "slug-a" });
  const ui = () => <QueryClientProvider client={client}><MemoryRouter><Page /></MemoryRouter></QueryClientProvider>;
  const result = render(ui());
  return { ...result, client, switchTo: (tenant: string | null) => { mocks.tenant = tenant; result.rerender(ui()); } };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.tenant = "a";
  mocks.load.mockImplementation(async (id) => row(id));
  mocks.update.mockReturnValue({ eq: mocks.updateEq });
  mocks.updateEq.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  mocks.remove.mockResolvedValue({ error: null });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:tenant-a") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});
afterEach(cleanup);

describe.each([["settings", SettingsPage], ["appearance", AppearancePage]] as const)("%s tenant isolation", (_, Page) => {
  it("hides the previous form and prevents saves during a slow tenant load", async () => {
    const view = mount(Page);
    await screen.findByDisplayValue("Restaurant a");
    const pending = deferred();
    mocks.load.mockReturnValueOnce(pending.promise);
    view.switchTo("b");
    expect(screen.queryByDisplayValue("Restaurant a")).not.toBeInTheDocument();
    for (const button of screen.queryAllByRole("button", { name: /salvar/i })) {
      fireEvent.click(button);
    }
    expect(mocks.update).not.toHaveBeenCalled();
    await act(async () => pending.resolve(row("b")));
    await screen.findByDisplayValue("Restaurant b");
    fireEvent.click(screen.getByRole("button", { name: /salvar altera/i }));
    await waitFor(() => expect(mocks.updateEq).toHaveBeenCalledWith("id", "b"));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ name: "Restaurant b" }));
  });

  it.each(["error", "missing", "rejected", "wrong-id"])("fails closed after a %s load", async (failure) => {
    const view = mount(Page);
    await screen.findByDisplayValue("Restaurant a");
    const pending = deferred();
    mocks.load.mockReturnValueOnce(pending.promise);
    view.switchTo("b");
    await act(async () => {
      if (failure === "rejected") pending.reject(new Error("offline"));
      else pending.resolve(failure === "wrong-id" ? row("a") : { data: null, error: failure === "error" ? new Error("offline") : null });
    });
    expect(screen.queryByDisplayValue("Restaurant a")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    for (const button of screen.queryAllByRole("button", { name: /salvar/i })) fireEvent.click(button);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([false, true])("ignores an obsolete load (failure: %s)", async (failure) => {
    const old = deferred();
    mocks.load.mockReturnValueOnce(old.promise);
    const view = mount(Page);
    view.switchTo("b");
    await screen.findByDisplayValue("Restaurant b");
    await act(async () => old.resolve(failure ? { data: null, error: new Error("old failure") } : row("a")));
    expect(screen.getByDisplayValue("Restaurant b")).toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("clears the form when no tenant is selected", async () => {
    const view = mount(Page);
    await screen.findByDisplayValue("Restaurant a");
    view.switchTo(null);
    expect(screen.queryByDisplayValue("Restaurant a")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /salvar altera/i })).not.toBeInTheDocument();
  });

  it("does not revive an old load after switching away and back", async () => {
    const old = deferred();
    mocks.load.mockReturnValueOnce(old.promise);
    const view = mount(Page);
    view.switchTo("b");
    await screen.findByDisplayValue("Restaurant b");
    view.switchTo("a");
    const input = await screen.findByDisplayValue("Restaurant a");
    fireEvent.change(input, { target: { value: "Fresh edit" } });
    await act(async () => old.resolve(row("a")));
    expect(screen.getByDisplayValue("Fresh edit")).toBeInTheDocument();
  });

  it("ignores save errors from the previous tenant", async () => {
    const pending = deferred();
    mocks.updateEq.mockReturnValueOnce(pending.promise);
    const view = mount(Page);
    await screen.findByDisplayValue("Restaurant a");
    fireEvent.click(screen.getByRole("button", { name: /salvar altera/i }));
    await waitFor(() => expect(mocks.updateEq).toHaveBeenCalled());
    view.switchTo("b");
    await screen.findByDisplayValue("Restaurant b");
    await act(async () => pending.resolve({ error: { code: "23505" } }));
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /salvar altera/i })).toBeEnabled();
  });
});

describe("appearance tenant assets and cache", () => {
  it("cancels persistence and removes a staged upload after switching tenants", async () => {
    const pending = deferred();
    mocks.upload.mockReturnValueOnce(pending.promise);
    const view = mount(AppearancePage);
    await screen.findByDisplayValue("Restaurant a");
    fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File(["logo"], "a.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: /salvar altera/i }));
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    const path = mocks.upload.mock.calls[0][0];
    expect(path).toMatch(/^organizations\/org-1\/restaurants\/a\/branding\//);
    view.switchTo("b");
    await screen.findByDisplayValue("Restaurant b");
    await act(async () => pending.resolve({ data: { path }, error: null }));
    expect(mocks.remove).toHaveBeenCalledWith([path]);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(view.client.getQueryState(["account-bootstrap", "user-1", null])?.isInvalidated).toBe(false);
  });

  it("cancels a save waiting for slug validation when the tenant changes", async () => {
    const pending = deferred();
    mocks.rpc.mockReturnValueOnce(pending.promise);
    const view = mount(AppearancePage);
    fireEvent.change(await screen.findByDisplayValue("slug-a"), { target: { value: "changed-a" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar altera/i }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    view.switchTo("b");
    await screen.findByDisplayValue("Restaurant b");
    await act(async () => pending.resolve({ data: [], error: null }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /salvar altera/i })).toBeEnabled();
  });

  it("invalidates a successful in-flight save without notifying the new tenant", async () => {
    const pending = deferred();
    mocks.updateEq.mockReturnValueOnce(pending.promise);
    const view = mount(AppearancePage);
    await screen.findByDisplayValue("Restaurant a");
    fireEvent.click(screen.getByRole("button", { name: /salvar altera/i }));
    await waitFor(() => expect(mocks.updateEq).toHaveBeenCalledWith("id", "a"));
    view.switchTo("b");
    await screen.findByDisplayValue("Restaurant b");
    await act(async () => pending.resolve({ error: null }));
    expect(view.client.getQueryState(["account-bootstrap", "user-1", null])?.isInvalidated).toBe(true);
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Restaurant b")).toBeInTheDocument();
  });

  it("revokes and discards an unsaved logo on tenant switch", async () => {
    const view = mount(AppearancePage);
    await screen.findByDisplayValue("Restaurant a");
    fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File(["logo"], "a.png", { type: "image/png" })] } });
    view.switchTo("b");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:tenant-a");
    await screen.findByDisplayValue("Restaurant b");
    fireEvent.click(screen.getByRole("button", { name: /salvar altera/i }));
    await waitFor(() => expect(mocks.updateEq).toHaveBeenCalledWith("id", "b"));
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("invalidates account-bootstrap only after a successful branding save", async () => {
    const view = mount(AppearancePage);
    const key = ["account-bootstrap", "user-1", null];
    await screen.findByDisplayValue("Restaurant a");
    mocks.updateEq.mockResolvedValueOnce({ error: new Error("failed") });
    fireEvent.click(screen.getByRole("button", { name: /salvar altera/i }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(view.client.getQueryState(key)?.isInvalidated).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /salvar altera/i }));
    await waitFor(() => expect(view.client.getQueryState(key)?.isInvalidated).toBe(true));
  });
});

it("isolates payment save completion and payloads across tenants", async () => {
  const pending = deferred();
  mocks.updateEq.mockReturnValueOnce(pending.promise);
  const view = mount(SettingsPage);
  await screen.findByDisplayValue("Restaurant a");
  fireEvent.click(screen.getByRole("switch", { name: /Exigir pagamento/ }));
  fireEvent.click(screen.getByRole("button", { name: /Salvar fluxo/ }));
  expect(mocks.update).toHaveBeenLastCalledWith({ payment_mode: "prepaid", max_pending_orders: 3 });
  expect(mocks.updateEq).toHaveBeenLastCalledWith("id", "a");
  view.switchTo("b");
  await screen.findByDisplayValue("Restaurant b");
  await act(async () => pending.resolve({ error: new Error("obsolete") }));
  expect(mocks.toast).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Salvar fluxo/ }));
  await waitFor(() => expect(mocks.updateEq).toHaveBeenLastCalledWith("id", "b"));
  expect(mocks.update).toHaveBeenLastCalledWith({ payment_mode: "open_tab", max_pending_orders: 3 });
});
