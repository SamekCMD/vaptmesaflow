import {
  vaptApiRequest,
  VaptApiClientError,
  type VaptApiRequestOptions,
} from "@/lib/vapt-api-client";

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

type PushSubscriptionInput = {
  subscription: unknown;
  endpoint: string;
  origin: string;
  user_agent: string;
};

const request = async <T>(options: VaptApiRequestOptions): Promise<T> => {
  try {
    return await vaptApiRequest<T>(options);
  } catch (error) {
    if (error instanceof VaptApiClientError) {
      throw new N8nClientError(error.code, error.message, error.status);
    }
    throw error;
  }
};

export type StripeStatusResponse = {
  planType: string | null;
  planStatus: string | null;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billingLastError?: string | null;
  subscriptionCanceledAt?: string | null;
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
    pushSubscription: (payload: PushSubscriptionInput) =>
      request<{
        restaurantId: string;
        endpoint: string;
        status: "subscribed";
      }>({
        route: "ingest/push-subscription",
        body: payload,
      }),
  },
};
