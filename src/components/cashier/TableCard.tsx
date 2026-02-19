import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

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
}

const TableCard = ({ tableNumber, session, onClick }: TableCardProps) => {
  const isFree = !session;
  const isCheckRequested = session?.status === "check_requested";
  const isOpen = session?.status === "open";

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md active:scale-[0.97] border-2 ${
        isCheckRequested
          ? "border-yellow-500 animate-pulse bg-yellow-500/10"
          : isOpen
          ? "border-emerald-500 bg-emerald-500/10"
          : "border-border bg-card"
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Users className={`h-4 w-4 ${
            isCheckRequested ? "text-yellow-500" : isOpen ? "text-emerald-500" : "text-muted-foreground"
          }`} />
          <span className="font-bold text-lg">Mesa {tableNumber}</span>
        </div>

        {isFree ? (
          <p className="text-xs text-muted-foreground">Livre</p>
        ) : (
          <div className="space-y-1">
            <p className={`text-xs font-medium ${isCheckRequested ? "text-yellow-500" : "text-emerald-500"}`}>
              {isCheckRequested ? "Pediu a Conta" : "Ocupada"}
            </p>
            {session.order_count && session.order_count > 0 && (
              <p className="text-xs text-muted-foreground">
                {session.order_count} pedido{session.order_count > 1 ? "s" : ""} · R$ {(session.session_total || 0).toFixed(2).replace(".", ",")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TableCard;
