import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, Receipt } from "lucide-react";

export interface TableSession {
  id: string;
  restaurant_id: string;
  table_number: string;
  status: "open" | "check_requested" | "closed";
  opened_at: string;
  closed_at: string | null;
  session_total: number | null;
  order_count: number | null;
}

interface TableCardProps {
  tableNumber: string;
  session: TableSession | null;
  onClick: () => void;
  tick?: number;
}

function formatElapsed(openedAt: string): { text: string; colorClass: string } {
  const ms = Date.now() - new Date(openedAt).getTime();
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const text = `${h}h ${String(m).padStart(2, "0")}m`;

  if (totalMins < 60) return { text, colorClass: "text-muted-foreground" };
  if (totalMins < 120) return { text, colorClass: "text-[hsl(44_51%_54%)]" };
  return { text, colorClass: "text-destructive" };
}

const TableCard = ({ tableNumber, session, onClick }: TableCardProps) => {
  const isFree = !session;
  const isCheckRequested = session?.status === "check_requested";
  const isOpen = session?.status === "open";

  const elapsed = session ? formatElapsed(session.opened_at) : null;

  return (
    <Card
      className={`cursor-pointer transition-all duration-150 hover:border-[hsl(240_5%_19%)] active:scale-[0.97] border ${
        isCheckRequested
          ? "border-[hsl(44_51%_54%)] animate-pulse"
          : isOpen
          ? "border-[hsl(153_14%_34%)]"
          : "border-border"
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          {isCheckRequested ? (
            <Receipt className="h-4 w-4 text-[hsl(44_51%_54%)]" strokeWidth={1.5} />
          ) : (
            <Users className={`h-4 w-4 ${isOpen ? "text-primary" : "text-muted-foreground"}`} strokeWidth={1.5} />
          )}
          <span className="font-medium text-base">Mesa {tableNumber}</span>
        </div>

        {isFree ? (
          <p className="text-xs text-muted-foreground">Livre</p>
        ) : (
          <div className="space-y-1">
            <p className={`text-xs font-medium ${isCheckRequested ? "text-[hsl(44_51%_54%)]" : "text-primary"}`}>
              {isCheckRequested ? "Pedindo a conta" : "Ocupada"}
            </p>
            {session.order_count && session.order_count > 0 && (
              <p className="text-xs text-muted-foreground font-mono">
                {session.order_count} pedido{session.order_count > 1 ? "s" : ""} · R$ {(session.session_total || 0).toFixed(2).replace(".", ",")}
              </p>
            )}
          </div>
        )}

        {elapsed && (
          <div className={`flex items-center justify-center gap-1 text-[11px] font-mono ${elapsed.colorClass}`}>
            <Clock className="h-3 w-3" strokeWidth={1.5} />
            <span>{elapsed.text}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TableCard;
