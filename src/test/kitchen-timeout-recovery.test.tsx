import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/hooks/use-toast";
import type { KitchenOrderDto } from "@/lib/business-api.types";
import KitchenMonitor from "@/pages/dashboard/KitchenMonitor";

// Keep KitchenMonitor, listKitchenOrders, the HTTP deadline, hook and queue real.
// Only local identity/scope and external socket/HTTP transports are controlled.
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "owner-1" } }) }));
vi.mock("@/lib/restaurants", () => ({ fetchOwnedRestaurant: async () => ({ id: "10000000-0000-4000-8000-000000000001" }) }));
vi.mock("@/lib/env", async original => ({ ENV: { ...(await original<typeof import("@/lib/env")>()).ENV, realtimeEnabled: true } }));
vi.mock("@/lib/realtime/client", () => ({ subscribeRealtime: (_scope, _signal, state) => {
  state("connected"); return () => {};
} }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const order: KitchenOrderDto = {
  id: "30000000-0000-4000-8000-000000000001", displayId: "1",
  restaurantId: "10000000-0000-4000-8000-000000000001", tableNumber: "1",
  totalPrice: "10.00", status: "pending", channel: "local", paymentStatus: "paid",
  createdAt: "2026-10-09T12:00:00.000Z", updatedAt: "2026-10-09T12:00:00.000Z",
  items: [{ id: "40000000-0000-4000-8000-000000000001", productName: "Prato teste",
    quantity: 1, unitPrice: "10.00", notes: "" }],
};
const initial = [1, 2, 3, 4].map(index => ({ ...order,
  id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`, displayId: String(index) }));
let hidden = false;
let originalHidden: PropertyDescriptor | undefined;
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const changeVisibility = (value: boolean) => {
  hidden = value; act(() => document.dispatchEvent(new Event("visibilitychange")));
};

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); hidden = false;
  originalHidden = Object.getOwnPropertyDescriptor(document, "hidden");
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  localStorage.setItem("vapt_kds_sound_enabled", "false");
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.unstubAllGlobals();
  if (originalHidden) Object.defineProperty(document, "hidden", originalHidden);
  else delete (document as unknown as Record<string, unknown>).hidden;
});

describe("kitchen timeout and visibility characterization (no production network)", () => {
  it.each(["fetch", "body"] as const)("keeps four orders through a stalled %s deadline while hidden, then resyncs without applying late data", async stalled => {
    let calls = 0;
    let pendingSignal!: AbortSignal;
    let finishLate!: () => void;
    const lateOrders = [{ ...order, displayId: "99" }];
    vi.stubGlobal("fetch", async (url: string, options: RequestInit) => {
      expect(url).toBe("https://api.test.example.com/restaurants/me/kitchen/orders");
      expect(options.method).toBe("GET"); expect(options.credentials).toBe("include");
      calls++;
      if (calls === 2) {
        pendingSignal = options.signal as AbortSignal;
        // Intentionally ignore abort: the real client's deadline must still
        // reject a late transport/body and unblock its serialized queue.
        if (stalled === "fetch") return new Promise<Response>(resolve => {
          finishLate = () => resolve(new Response(JSON.stringify(lateOrders)));
        });
        return new Response(new ReadableStream({ start(controller) {
          finishLate = () => { controller.enqueue(new TextEncoder().encode(JSON.stringify(lateOrders))); controller.close(); };
        } }));
      }
      return new Response(JSON.stringify(calls === 1 ? initial : [...initial, { ...order,
        id: "30000000-0000-4000-8000-000000000005", displayId: "5" }]));
    });
    const view = render(<MemoryRouter><KitchenMonitor /></MemoryRouter>);
    await advance(0);
    for (const id of [1, 2, 3, 4]) expect(screen.getByText(`#${id}`)).toBeInTheDocument();
    expect(calls).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await advance(0); expect(calls).toBe(2); expect(pendingSignal.aborted).toBe(false);
    changeVisibility(true); await advance(14_999);
    expect(pendingSignal.aborted).toBe(false); expect(toast).not.toHaveBeenCalled();
    await advance(1);
    expect(pendingSignal.aborted).toBe(true);
    expect(pendingSignal.reason).toMatchObject({ name: "TimeoutError", message: "Request deadline exceeded" });
    // jsdom's DOMException can cross a different Error realm; the product's
    // fallback wording then differs. Diagnose the real abort reason and visible
    // error/retained data, not realm-dependent presentation of its message.
    expect(toast).toHaveBeenCalledExactlyOnceWith({ title: "Erro ao carregar pedidos",
      description: expect.any(String), variant: "destructive" });
    for (const id of [1, 2, 3, 4]) expect(screen.getByText(`#${id}`)).toBeInTheDocument();
    expect(calls).toBe(2); // No background polling or hidden dirty read.

    changeVisibility(false); await advance(0);
    expect(calls).toBe(3); expect(screen.getByText("#5")).toBeInTheDocument();
    finishLate(); await advance(0);
    expect(screen.queryByText("#99")).not.toBeInTheDocument();
    expect(screen.getByText("#5")).toBeInTheDocument(); expect(calls).toBe(3);
    view.unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});
