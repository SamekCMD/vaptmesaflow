import { ENV } from "@/lib/env";
import { supabase } from "@/lib/supabase";

type N8nErrorCode =
  | "unauthorized"
  | "invalid_configuration"
  | "not_found"
  | "provider_unreachable"
  | "payment_creation_failed"
  | "subscription_change_failed";

export class N8nClientError extends Error {
  code: N8nErrorCode | string;
  status: number;

  constructor(code: N8nErrorCode | string, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type HttpMethod = "GET" | "POST";

type RequestOptions = {
  method?: HttpMethod;
  route: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  requireAuth?: boolean;
};

type StripeCreateInput = {
  restaurantId: string;
  email: string;
  planType: string;
  priceId: string;
};

type StripeChangeInput = {
  restaurantId: string;
  targetPlanType: string;
  targetPriceId: string;
};

type StripeCancelInput = {
  restaurantId: string;
};

type FeedbackInput = {
  order_id: string;
  restaurant_id: string;
  rating: number;
  reasons: string[];
  comment: string | null;
  created_at: string;
};

type PushSubscriptionInput = {
  restaurant_id: string;
  subscription: unknown;
  endpoint: string;
  origin: string;
  user_agent: string;
  created_at: string;
};

const normalizeBackendBaseUrl = (): string => ENV.vaptApiBaseUrl.replace(/\/$/, "");

const buildUrl = (
  route: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): string => {
  const url = new URL(`${normalizeBackendBaseUrl()}/${route.replace(/^\//, "")}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const parseJsonSafe = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const getAccessToken = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

const request = async <T>({
  method = "POST",
  route,
  headers = {},
  query,
  body,
  requireAuth = true,
}: RequestOptions): Promise<T> => {
  const token = requireAuth ? await getAccessToken() : null;

  if (requireAuth && !token) {
    throw new N8nClientError("unauthorized", "Sessão inválida. Faça login novamente.", 401);
  }

  const response = await fetch(buildUrl(route, query), {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const payload = (await parseJsonSafe(response)) as
    | {
        error?: string | { code?: string; message?: string };
        message?: string;
      }
    | null;

  const errorCode =
    typeof payload?.error === "string"
      ? payload.error
      : payload?.error && typeof payload.error === "object"
        ? payload.error.code
        : undefined;
  const errorMessage =
    typeof payload?.error === "object" && payload.error
      ? payload.error.message
      : payload?.message;

  if (!response.ok || errorCode) {
    const code = errorCode || "provider_unreachable";
    const message = errorMessage || "Unexpected backend error";
    throw new N8nClientError(code, message, response.status);
  }

  return payload as T;
};

export type StripeStatusResponse = {
  planType: string | null;
  planStatus: string | null;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billing_last_error?: string | null;
  subscription_canceled_at?: string | null;
};

export const n8nClient = {
  stripe: {
    createSubscription: (input: StripeCreateInput) =>
      request<{
        clientSecret: string | null;
        subscriptionId: string | null;
        customerId: string | null;
        autoCharged: boolean;
      }>({
        route: "billing/stripe/checkout",
        body: {
          restaurantId: input.restaurantId,
          email: input.email,
          planType: input.planType,
          priceId: input.priceId,
        },
      }),

    changeSubscription: (input: StripeChangeInput) =>
      request<{
        subscriptionId: string | null;
        planType: string;
        status: string;
        autoCharged: boolean;
      }>({
        route: "billing/stripe/subscription/change",
        body: {
          restaurantId: input.restaurantId,
          targetPlanType: input.targetPlanType,
          targetPriceId: input.targetPriceId,
        },
      }),

    cancelSubscription: (input: StripeCancelInput) =>
      request<{
        subscriptionId: string | null;
        status: string;
      }>({
        route: "billing/stripe/subscription/cancel",
        body: {
          restaurantId: input.restaurantId,
        },
      }),

    getSubscriptionStatus: (restaurantId: string) =>
      request<StripeStatusResponse>({
        method: "GET",
        route: "billing/stripe/subscription",
        query: {
          restaurantId,
        },
      }),
  },

  ingest: {
    orderFeedback: (payload: FeedbackInput) =>
      request<{
        success: boolean;
        route: string;
        order_id: string | null;
        restaurant_id: string | null;
        rating: number | null;
        status: string;
      }>({
        route: "ingest/order-feedback",
        requireAuth: false,
        body: payload,
      }),

    pushSubscription: (payload: PushSubscriptionInput) =>
      request<{
        success: boolean;
        route: string;
        restaurant_id: string | null;
        endpoint: string | null;
        status: string;
      }>({
        route: "ingest/push-subscription",
        body: {
          action: "subscribe",
          ...payload,
        },
      }),
  },
};
