import { vaptApiRequest } from "@/lib/vapt-api-client";

export type CreateOrderRequest = {
  restaurantSlug: string;
  channel: "local" | "delivery";
  tableNumber?: number;
  items: Array<{
    menuItemId: string;
    variationId?: string;
    quantity: number;
    notes?: string;
  }>;
  delivery?: {
    name: string;
    phone: string;
    street: string;
    number: string;
    neighborhood: string;
  };
};

export type CreateOrderResponse = {
  orderId: string;
  displayId: number | null;
  restaurantId: string;
  tableSessionId: string | null;
  totalPrice: string;
  status: string;
  paymentStatus: string | null;
  publicToken: string;
  idempotentReplay: boolean;
};

export type PublicOrder = Omit<CreateOrderResponse, "publicToken" | "idempotentReplay"> & {
  channel: "local" | "delivery";
  tableNumber: string | null;
  createdAt: string;
  items: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: string;
    notes: string | null;
  }>;
};

export type StoredOrderAccess = {
  orderId: string;
  publicToken: string;
};

const storageKey = (restaurantId: string) => `orders_${restaurantId}`;

export function createOrderIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function readStoredOrderAccess(restaurantId: string): StoredOrderAccess[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(restaurantId)) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is StoredOrderAccess =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as StoredOrderAccess).orderId === "string" &&
      typeof (entry as StoredOrderAccess).publicToken === "string"
    );
  } catch {
    return [];
  }
}

export function saveStoredOrderAccess(restaurantId: string, access: StoredOrderAccess): void {
  const current = readStoredOrderAccess(restaurantId);
  const next = [access, ...current.filter((entry) => entry.orderId !== access.orderId)].slice(0, 24);
  localStorage.setItem(storageKey(restaurantId), JSON.stringify(next));
}

export const orderClient = {
  create: (body: CreateOrderRequest, idempotencyKey: string) =>
    vaptApiRequest<CreateOrderResponse>({
      route: "public/orders",
      requireAuth: false,
      headers: { "Idempotency-Key": idempotencyKey },
      body,
    }),

  get: (orderId: string, publicToken: string) =>
    vaptApiRequest<PublicOrder>({
      method: "GET",
      route: `public/orders/${encodeURIComponent(orderId)}`,
      requireAuth: false,
      headers: { "X-Vapt-Order-Token": publicToken },
    }),
};
