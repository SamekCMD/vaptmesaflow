import type { OrderFeedbackDto } from "@/lib/business-api.types";
import { vaptApiRequest } from "@/lib/vapt-api-client";

const STORAGE_KEY = "rated_orders";

export const FEEDBACK_REASONS = [
  "Demorou",
  "Veio certo",
  "Veio incompleto",
  "Muito bom",
  "Precisei de ajuda",
] as const;

export type StoredOrderFeedbackRecord = OrderFeedbackDto;

type SubmitOrderFeedbackInput = {
  orderId: string;
  publicToken: string;
  rating: number;
  reasons?: string[];
  comment?: string | null;
};

export const getRatedOrderIds = (): string[] => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
};

export const markOrderAsRated = (orderId: string) => {
  const ids = new Set(getRatedOrderIds());
  ids.add(orderId);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
};

export const shouldPromptForOrderFeedback = ({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) => status === "completed" && !getRatedOrderIds().includes(orderId);

export const submitOrderFeedback = ({
  orderId,
  publicToken,
  rating,
  reasons = [],
  comment = null,
}: SubmitOrderFeedbackInput): Promise<OrderFeedbackDto> => {
  if (!publicToken) return Promise.reject(new Error("order_access_required"));
  return vaptApiRequest<OrderFeedbackDto>({
    method: "PUT",
    route: `/public/orders/${encodeURIComponent(orderId)}/feedback`,
    requireAuth: false,
    headers: { "X-Vapt-Order-Token": publicToken },
    body: { rating, reasons, comment },
  });
};
