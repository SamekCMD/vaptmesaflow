import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "rated_orders";

export const FEEDBACK_REASONS = [
  "Demorou",
  "Veio certo",
  "Veio incompleto",
  "Muito bom",
  "Precisei de ajuda",
] as const;

export type OrderFeedbackPayload = {
  order_id: string;
  restaurant_id: string;
  rating: number;
  reasons: string[];
  comment: string | null;
  created_at: string;
};

export type StoredOrderFeedbackRecord = OrderFeedbackPayload;

type OrderFeedbackRow = {
  order_id: string;
  restaurant_id: string;
  rating: number | string;
  reasons: unknown;
  comment: string | null;
  created_at: string;
};

type OrderFeedbackInput = {
  orderId: string;
  restaurantId: string;
  rating: number;
  reasons?: string[];
  comment?: string | null;
  createdAt?: string;
};

type SubmitOrderFeedbackInput = OrderFeedbackInput & {
  publicAccessToken: string;
  feedbackWebhookUrl?: string;
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

export const buildOrderFeedbackPayload = ({
  orderId,
  restaurantId,
  rating,
  reasons = [],
  comment = null,
  createdAt = new Date().toISOString(),
}: OrderFeedbackInput): OrderFeedbackPayload => ({
  order_id: orderId,
  restaurant_id: restaurantId,
  rating,
  reasons,
  comment,
  created_at: createdAt,
});

export const fetchOrderFeedbackRecords = async ({
  restaurantId,
  periodStart,
}: {
  restaurantId: string;
  periodStart: Date;
}): Promise<StoredOrderFeedbackRecord[]> => {
  const { data, error } = await supabase
    .from("order_feedback")
    .select("order_id, restaurant_id, rating, reasons, comment, created_at")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", periodStart.toISOString());

  if (error) {
    throw error;
  }

  return ((data || []) as OrderFeedbackRow[]).map((record) => ({
    order_id: record.order_id,
    restaurant_id: record.restaurant_id,
    rating: Number(record.rating),
    reasons: Array.isArray(record.reasons) ? record.reasons : [],
    comment: typeof record.comment === "string" ? record.comment : null,
    created_at: record.created_at,
  }));
};

export const submitOrderFeedback = async ({
  feedbackWebhookUrl: _feedbackWebhookUrl,
  ...input
}: SubmitOrderFeedbackInput): Promise<OrderFeedbackPayload> => {
  const payload = buildOrderFeedbackPayload(input);

  const { error } = await supabase.rpc("submit_order_feedback", {
    p_order_id: payload.order_id,
    p_restaurant_id: payload.restaurant_id,
    p_rating: payload.rating,
    p_reasons: payload.reasons,
    p_comment: payload.comment,
    p_public_access_token: input.publicAccessToken,
  });

  if (error) {
    throw new Error("feedback_persist_failed");
  }

  return payload;
};
