import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowRightLeft, Calculator, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import type { TableSession } from "./TableCard";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  notes: string;
}

interface Order {
  id: string;
  display_id: number;
  total_price: number;
  status: string;
  created_at: string;
  order_items: OrderItem[];
}

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

const TableSessionModal = ({ open, onClose, session, onSessionClosed }: TableSessionModalProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [splitBy, setSplitBy] = useState(1);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (!open || !session) return;
    setLoading(true);
    setSplitBy(1);
    setNewTableNumber("");

    const fetchOrders = async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, display_id, total_price, status, created_at, order_items(*)")
        .eq("table_session_id", session.id)
        .order("created_at", { ascending: true });

      setOrders((data as unknown as Order[]) || []);
      setLoading(false);
    };
    fetchOrders();
  }, [open, session]);

  if (!session) return null;

  const total = orders.reduce((s, o) => s + Number(o.total_price), 0);
  const perPerson = splitBy > 0 ? total / splitBy : total;

  const handleClose = async () => {
    setClosing(true);
    try {
      const { error } = await supabase
        .from("table_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", session.id);

      if (error) throw error;

      toast({ title: "Conta finalizada ✅", description: `Mesa ${session.table_number} está livre.` });
      onSessionClosed();
      onClose();
    } catch {
      toast({ title: "Erro", description: "Não foi possível fechar a conta.", variant: "destructive" });
    } finally {
      setClosing(false);
    }
  };

  const handleTransfer = async () => {
    if (!newTableNumber.trim()) return;
    setTransferring(true);
    try {
      const { error } = await supabase
        .from("table_sessions")
        .update({ table_number: newTableNumber.trim() })
        .eq("id", session.id);

      if (error) throw error;

      // Update table_number on linked orders too
      await supabase
        .from("orders")
        .update({ table_number: newTableNumber.trim() })
        .eq("table_session_id", session.id);

      toast({ title: "Mesa transferida!", description: `Sessão movida para Mesa ${newTableNumber.trim()}.` });
      onSessionClosed(); // refresh parent
      onClose();
    } catch {
      toast({ title: "Erro", description: "Não foi possível transferir.", variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Mesa {session.table_number}
            <Badge variant={session.status === "check_requested" ? "destructive" : "secondary"} className="text-xs">
              {session.status === "check_requested" ? "Pediu a Conta" : "Aberta"}
            </Badge>
          </DialogTitle>
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
                    <span className="text-sm font-semibold">Pedido #{order.display_id}</span>
                    <Badge variant="outline" className="text-xs">{statusLabel[order.status] || order.status}</Badge>
                  </div>
                  <ul className="space-y-1">
                    {order.order_items.map((item) => (
                      <li key={item.id} className="flex justify-between text-sm text-muted-foreground">
                        <span>{item.quantity}x {item.product_name}</span>
                        <span>R$ {(item.quantity * item.unit_price).toFixed(2).replace(".", ",")}</span>
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
              <span className="text-primary">R$ {total.toFixed(2).replace(".", ",")}</span>
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
                R$ {perPerson.toFixed(2).replace(".", ",")} / pessoa
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
  );
};

export default TableSessionModal;
