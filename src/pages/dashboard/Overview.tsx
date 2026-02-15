import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";

import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Clock,
  Store,
} from "lucide-react";
import { OverviewSkeleton } from "@/components/skeletons/DashboardSkeletons";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";




import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";


const Overview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<any>(null);

  const [loading, setLoading] = useState(true);


  // Since we don't have order tracking implemented yet, we're removing the metrics state
  // const [metrics, setMetrics] = useState({

  //   salesToday: 0,

  //   pendingOrders: 0,

  //   averageTicket: 0,

  //   averageTime: "— min",

  //   weeklySales: [],

  // });



  useEffect(() => {

    const fetchRestaurantData = async () => {

      if (!user) return;



      try {

        // Fetch restaurant details

        const { data: restaurantData, error: restaurantError } = await supabase

          .from("restaurants")

          .select("*")

          .eq("owner_id", user.id)

          .single();



        if (restaurantError) throw restaurantError;

        setRestaurant(restaurantData);

      } catch (error: any) {

        console.error("Error fetching restaurant data:", error);

        toast({
          title: "Erro ao carregar dados",

          description: error.message || "Não foi possível carregar as informações do restaurante",

          variant: "destructive",

        });
      } finally {
        setLoading(false);

      }
    };

    fetchRestaurantData();
  }, [user]);


          

            if (loading) {
              return <OverviewSkeleton />;
            }

          

            if (!restaurant) {

              return (

                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">

                  <Store className="h-12 w-12 text-muted-foreground" />

                  <h2 className="text-xl font-semibold">Nenhum restaurante encontrado</h2>

                  <p className="text-muted-foreground text-sm max-w-sm">

                    Complete o processo de onboarding para configurar seu restaurante.

                  </p>

                  <Button onClick={() => navigate("/onboarding")}>

                    Configurar Restaurante

                  </Button>

                </div>

              );

            }

          

            // Using mock metrics for now since we don't have order data yet
            // In a real implementation, these would be calculated from actual order data
            const metricCards = [

              {

                title: "Vendas Hoje",

                value: "R$ 0,00", // Would be calculated from completed orders for today
                change: "Sem dados ainda", // Would compare with yesterday
                icon: DollarSign,
              },
              {
                title: "Pedidos Pendentes", 
                value: "0", // Would be count of pending orders
                change: "Nenhum pedido",
                icon: ShoppingBag,
              },
              {
                title: "Ticket Médio",
                value: "R$ 0,00", // Would be average of completed orders
                change: "Calculando...",
                icon: TrendingUp,
              },
              {
                title: "Tempo Médio",
                value: "— min", // Would be calculated from kitchen prep times
                change: "Preparação + entrega",

                icon: Clock,

              },

            ];




  // Mock weekly sales data - in a real implementation this would come from actual order data

  const weekData = [

    { day: "Seg", valor: 0 },

    { day: "Ter", valor: 0 },

    { day: "Qua", valor: 0 },

    { day: "Qui", valor: 0 },

    { day: "Sex", valor: 0 },

    { day: "Sáb", valor: 0 },

    { day: "Dom", valor: 0 },

  ];


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{restaurant.name}</h1>

        <p className="text-muted-foreground text-sm">

          Resumo do seu restaurante hoje

        </p>

      </div>



      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {metricCards.map((m) => (

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

          <p className="text-xs text-muted-foreground">

            Dados reais aparecerão aqui quando você começar a receber pedidos
          </p>
        </CardHeader>

        <CardContent>

          <div className="h-[300px]">

            <ResponsiveContainer width="100%" height="100%">

              <LineChart data={weekData}>
                <CartesianGrid

                  strokeDasharray="3 3"

                  stroke="hsl(var(--border))"

                />



                <XAxis

                  dataKey="day"

                  stroke="hsl(var(--muted-foreground))"

                  fontSize={12}

                />



                <YAxis

                  stroke="hsl(var(--muted-foreground))"

                  fontSize={12}

                  tickFormatter={(v) => `R$${v}`}

                />



                <Tooltip

                  contentStyle={{

                    backgroundColor: "hsl(var(--card))",

                    border: "1px solid hsl(var(--border))",

                    borderRadius: "8px",

                    fontSize: "12px",

                  }}

                  formatter={(value: number) => [

                    `R$ ${value.toLocaleString()}`,

                    "Faturamento",

                  ]}

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

