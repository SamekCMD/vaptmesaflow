import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MenuManagement from "@/pages/dashboard/MenuManagement";
import { vaptApiRequest } from "@/lib/vapt-api-client";
import type { MenuItemDto } from "@/lib/business-api.types";
const environment = vi.hoisted(() => ({ user: { id: "11111111-1111-4111-8111-111111111111" }, reader: true }));
vi.mock("@/features/restaurants/current-restaurant",()=>({useCurrentRestaurant:()=>({scope:environment.user?.id?{userId:environment.user?.id,restaurantId:restaurantId}:null,organizationId:"test-org",restaurant:null,loading:false,error:null})}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: environment.user }) }));
vi.mock("@/lib/env", async original => ({ ENV: { ...(await original<typeof import("@/lib/env")>()).ENV, get publicCatalogEventsEnabled() { return environment.reader; }, publicCatalogWriterEnabled: true, menuImageStorageMode: "r2" } }));
vi.mock("@/lib/vapt-api-client", async original => ({ ...(await original<typeof import("@/lib/vapt-api-client")>()), vaptApiRequest: vi.fn() }));
vi.mock("@/lib/menu-image-optimization", () => ({ optimizeMenuImage: async (image: Blob) => image }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
const restaurantId = "22222222-2222-4222-8222-222222222222";
const itemId = "33333333-3333-4333-8333-333333333333";
const objectKey = `${restaurantId}/${itemId}/44444444-4444-4444-8444-444444444444`;
const item = (): MenuItemDto => ({ id: itemId, restaurantId, name: "Prato do dia", price: "23.50", description: null, category: "Pratos", available: true,
  imageUrl: null, availableFrom: null, availableUntil: null, badge: null, isChefSuggestion: false, prepTimeMinutes: 15,
  createdAt: "2026-10-16T00:00:00Z", updatedAt: "2026-10-16T00:00:00Z", variations: [] });
let currentItem: MenuItemDto; let phase: "committed" | "ready"; let key: string; let published: boolean;
const receipt = (operationId: string, value = phase) => ({ operationId, restaurantId, phase: value, version: "12", committed: true, retryable: value !== "ready" });
beforeEach(() => {
  vi.clearAllMocks(); phase = "committed"; currentItem = item(); published = false; key = "";
  vi.mocked(vaptApiRequest).mockImplementation(async options => {
    if (options.method === "GET" && options.route === "/restaurants/22222222-2222-4222-8222-222222222222") return { id: restaurantId, name: "Bistrô" } as never;
    if (options.method === "GET" && options.route === "/restaurants/22222222-2222-4222-8222-222222222222/menu-items") return [{ ...currentItem, name: published ? "Prato publicado" : currentItem.name }] as never;
    if (options.route.endsWith("/retry")) { published = true; return receipt(key, "ready") as never; }
    if (options.route.endsWith("/image/upload")) return { state: "uploaded", publicUrl: `https://assets.test/${objectKey}`, objectKey } as never;
    if (options.route.endsWith("/image")) return null as never;
    key = options.headers?.["Idempotency-Key"] ?? "";
    return { receipt: receipt(key), ...(phase === "ready" ? { result: { ...currentItem, ...(options.body as object) } } : {}) } as never;
  });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("A completed upload must never PUT again")));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const page = () => render(<MemoryRouter><MenuManagement /></MemoryRouter>);
describe.each([true, false])("owner menu receipt and image ordering integration, reader=%s", reader => {
  beforeEach(() => { environment.reader = reader; });
  it("shows committed-not-ready, blocks another save and reloads after manual ready", async () => {
    page(); await screen.findByText("Prato do dia"); fireEvent.click(screen.getByRole("button", { name: "Editar Prato do dia" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Gravada; publicação pendente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar Item" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remover Prato do dia" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar publicação novamente" }));
    expect(await screen.findByText("Prato publicado")).toBeInTheDocument(); expect(screen.getByText("Publicada")).toBeInTheDocument();
    expect(vi.mocked(vaptApiRequest).mock.calls.filter(([value]) => value.method === "PATCH")).toHaveLength(1);
  });
  it("never deletes a published image or removes the row while deletion is pending", async () => {
    currentItem.imageUrl = `https://assets.test/${objectKey}`;
    page(); await screen.findByText("Prato do dia"); fireEvent.click(screen.getByRole("button", { name: "Remover Prato do dia" }));
    await screen.findByText("Gravada; publicação pendente"); expect(screen.getByText("Prato do dia")).toBeInTheDocument();
    expect(vi.mocked(vaptApiRequest).mock.calls.filter(([value]) => value.method === "DELETE").map(([value]) => value.route)).toEqual([`/restaurants/22222222-2222-4222-8222-222222222222/menu-items/${itemId}`]);
  });
  it("deletes the domain first, then asks authenticated cleanup for the exact old object", async () => {
    phase = "ready"; currentItem.imageUrl = `https://assets.test/${objectKey}`;
    page(); await screen.findByText("Prato do dia"); fireEvent.click(screen.getByRole("button", { name: "Remover Prato do dia" }));
    await waitFor(() => expect(screen.queryByText("Prato do dia")).not.toBeInTheDocument());
    const deletes = vi.mocked(vaptApiRequest).mock.calls.filter(([value]) => value.method === "DELETE").map(([value]) => value);
    expect(deletes.map(value => value.route)).toEqual([`/restaurants/22222222-2222-4222-8222-222222222222/menu-items/${itemId}`, `/restaurants/${restaurantId}/menu-items/${itemId}/image`]);
    expect(deletes[1]!.query).toEqual({ objectKey });
  });
  it("imageSecondPatchUsesNewOperation and uploaded replay sends no replacement PUT", async () => {
    phase = "ready"; const view = page(); await screen.findByText("Prato do dia");
    fireEvent.click(screen.getByRole("button", { name: "Editar Prato do dia" }));
    vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:synthetic-image"; } });
    const input = view.container.ownerDocument.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(["webp"], "image.webp", { type: "image/webp" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(vi.mocked(vaptApiRequest).mock.calls.filter(([value]) => value.method === "PATCH")).toHaveLength(2));
    const commands = vi.mocked(vaptApiRequest).mock.calls.map(([value]) => value).filter(value => value.method === "PATCH");
    expect(commands[0]!.headers?.["Idempotency-Key"]).toBeTruthy();
    expect(commands[1]!.headers?.["Idempotency-Key"]).not.toBe(commands[0]!.headers?.["Idempotency-Key"]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["descriptor", "put"])("reuses the file upload lease after a lost %s response", async failure => {
    phase = "ready";
    const original = vi.mocked(vaptApiRequest).getMockImplementation()!;
    let attempts = 0;
    vi.mocked(vaptApiRequest).mockImplementation(async options => {
      if (options.route.endsWith("/image/upload") && attempts++ === 0) {
        if (failure === "descriptor") throw new Error("Descriptor response lost");
        return { state: "upload_required", publicUrl: `https://assets.test/${objectKey}`, objectKey,
          method: "PUT", uploadUrl: "https://storage.test/signed", headers: { "Content-Type": "image/webp", "If-Match": '"fence"' }, expiresInSeconds: 300 } as never;
      }
      return original(options);
    });
    const view = page(); await screen.findByText("Prato do dia");
    fireEvent.click(screen.getByRole("button", { name: "Editar Prato do dia" }));
    vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:synthetic-image"; } });
    fireEvent.change(view.container.ownerDocument.querySelector('input[type="file"]')!, { target: { files: [new File(["webp"], "image.webp", { type: "image/webp" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument());
    const uploads = vi.mocked(vaptApiRequest).mock.calls.map(([value]) => value).filter(value => value.route.endsWith("/image/upload"));
    expect(uploads).toHaveLength(2);
    expect(uploads[0]!.headers?.["Idempotency-Key"]).toBeTruthy();
    expect(uploads[1]!.headers?.["Idempotency-Key"]).toBe(uploads[0]!.headers?.["Idempotency-Key"]);
    expect(fetch).toHaveBeenCalledTimes(failure === "put" ? 1 : 0);
  });
  it("offers explicit authenticated cleanup after reopening without a remembered image target", async () => {
    const original = vi.mocked(vaptApiRequest).getMockImplementation()!;
    vi.mocked(vaptApiRequest).mockImplementation(async options => options.route.endsWith("/menu-images/reconcile")
      ? { checked: 10, retired: 9, protected: 1 } as never : original(options));
    const first = page(); await screen.findByText("Prato do dia"); first.unmount();
    page(); await screen.findByText("Prato do dia");
    expect(vi.mocked(vaptApiRequest).mock.calls.some(([value]) => value.route.endsWith("/menu-images/reconcile"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Limpar uploads antigos" }));
    await screen.findByText(/9 uploads liberados/);
    const calls = vi.mocked(vaptApiRequest).mock.calls.map(([value]) => value).filter(value => value.route.endsWith("/menu-images/reconcile"));
    expect(calls).toHaveLength(1); expect(calls[0]!.method).toBe("POST"); expect(calls[0]!.route).toBe(`/restaurants/${restaurantId}/menu-images/reconcile`);
    expect(vi.mocked(vaptApiRequest).mock.calls.some(([value]) => value.method === "DELETE")).toBe(false);
  });
});
