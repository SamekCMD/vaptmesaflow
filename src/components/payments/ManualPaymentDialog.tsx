import { useRef, useState } from "react";
import { Banknote, CreditCard, Loader2, QrCode, ReceiptText, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { paymentClient, type ManualPaymentMethod } from "@/lib/payment-client";

export type ManualPaymentOrder = {
  id: string;
  displayId: number | null;
  totalPrice: number;
  paymentStatus: string | null;
  paymentConfirmedAt: string | null;
};

type ManualPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: ManualPaymentOrder[];
  onConfirmed: () => void | Promise<void>;
};

const methods: Array<{
  value: ManualPaymentMethod;
  label: string;
  description: string;
  icon: typeof Banknote;
}> = [
  { value: "cash", label: "Dinheiro", description: "Recebido no caixa", icon: Banknote },
  { value: "external_pix", label: "Pix externo", description: "Comprovante conferido", icon: QrCode },
  { value: "credit_card", label: "Crédito", description: "Máquina do restaurante", icon: CreditCard },
  { value: "debit_card", label: "Débito", description: "Máquina do restaurante", icon: CreditCard },
  { value: "voucher", label: "Vale", description: "Vale-refeição ou alimentação", icon: Ticket },
  { value: "other", label: "Outro", description: "Outro recebimento conferido", icon: ReceiptText },
];

const paidStatuses = new Set([
  "paid",
  "confirmed",
  "received",
  "received_in_cash",
  "payment_confirmed",
  "payment_received",
]);

function isPaid(order: ManualPaymentOrder): boolean {
  return order.paymentConfirmedAt !== null ||
    paidStatuses.has(order.paymentStatus?.trim().toLowerCase() ?? "");
}

function errorMessage(error: unknown): string {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number(error.status)
    : 0;

  if (status === 401) {
    return "Sua sessão expirou. Entre novamente para confirmar o pagamento.";
  }
  if (status === 403) {
    return "Você não tem permissão para confirmar este pagamento.";
  }
  if (status === 409) {
    return "Este pagamento já foi confirmado ou está sendo processado. Atualize o caixa.";
  }
  return "Não foi possível confirmar agora. Verifique a conexão e tente novamente.";
}

function createIdempotencyKey(orderId: string): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `manual-${orderId}-${randomPart}`;
}

const ManualPaymentDialog = ({
  open,
  onOpenChange,
  orders,
  onConfirmed,
}: ManualPaymentDialogProps) => {
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>("cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const idempotencyKeysRef = useRef(new Map<string, string>());
  const confirmedOrderIdsRef = useRef(new Set<string>());

  const unpaidOrders = orders.filter((order) => !isPaid(order));
  const total = unpaidOrders.reduce((sum, order) => sum + Number(order.totalPrice), 0);

  const getIdempotencyKey = (orderId: string) => {
    const current = idempotencyKeysRef.current.get(orderId);
    if (current) return current;
    const created = createIdempotencyKey(orderId);
    idempotencyKeysRef.current.set(orderId, created);
    return created;
  };

  const handleConfirm = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      for (const order of unpaidOrders) {
        if (confirmedOrderIdsRef.current.has(order.id)) continue;
        await paymentClient.confirmManual(
          order.id,
          paymentMethod,
          getIdempotencyKey(order.id),
        );
        confirmedOrderIdsRef.current.add(order.id);
      }
      await onConfirmed();
    } catch (confirmationError) {
      setError(errorMessage(confirmationError));
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar recebimento</DialogTitle>
          <DialogDescription>
            Selecione como a conta foi paga. O valor é conferido pelo servidor antes da confirmação.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              {unpaidOrders.length} {unpaidOrders.length === 1 ? "pedido" : "pedidos"}
            </span>
            <span className="text-base font-semibold tabular-nums">
              R$ {total.toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>

        <RadioGroup
          aria-label="Forma de pagamento"
          value={paymentMethod}
          onValueChange={(value) => setPaymentMethod(value as ManualPaymentMethod)}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <Label
                key={method.value}
                htmlFor={`manual-payment-${method.value}`}
                className="flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem
                  id={`manual-payment-${method.value}`}
                  value={method.value}
                  disabled={submitting}
                />
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{method.label}</span>
                  <span className="block text-xs text-muted-foreground">{method.description}</span>
                </span>
              </Label>
            );
          })}
        </RadioGroup>

        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Voltar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || unpaidOrders.length === 0}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {submitting ? "Confirmando..." : "Confirmar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManualPaymentDialog;
