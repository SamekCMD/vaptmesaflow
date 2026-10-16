import type { CatalogMutationInput } from "@/lib/catalog-mutations";
import { getCatalogOperation, retryCatalogOperation, runCatalogMutation } from "@/lib/catalog-mutations";
import type { CommandReceipt } from "@/lib/catalog/contracts";
import { useEffect, useRef, useState } from "react";
import { catalogWriterEnabled } from "@/lib/catalog/flags";
import { VaptApiClientError } from "@/lib/vapt-api-client";

class PublicationDeferred extends Error { constructor() { super("Verifique a publicação antes de continuar."); } }
export function isCatalogPublicationDeferred(error: unknown): boolean { return error instanceof PublicationDeferred; }
type State = { ownerId?: string; operationId: string | null; receipt: CommandReceipt | null; busy: boolean; uncertain: boolean; error: string | null };
const empty = (ownerId?: string): State => ({ ownerId, operationId: null, receipt: null, busy: false, uncertain: false, error: null });
export function useCatalogPublication(ownerId?: string, onPublished?: (isCurrent: () => boolean) => void | Promise<void>) {
  const [state, setState] = useState(() => empty(ownerId));
  const latest = useRef(state); const owner = useRef(ownerId); owner.current = ownerId;
  const mounted = useRef(true); const generation = useRef(0); const pending = useRef<AbortController>();
  const onPublishedRef = useRef(onPublished); onPublishedRef.current = onPublished;
  const update = (value: State) => { latest.current = value; setState(value); };
  useEffect(() => {
    mounted.current = true; const epoch = ++generation.current;
    const value = empty(ownerId); latest.current = value; setState(value);
    return () => { mounted.current = false; generation.current = epoch + 1; pending.current?.abort(); pending.current = undefined; };
  }, [ownerId]);
  const active = () => mounted.current && !!ownerId && owner.current === ownerId;
  const blocked = (value: State) => value.busy || (!!value.operationId && value.receipt?.phase !== "ready"
    && !(value.receipt?.phase === "blocked" && !value.receipt.committed && !value.receipt.retryable));
  async function run<T>(input: Omit<CatalogMutationInput, "operationId">, reload?: () => Promise<T>): Promise<T> {
    if (!active() || !catalogWriterEnabled() || blocked(latest.current)) throw new PublicationDeferred();
    const epoch = generation.current; const current = () => active() && generation.current === epoch;
    const controller = new AbortController(); pending.current = controller;
    const operationId = crypto.randomUUID(); update({ ...empty(ownerId), operationId, busy: true });
    try {
      const outcome = await runCatalogMutation<T>({ ...input, operationId, signal: controller.signal });
      if (!current()) throw new PublicationDeferred();
      update({ ...latest.current, receipt: outcome.receipt, busy: outcome.receipt.phase === "ready", uncertain: false });
      if (outcome.receipt.phase !== "ready") throw new PublicationDeferred();
      if (outcome.result !== undefined) return outcome.result;
      if (!reload) {
        await onPublishedRef.current?.(current);
        throw new VaptApiClientError("catalog_result_unavailable", "Alteração publicada. Recarregue os dados antes de continuar.", 503);
      }
      const value = await reload(); if (!current()) throw new PublicationDeferred(); return value;
    } catch (error) {
      if (!current() || error instanceof PublicationDeferred) throw new PublicationDeferred();
      if (latest.current.receipt?.phase === "ready") throw error; // Never label a confirmed publication as rolled back.
      if (error instanceof VaptApiClientError && error.status >= 400 && error.status < 500 && error.status !== 408) {
        update({ ...empty(ownerId), error: error.message }); throw error;
      }
      const message = "Não foi possível confirmar a publicação. Verifique o status antes de repetir a ação.";
      update({ ...latest.current, busy: false, uncertain: true, error: message });
      throw new VaptApiClientError("catalog_confirmation_pending", message, 503);
    } finally {
      if (current() && latest.current.busy) update({ ...latest.current, busy: false });
      if (pending.current === controller) pending.current = undefined;
    }
  }
  async function control(action: "check" | "retry"): Promise<void> {
    const value = latest.current;
    if (!active() || !catalogWriterEnabled() || value.busy || !value.operationId || (action === "retry" && !value.receipt?.retryable)) return;
    const epoch = generation.current; const current = () => active() && generation.current === epoch;
    const controller = new AbortController(); pending.current = controller; update({ ...value, busy: true, error: null });
    try {
      const receipt = await (action === "check" ? getCatalogOperation : retryCatalogOperation)(value.operationId, controller.signal);
      if (!current()) return;
      update({ ...latest.current, receipt, uncertain: false, busy: true, error: null });
      if (receipt.phase === "ready") await onPublishedRef.current?.(current);
    } catch {
      if (current()) update({ ...latest.current, error: latest.current.receipt?.phase === "ready"
        ? "Publicada, mas não foi possível recarregar os dados." : "Não foi possível verificar a publicação. Tente a verificação novamente." });
    } finally {
      if (current()) update({ ...latest.current, busy: false });
      if (pending.current === controller) pending.current = undefined;
    }
  }
  const view = state.ownerId === ownerId ? state : empty(ownerId);
  return { receipt: view.receipt, busy: view.busy, uncertain: view.uncertain, error: view.error,
    blocked: catalogWriterEnabled() && blocked(view), operationId: view.operationId,
    run, check: () => control("check"), retry: () => control("retry") };
}
