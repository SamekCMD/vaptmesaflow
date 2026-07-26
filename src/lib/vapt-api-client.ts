import { ENV } from "@/lib/env";
import { supabase } from "@/lib/supabase";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type VaptApiRequestOptions = {
  method?: HttpMethod;
  route: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  requireAuth?: boolean;
};

export class VaptApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "VaptApiClientError";
  }
}

function buildUrl(
  route: string,
  query?: VaptApiRequestOptions["query"],
): string {
  const base = ENV.vaptApiBaseUrl.replace(/\/$/, "");
  const path = route.replace(/^\//, "");
  const search = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) search.set(key, String(value));
  });
  const queryString = search.toString();
  return `${base}/${path}${queryString ? `?${queryString}` : ""}`;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function vaptApiRequest<T>({
  method = "POST",
  route,
  headers = {},
  query,
  body,
  requireAuth = true,
}: VaptApiRequestOptions): Promise<T> {
  const token = requireAuth ? await getAccessToken() : null;
  if (requireAuth && !token) {
    throw new VaptApiClientError("unauthorized", "Sessão inválida. Faça login novamente.", 401);
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
  const payload = (await parseJsonSafe(response)) as {
    error?: string | { code?: string; message?: string };
    message?: string;
  } | null;
  const code = typeof payload?.error === "string"
    ? payload.error
    : payload?.error?.code;
  const message = typeof payload?.error === "object"
    ? payload.error.message
    : payload?.message;

  if (!response.ok || code) {
    throw new VaptApiClientError(
      code ?? "api_unreachable",
      message ?? "Não foi possível concluir a operação.",
      response.status,
    );
  }
  return payload as T;
}
