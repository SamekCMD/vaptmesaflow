import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import TableCard, { type TableSession } from "@/components/cashier/TableCard";
import TableSessionModal from "@/components/cashier/TableSessionModal";
import FeatureGate from "@/components/FeatureGate";
import OnboardingGuideCard from "@/components/dashboard/OnboardingGuideCard";
import {
  completeGuideModule,
  getGuideModuleHref,
  getNextGuideModule,
  GUIDE_MODULE_CONTENT,
} from "@/lib/onboarding";
import { useNavigate, useSearchParams } from "react-router-dom";

type RestaurantCashierRow = {
  id: string;
  total_tables: number | null;
  max_tables: number | null;
};

type TableSessionRow = {
  id: string;
  restaurant_id: string;
  table_number: string;
  status: TableSession["status"];
  opened_at: string;
  closed_at: string | null;
};

type OrderAggregateRow = {
  table_session_id: string;
  total_price: number;
};

const playBellSound = () => {
  try {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(830, ctx.currentTime);
    osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(830, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[CashierPage] could not play bell sound", error);
    }
  }
};

const CashierPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [totalTables, setTotalTables] = useState(20);
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<TableSession | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const knownCheckRequestedRef = useRef<Set<string>>(new Set());
  const knownOrderCountRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("restaurants")
      .select("id, total_tables, max_tables")
      .eq("owner_id", user.id)
      .single();
    if (data) {
        const row = data as RestaurantCashierRow;
        setRestaurantId(row.id);
        setTotalTables(row.max_tables || row.total_tables || 20);
      }
    };
    fetch();
  }, [user]);

  const guideMode = searchParams.get("guide") === "1";
  const guideNextModule = getNextGuideModule("cashier");

  const handleGuideComplete = () => {
    completeGuideModule("cashier");
    navigate(guideNextModule ? getGuideModuleHref(guideNextModule) : "/dashboard", { replace: true });
  };

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!restaurantId) return;
    const { data: sessionsData } = await supabase
      .from("table_sessions")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .in("status", ["open", "check_requested"]);
    if (!sessionsData) return;
    const sessionRows = sessionsData as TableSessionRow[];
    const sessionIds = sessionRows.map((s) => s.id);
    const orderAggs: Record<string, { total: number; count: number }> = {};
    if (sessionIds.length > 0) {
      const { data: ordersData } = await supabase
        .from("orders")
        .select("table_session_id, total_price")
        .in("table_session_id", sessionIds);
      if (ordersData) {
        for (const o of ordersData as OrderAggregateRow[]) {
          if (!orderAggs[o.table_session_id]) orderAggs[o.table_session_id] = { total: 0, count: 0 };
          orderAggs[o.table_session_id].total += Number(o.total_price);
          orderAggs[o.table_session_id].count += 1;
        }
      }
    }
    const mapped: TableSession[] = sessionRows.map((s) => ({
      id: s.id, restaurant_id: s.restaurant_id, table_number: s.table_number,
      status: s.status, opened_at: s.opened_at, closed_at: s.closed_at,
      session_total: orderAggs[s.id]?.total || null, order_count: orderAggs[s.id]?.count || null,
    }));
    const currentCheckRequested = new Set(mapped.filter((s) => s.status === "check_requested").map((s) => s.id));
    if (knownCheckRequestedRef.current.size > 0) {
      for (const id of currentCheckRequested) {
        if (!knownCheckRequestedRef.current.has(id)) {
          playBellSound();
          const session = mapped.find((s) => s.id === id);
          toast({ title: `Mesa ${session?.table_number} pediu a conta!`, description: "Clique na mesa para ver o extrato." });
          break;
        }
      }
    }
    knownCheckRequestedRef.current = currentCheckRequested;
    const currentOrderCounts = new Map(mapped.map((s) => [s.id, s.order_count || 0]));
    if (knownOrderCountRef.current.size > 0) {
      for (const [id, count] of currentOrderCounts) {
        const prev = knownOrderCountRef.current.get(id) || 0;
        if (count > prev) {
          playBellSound();
          const session = mapped.find((s) => s.id === id);
          toast({ title: `Novo pedido na Mesa ${session?.table_number}!` });
          break;
        }
      }
    }
    knownOrderCountRef.current = currentOrderCounts;
    setSessions(mapped);
  }, [restaurantId]);

  useEffect(() => { if (restaurantId) fetchSessions(); }, [restaurantId, fetchSessions]);
  useEffect(() => {
    if (!restaurantId) return;
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [restaurantId, fetchSessions]);

  const handleTableClick = (tableNum: string) => {
    const session = sessions.find((s) => s.table_number === tableNum) || null;
    setSelectedSession(session);
    setModalOpen(true);
  };

  const tableNumbers = Array.from({ length: totalTables }, (_, i) => String(i + 1));

  return (
    <FeatureGate feature="cashier" requiredPlan="pro">
      <div className="space-y-6">
        {guideMode && (
          <OnboardingGuideCard
            module="cashier"
            title={GUIDE_MODULE_CONTENT.cashier.title}
            description={GUIDE_MODULE_CONTENT.cashier.description}
            nextHref={guideNextModule ? getGuideModuleHref(guideNextModule) : null}
            onComplete={handleGuideComplete}
          />
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Caixa</h1>
            <p className="text-muted-foreground text-sm">Mapa de mesas em tempo real</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSessions}>
            <RefreshCw className="h-4 w-4 mr-1" strokeWidth={1.5} />
            Atualizar
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border border-border" />
            <span className="text-muted-foreground">Livre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border border-[hsl(153_14%_34%)] bg-[hsl(153_27%_14%)]" />
            <span className="text-muted-foreground">Ocupada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border border-[hsl(44_51%_54%)] bg-[hsl(37_27%_13%)] animate-pulse" />
            <span className="text-muted-foreground">Pediu a Conta</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {tableNumbers.map((num) => {
            const session = sessions.find((s) => s.table_number === num) || null;
            return <TableCard key={num} tableNumber={num} session={session} onClick={() => handleTableClick(num)} tick={tick} />;
          })}
        </div>

        <TableSessionModal open={modalOpen} onClose={() => setModalOpen(false)} session={selectedSession} onSessionClosed={fetchSessions} />
      </div>
    </FeatureGate>
  );
};

export default CashierPage;
