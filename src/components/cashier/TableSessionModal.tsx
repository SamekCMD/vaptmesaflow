import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowRightLeft, Calculator, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { TableSession } from "./TableCard";
import type { TableSessionOrderDto } from "@/lib/business-api.types";
import {
  closeTableSession,
  getTableSession,
  transferTableSession,
} from "@/lib/table-sessions";
import ManualPaymentDialog, {
  type ManualPaymentOrder,
} from "@/components/payments/ManualPaymentDialog";

interface TableSessionModalProps {
  open: boolean;
  onClose: () => void;
  session: TableSession | null;
  onSessionClosed: () => void;
}

const statusLabel: Record<string, string> = {
  pending: "Na Fila",
  waiting_payment: "Aguardando Pagamento",
  paid: "Pago",
  preparing: "Preparando",
  ready: "Pronto",
  delivered: "Entregue",
};

const paidStatuses = new Set([
  "paid",
  "confirmed",
  "received",
  "received_in_cash",
  "payment_confirmed",
  "payment_received",
]);

const isOrderPaid = (order: TableSessionOrderDto) => order.paymentConfirmedAt !== null ||
  paidStatuses.has(order.paymentStatus?.trim().toLowerCase() ?? "");

const toCents = (value: string): bigint => {
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2) || "0");
};

const formatCents = (value: bigint): string => {
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");
  return `${whole},${fraction}`;
};

const TableSessionModal = ({ open, onClose, session, onSessionClosed }: TableSessionModalProps) => {
  const [orders, setOrders] = useState<TableSessionOrderDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [splitBy, setSplitBy] = useState(1);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (!open || !session) return;
    setLoading(true);
    setSplitBy(1);
    setNewTableNumber("");
    setPaymentDialogOpen(false);
  }, [open, session?.id]);

  useEffect(() => {
    if (!open || !session) return;
    const controller = new AbortController();
    let active = true;
    const fetchOrders = async () => {
      try {
        const detail = await getTableSession(session.id, controller.signal);
        if (active) setOrders(detail.orders);
      } catch {
        if (active) {
          setOrders([]);
          toast({ title: "Erro", description: "Não foi possível carregar a conta.", variant: "destructive" });
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchOrders();
    return () => { active = false; controller.abort(); };
  }, [open, session]);

  if (!session) return null;

  const totalCents = orders.reduce((sum, order) => sum + toCents(order.totalPrice), 0n);
  const divisor = BigInt(Math.max(1, splitBy));
  const perPersonCents = (totalCents + divisor / 2n) / divisor;

  const closeSessionAfterPayment = async () => {
    setClosing(true);
    try {
      await closeTableSession(session.id);

      toast({ title: "Conta finalizada ✅", description: `Mesa ${session.tableNumber} está livre.` });
      await onSessionClosed();
      onClose();
    } catch {
      toast({ title: "Erro", description: "Não foi possível fechar a conta.", variant: "destructive" });
    } finally {
      setClosing(false);
    }
  };

  const handleClose = () => {
    if (orders.every(isOrderPaid)) {
      void closeSessionAfterPayment();
      return;
    }
    setPaymentDialogOpen(true);
  };

  const manualPaymentOrders: ManualPaymentOrder[] = orders.map((order) => ({
    id: order.id, displayId: order.displayId, totalPrice: order.totalPrice, paymentStatus: order.paymentStatus, paymentConfirmedAt: order.paymentConfirmedAt,
  }));

  const handleTransfer = async () => {
    if (!newTableNumber.trim()) return;
    setTransferring(true);
    try {
      await transferTableSession(session.id, newTableNumber.trim());

      toast({ title: "Mesa transferida!", description: `Sessão movida para Mesa ${newTableNumber.trim()}.` });
      await onSessionClosed();
      onClose();
    } catch {
      toast({ title: "Erro", description: "Não foi possível transferir.", variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Mesa {session.tableNumber}
            <Badge variant={session.status === "check_requested" ? "destructive" : "secondary"} className="text-xs">
              {session.status === "check_requested" ? "Pediu a Conta" : "Aberta"}
            </Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Pedidos, total, pagamento e transferência da sessão da mesa.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Orders list */}
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido nesta sessão.</p>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Pedido #{order.displayId}</span>
                    <Badge variant="outline" className="text-xs">{statusLabel[order.status] || order.status}</Badge>
                  </div>
                  <ul className="space-y-1">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between text-sm text-muted-foreground">
                        <span>{item.quantity}x {item.productName}</span>
                        <span>R$ {formatCents(toCents(item.unitPrice) * BigInt(item.quantity))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}

            <Separator />

            {/* Total */}
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total da Mesa</span>
              <span className="text-primary">R$ {formatCents(totalCents)}</span>
            </div>

            {/* Bill split */}
            <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
              <Calculator className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm">Dividir por</span>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={splitBy}
                  onChange={(e) => setSplitBy(Math.max(1, Number(e.target.value)))}
                  className="w-16 h-8 text-center"
                />
                <span className="text-sm">pessoa{splitBy > 1 ? "s" : ""}</span>
              </div>
              <span className="text-sm font-bold whitespace-nowrap">
                R$ {formatCents(perPersonCents)} / pessoa
              </span>
            </div>

            {/* Transfer table */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">Trocar para mesa</span>
              <Input
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
                placeholder="Nº"
                maxLength={20}
                className="w-20 h-8 text-center"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={!newTableNumber.trim() || transferring}
                onClick={handleTransfer}
              >
                {transferring ? <Loader2 className="h-3 w-3 animate-spin" /> : "Transferir"}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button
            variant="destructive"
            disabled={closing}
            onClick={handleClose}
          >
            {closing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Finalizar Conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ManualPaymentDialog
      open={paymentDialogOpen}
      onOpenChange={setPaymentDialogOpen}
      orders={manualPaymentOrders}
      onConfirmed={async () => {
        const confirmedAt = new Date().toISOString();
        setOrders((current) => current.map((order) => isOrderPaid(order) ? order : {
          ...order,
          paymentStatus: "paid",
          paymentConfirmedAt: confirmedAt,
        }));
        setPaymentDialogOpen(false);
        await closeSessionAfterPayment();
      }}
    />
  </>
  );
};

export default TableSessionModal;
