import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight } from "lucide-react";

interface Order {
  id: number;
  table: string;
  items: string[];
  status: "queue" | "preparing" | "ready";
  createdAt: Date;
}

const initialOrders: Order[] = [
  { id: 101, table: "Mesa 4", items: ["X-Burguer Especial", "Suco Natural"], status: "queue", createdAt: new Date(Date.now() - 8 * 60000) },
  { id: 102, table: "Mesa 7", items: ["Pizza Margherita"], status: "queue", createdAt: new Date(Date.now() - 5 * 60000) },
  { id: 103, table: "Mesa 2", items: ["Salada Caesar", "Brownie com Sorvete"], status: "preparing", createdAt: new Date(Date.now() - 15 * 60000) },
  { id: 104, table: "Mesa 1", items: ["X-Burguer Especial x2"], status: "preparing", createdAt: new Date(Date.now() - 12 * 60000) },
  { id: 105, table: "Mesa 9", items: ["Pizza Margherita", "Suco Natural x2"], status: "ready", createdAt: new Date(Date.now() - 22 * 60000) },
];

const columns = [
  { key: "queue" as const, label: "Na Fila", color: "bg-badge-pending" },
  { key: "preparing" as const, label: "Preparando", color: "bg-badge-preparing" },
  { key: "ready" as const, label: "Pronto", color: "bg-badge-ready" },
];

const KitchenMonitor = () => {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const getElapsed = (date: Date) => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    return `${mins} min`;
  };

  const advance = (order: Order) => {
    const next = order.status === "queue" ? "preparing" : "ready";
    setOrders(orders.map((o) => (o.id === order.id ? { ...o, status: next as Order["status"] } : o)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Monitor da Cozinha</h1>
        <p className="text-muted-foreground text-sm">Acompanhe os pedidos em tempo real</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {columns.map((col) => (
          <div key={col.key}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`h-3 w-3 rounded-full ${col.color}`} />
              <h2 className="font-semibold">{col.label}</h2>
              <Badge variant="secondary" className="ml-auto text-xs">
                {orders.filter((o) => o.status === col.key).length}
              </Badge>
            </div>

            <div className="space-y-3">
              {orders
                .filter((o) => o.status === col.key)
                .map((order) => (
                  <Card key={order.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-sm">#{order.id}</span>
                        <Badge variant="outline" className="text-xs">
                          {order.table}
                        </Badge>
                      </div>
                      <ul className="space-y-1 mb-3">
                        {order.items.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground">• {item}</li>
                        ))}
                      </ul>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {getElapsed(order.createdAt)}
                        </div>
                        {col.key !== "ready" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={() => advance(order)}>
                            Avançar <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KitchenMonitor;
