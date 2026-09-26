import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { fetchOwnedRestaurant } from "@/lib/restaurants";
import { listTableSessions } from "@/lib/table-sessions";
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
      const data = await fetchOwnedRestaurant();
      if (data) {
        setTotalTables(data.maxTables || data.totalTables || 20);
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
    try {
      const currentSessions = await listTableSessions();
      const currentCheckRequested = new Set(currentSessions.filter((s) => s.status === "check_requested").map((s) => s.id));
      if (knownCheckRequestedRef.current.size > 0) {
        for (const id of currentCheckRequested) {
          if (!knownCheckRequestedRef.current.has(id)) {
            playBellSound();
            const session = currentSessions.find((s) => s.id === id);
            toast({ title: `Mesa ${session?.tableNumber} pediu a conta!`, description: "Clique na mesa para ver o extrato." });
            break;
          }
        }
      }
      knownCheckRequestedRef.current = currentCheckRequested;
      const currentOrderCounts = new Map(currentSessions.map((s) => [s.id, s.orderCount]));
      if (knownOrderCountRef.current.size > 0) {
        for (const [id, count] of currentOrderCounts) {
          const prev = knownOrderCountRef.current.get(id) || 0;
          if (count > prev) {
            playBellSound();
            const session = currentSessions.find((s) => s.id === id);
            toast({ title: `Novo pedido na Mesa ${session?.tableNumber}!` });
            break;
          }
        }
      }
      knownOrderCountRef.current = currentOrderCounts;
      setSessions(currentSessions);
    } catch {
      toast({ title: "Erro", description: "Não foi possível atualizar as mesas.", variant: "destructive" });
    }
  }, []);

  useEffect(() => { if (user) void fetchSessions(); }, [user, fetchSessions]);
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [user, fetchSessions]);

  const handleTableClick = (tableNum: string) => {
    const session = sessions.find((s) => s.tableNumber === tableNum) || null;
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
            const session = sessions.find((s) => s.tableNumber === num) || null;
            return <TableCard key={num} tableNumber={num} session={session} onClick={() => handleTableClick(num)} tick={tick} />;
          })}
        </div>

        <TableSessionModal
          key={selectedSession?.id ?? "empty-session"}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          session={selectedSession}
          onSessionClosed={fetchSessions}
        />
      </div>
    </FeatureGate>
  );
};

export default CashierPage;
