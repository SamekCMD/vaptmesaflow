import type { CommandReceipt } from "@/lib/catalog/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
type Props = { receipt: CommandReceipt | null; authenticated: boolean; busy: boolean; onCheck(): void; onRetry(): void };
export function CatalogPublicationStatus({ receipt, authenticated, busy, onCheck, onRetry }: Props) {
  const ready = receipt?.phase === "ready";
  const title = !receipt ? "Confirmação pendente" : ready ? receipt.version === null ? "Alteração salva" : "Publicada"
    : receipt.phase === "blocked" ? "Publicação bloqueada" : receipt.committed ? "Gravada; publicação pendente" : "Alteração aceita";
  return <Alert role="status" aria-live="polite" variant={receipt?.phase === "blocked" ? "destructive" : "default"}>
    <AlertTitle>{title}</AlertTitle>
    {!ready && <AlertDescription>
      <p>{!authenticated ? "Entre novamente para verificar ou retomar esta operação."
        : !receipt ? "A resposta não foi confirmada. Verifique o status antes de repetir a ação."
        : receipt.committed ? "A alteração já foi gravada. A atualização do cardápio ainda não terminou."
        : "Aguarde a confirmação antes de fazer outra alteração."}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={!authenticated || busy} onClick={onCheck}>Verificar publicação</Button>
        {receipt?.retryable && <Button type="button" variant="outline" className="min-h-11" disabled={!authenticated || busy} onClick={onRetry}>Tentar publicação novamente</Button>}
      </div>
    </AlertDescription>}
  </Alert>;
}

type FeedbackProps = { authenticated: boolean; publication: { operationId: string | null; receipt: CommandReceipt | null; busy: boolean; error: string | null; check(): Promise<void>; retry(): Promise<void> } };
export function CatalogPublicationFeedback({ authenticated, publication }: FeedbackProps) {
  if (!publication.operationId) return null;
  return <div className="space-y-2">
    <CatalogPublicationStatus receipt={publication.receipt} authenticated={authenticated} busy={publication.busy}
      onCheck={() => { void publication.check(); }} onRetry={() => { void publication.retry(); }} />
    {publication.error && <p role="alert" className="text-sm text-destructive">{publication.error}</p>}
  </div>;
}
