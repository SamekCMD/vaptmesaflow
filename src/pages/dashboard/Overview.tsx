import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, ShoppingBag, TrendingUp, Clock, Loader2, Store } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("restaurants")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRestaurant(data);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <Store className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Nenhum restaurante encontrado</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Complete o processo de onboarding para configurar seu restaurante.
        </p>
        <Button onClick={() => navigate("/onboarding")}>Configurar Restaurante</Button>
      </div>
    );
  }

  const metrics = [
    { title: "Vendas Hoje", value: "R$ 0", change: "Sem dados ainda", icon: DollarSign },
    { title: "Pedidos Pendentes", value: "0", change: "—", icon: ShoppingBag },
    { title: "Ticket Médio", value: "R$ 0", change: "—", icon: TrendingUp },
    { title: "Tempo Médio", value: "— min", change: "—", icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{restaurant.name}</h1>
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
              <p className="text-xs text-muted-foreground mt-1">{m.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Faturamento da Semana</CardTitle>
          <p className="text-xs text-muted-foreground">Dados de exemplo — pedidos reais aparecerão aqui em breve.</p>
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
