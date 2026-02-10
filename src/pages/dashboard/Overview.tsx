import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingBag, TrendingUp, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const metrics = [
  { title: "Vendas Hoje", value: "R$ 4.230", change: "+12%", icon: DollarSign },
  { title: "Pedidos Pendentes", value: "8", change: "3 urgentes", icon: ShoppingBag },
  { title: "Ticket Médio", value: "R$ 62,50", change: "+5%", icon: TrendingUp },
  { title: "Tempo Médio", value: "18 min", change: "-2 min", icon: Clock },
];

const weekData = [
  { day: "Seg", valor: 3200 },
  { day: "Ter", valor: 2800 },
  { day: "Qua", valor: 3500 },
  { day: "Qui", valor: 4100 },
  { day: "Sex", valor: 5200 },
  { day: "Sáb", valor: 6800 },
  { day: "Dom", valor: 4230 },
];

const Overview = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Visão Geral</h1>
        <p className="text-muted-foreground text-sm">Resumo do seu restaurante hoje</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{m.title}</span>
                <m.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{m.value}</p>
              <p className="text-xs text-primary mt-1">{m.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Faturamento da Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString()}`, "Faturamento"]}
                />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Overview;
