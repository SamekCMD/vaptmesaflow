import { ENV } from "@/lib/env";

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

type AsaasSetupInput = {
  restaurantId: string;
  asaasApiKey: string;
  asaasEnvironment?: "production" | "sandbox";
};

type PixCreateInput = {
  restaurantId: string;
  orderId: string;
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

const normalizeBaseUrl = (): string => {
  const base = ENV.n8nWebhookBaseUrl;
  return base.replace(/\/$/, "");
};

const buildUrl = (
  route: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): string => {
  const url = new URL(`${normalizeBaseUrl()}/${route.replace(/^\//, "")}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const parseJsonSafe = async (response: Response): Promise<any> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const request = async <T>({
  method = "POST",
  route,
  headers = {},
  query,
  body,
}: RequestOptions): Promise<T> => {
  const response = await fetch(buildUrl(route, query), {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await parseJsonSafe(response);

  if (!response.ok || payload?.error) {
    const code = payload?.error || "provider_unreachable";
    const message = payload?.message || "Unexpected n8n error";
    throw new N8nClientError(code, message, response.status);
  }

  return payload as T;
};

export type StripeStatusResponse = {
  plan_type: string | null;
  plan_status: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
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
        route: "stripe/subscription/create",
        headers: {
          "x-vapt-app-key": ENV.vaptAppEndpointSecret,
        },
        body: {
          restaurant_id: input.restaurantId,
          email: input.email,
          plan_type: input.planType,
          price_id: input.priceId,
        },
      }),

    changeSubscription: (input: StripeChangeInput) =>
      request<{
        subscriptionId: string | null;
        plan_type: string;
        status: string;
        autoCharged: boolean;
      }>({
        route: "stripe/subscription/change",
        headers: {
          "x-vapt-app-key": ENV.vaptAppEndpointSecret,
        },
        body: {
          restaurant_id: input.restaurantId,
          target_plan_type: input.targetPlanType,
          target_price_id: input.targetPriceId,
        },
      }),

    cancelSubscription: (input: StripeCancelInput) =>
      request<{
        subscriptionId: string | null;
        status: string;
      }>({
        route: "stripe/subscription/cancel",
        headers: {
          "x-vapt-app-key": ENV.vaptAppEndpointSecret,
        },
        body: {
          restaurant_id: input.restaurantId,
        },
      }),

    getSubscriptionStatus: (restaurantId: string) =>
      request<StripeStatusResponse>({
        method: "GET",
        route: "stripe/subscription/status",
        headers: {
          "x-vapt-app-key": ENV.vaptAppEndpointSecret,
        },
        query: {
          restaurant_id: restaurantId,
        },
      }),
  },

  asaas: {
    setup: (input: AsaasSetupInput) =>
      request<{
        valid: boolean;
        webhook_registered: boolean;
        webhook_id: string | null;
        setup_status: string;
        message: string;
      }>({
        route: "asaas/setup",
        headers: {
          "x-vapt-webhook-key": ENV.vaptWebhookSetupSecret,
        },
        body: {
          restaurant_id: input.restaurantId,
          asaas_api_key: input.asaasApiKey,
          asaas_environment: input.asaasEnvironment ?? "production",
        },
      }),

    getSetupStatus: (restaurantId: string) =>
      request<{
        restaurant_id: string;
        name: string;
        setup_status: string | null;
        webhook_id: string | null;
        webhook_url: string | null;
        last_validated_at: string | null;
        last_error: string | null;
        has_api_key: boolean;
        asaas_environment: "production" | "sandbox" | null;
      }>({
        method: "GET",
        route: "asaas/setup/status",
        headers: {
          "x-vapt-admin-key": ENV.vaptAdminEndpointSecret,
        },
        query: {
          restaurant_id: restaurantId,
        },
      }),

    createPix: (input: PixCreateInput) =>
      request<{
        payment_id: string;
        qr_code_base64: string | null;
        pix_payload: string | null;
        expiration: string | null;
        status: string;
      }>({
        route: "asaas/pix/create",
        headers: {
          "x-vapt-app-key": ENV.vaptAppEndpointSecret,
        },
        body: {
          restaurant_id: input.restaurantId,
          order_id: input.orderId,
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
        headers: {
          "x-vapt-app-key": ENV.vaptAppEndpointSecret,
        },
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
        headers: {
          "x-vapt-app-key": ENV.vaptAppEndpointSecret,
        },
        body: {
          action: "subscribe",
          ...payload,
        },
      }),
  },
};
