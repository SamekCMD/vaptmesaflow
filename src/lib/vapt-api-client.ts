import { ENV } from "@/lib/env";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type VaptApiRequestOptions = {
  method?: HttpMethod;
  route: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  requireAuth?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
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

// Abort the actual HTTP operation and reject even if a transport/body ignores
// cancellation. Late completions never reach the caller's state update.
function abortable<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason ?? new DOMException("Request aborted", "AbortError");
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    try {
      operation().then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    } catch (error) {
      signal.removeEventListener("abort", abort);
      reject(error);
    }
  });
}

export async function vaptApiRequest<T>({
  method = "POST",
  route,
  headers = {},
  query,
  body,
  requireAuth = true,
  signal,
  timeoutMs = method === "GET" ? 15_000 : undefined,
}: VaptApiRequestOptions): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true });
  const timer = timeoutMs === undefined ? undefined : setTimeout(() => controller.abort(new DOMException("Request deadline exceeded", "TimeoutError")), timeoutMs);
  try {
    const response = await abortable(() => fetch(buildUrl(route, query), {
      method,
      credentials: requireAuth ? "include" : "omit",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    }), controller.signal);
    const payload = (await abortable(() => parseJsonSafe(response), controller.signal)) as {
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
  } finally {
    clearTimeout(timer); signal?.removeEventListener("abort", abort);
  }
}
