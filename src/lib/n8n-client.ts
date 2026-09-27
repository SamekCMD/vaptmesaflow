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

type PushSubscriptionInput = {
  subscription: unknown;
  endpoint: string;
  origin: string;
  user_agent: string;
};

const request = async <T>(options: VaptApiRequestOptions): Promise<T> => {
  try {
    return await vaptApiRequest<T>({ ...options, requireAuth: true });
  } catch (error) {
    if (error instanceof VaptApiClientError) {
      throw new N8nClientError(error.code, error.message, error.status);
    }
    throw error;
  }
};

export const n8nClient = {
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
