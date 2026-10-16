import { z } from "zod";
import { catalogWriterEnabled } from "@/lib/catalog/flags";
import { VaptApiClientError, vaptApiRequest } from "@/lib/vapt-api-client";
import { compareVersion, type CommandOutcome, type CommandReceipt } from "./catalog/contracts";
export type CatalogMutationInput = { operationId: string; route: string; method: "POST" | "PATCH" | "DELETE"; body?: unknown; signal?: AbortSignal };
export type CatalogMutationExecutor = { run<T>(input: Omit<CatalogMutationInput, "operationId">, reload?: () => Promise<T>): Promise<T> };
const revision = z.string().refine(value => { try { compareVersion(value, "1"); return true; } catch { return false; } });
const receiptSchema = z.object({ operationId: z.string().uuid(), restaurantId: z.string().uuid(),
  phase: z.enum(["accepted", "committed", "projected", "ready", "blocked"]), version: revision.nullable(), committed: z.boolean(), retryable: z.boolean(),
}).strict().refine(value => {
  if (value.phase === "accepted") return !value.committed && value.version === null;
  if (value.phase === "ready") return value.committed;
  if (value.phase === "committed" || value.phase === "projected") return value.committed && value.version !== null;
  return value.committed ? value.version !== null : value.version === null;
});
function enabled(): void {
  if (!catalogWriterEnabled()) throw new VaptApiClientError("catalog_protocol_disabled", "Publicação por evento não está ativa.", 503);
}
function id(value: string): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw new VaptApiClientError("invalid_operation_id", "A operação não pôde ser identificada.", 400);
  return result.data.toLowerCase();
}
function protocolError(): VaptApiClientError { return new VaptApiClientError("catalog_protocol_invalid", "Não foi possível confirmar a publicação. Verifique o status antes de repetir a ação.", 502); }
function receipt(value: unknown, operationId: string): CommandReceipt {
  const parsed = receiptSchema.safeParse(value);
  if (!parsed.success || parsed.data.operationId !== operationId) throw protocolError();
  return parsed.data as CommandReceipt;
}
function validRoute(input: CatalogMutationInput): boolean {
  if (input.route === "/onboarding") return input.method === "POST";
  if (input.route === "/restaurants/me") return input.method === "PATCH";
  if (input.route === "/restaurants/me/menu-items" || input.route === "/restaurants/me/catalog/rebuild") return input.method === "POST";
  const match = /^\/restaurants\/me\/menu-items\/([^/]+)$/.exec(input.route);
  return !!match && z.string().uuid().safeParse(match[1]).success && ["PATCH", "DELETE"].includes(input.method);
}
export async function runCatalogMutation<T>(input: CatalogMutationInput): Promise<CommandOutcome<T>> {
  enabled(); const operationId = id(input.operationId);
  if (!validRoute(input)) throw new VaptApiClientError("invalid_catalog_route", "Operação de catálogo inválida.", 400);
  const response = await vaptApiRequest<unknown>({ method: input.method, route: input.route, ...(input.body === undefined ? {} : { body: input.body }),
    ...(input.signal ? { signal: input.signal, timeoutMs: 15_000 } : {}),
    requireAuth: true, headers: { "X-Vapt-Catalog-Protocol": "1", "Idempotency-Key": operationId } });
  if (!response || typeof response !== "object" || Array.isArray(response) || Object.keys(response).some(key => !["receipt", "result"].includes(key)) || !("receipt" in response)) throw protocolError();
  const parsed = receipt(response.receipt, operationId);
  return { receipt: parsed, ...("result" in response ? { result: response.result as T } : {}) };
}
export async function getCatalogOperation(operationId: string, signal?: AbortSignal): Promise<CommandReceipt> {
  enabled(); const key = id(operationId);
  return receipt(await vaptApiRequest<unknown>({ method: "GET", route: `/restaurants/me/catalog-operations/${key}`, requireAuth: true, ...(signal ? { signal } : {}) }), key);
}
export async function retryCatalogOperation(operationId: string, signal?: AbortSignal): Promise<CommandReceipt> {
  enabled(); const key = id(operationId);
  return receipt(await vaptApiRequest<unknown>({ method: "POST", route: `/restaurants/me/catalog-operations/${key}/retry`, requireAuth: true, body: {}, ...(signal ? { signal, timeoutMs: 15_000 } : {}) }), key);
}
