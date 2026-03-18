import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, Receipt, Bell } from "lucide-react";

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
  tick?: number; // forces re-render every minute
}

function formatElapsed(openedAt: string): { text: string; colorClass: string } {
  const ms = Date.now() - new Date(openedAt).getTime();
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const text = `${h}h ${String(m).padStart(2, "0")}m`;

  if (totalMins < 60) return { text, colorClass: "text-text-secondary" };
  if (totalMins < 120) return { text, colorClass: "text-status-warning" };
  return { text, colorClass: "text-status-error" };
}

const TableCard = ({ tableNumber, session, onClick }: TableCardProps) => {
  const isFree = !session;
  const isCheckRequested = session?.status === "check_requested";
  const isOpen = session?.status === "open";

  const elapsed = session ? formatElapsed(session.opened_at) : null;

  return (
    <Card
      className={`cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:shadow-[var(--shadow-elevated)] ${
        isCheckRequested
          ? "border-brand-gold border-[1.5px] animate-pulse-border"
          : isOpen
          ? "border-border/80 bg-muted"
          : "border-border"
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4 text-center space-y-2 relative">
        {/* Gold bell for check requested */}
        {isCheckRequested && (
          <div className="absolute top-2 right-2">
            <Bell className="h-4 w-4 text-brand-gold" />
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          {isCheckRequested ? (
            <Receipt className="h-4 w-4 text-brand-gold" />
          ) : (
            <Users className={`h-4 w-4 ${isOpen ? "text-foreground" : "text-text-tertiary"}`} />
          )}
          <span className={`font-bold text-xl font-display ${isFree ? "text-text-tertiary" : "text-foreground"}`}>
            {tableNumber}
          </span>
        </div>

        {isFree ? (
          <p className="text-xs text-text-tertiary">Livre</p>
        ) : (
          <div className="space-y-1">
            <p className={`text-xs font-medium ${isCheckRequested ? "text-brand-gold" : "text-foreground"}`}>
              {isCheckRequested ? "🧾 Pedindo a conta" : "Ocupada"}
            </p>
            {session.order_count && session.order_count > 0 && (
              <p className="text-xs text-text-secondary">
                {session.order_count} pedido{session.order_count > 1 ? "s" : ""} ·{" "}
                <span className="font-mono text-primary">
                  R$ {(session.session_total || 0).toFixed(2).replace(".", ",")}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Elapsed time */}
        {elapsed && (
          <div className={`flex items-center justify-center gap-1 text-[11px] font-mono ${elapsed.colorClass}`}>
            <Clock className="h-3 w-3" />
            <span>{elapsed.text}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TableCard;
