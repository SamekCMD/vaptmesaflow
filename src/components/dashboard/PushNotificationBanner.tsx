import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import {
  isPushSupported,
  isPushConfigured,
  isPushDismissed,
  isAlreadySubscribed,
  dismissPushBanner,
  subscribeToPush,
} from "@/lib/push-notifications";
import { toast } from "@/hooks/use-toast";

interface PushNotificationBannerProps {
  restaurantId: string | null;
}

const PushNotificationBanner = ({ restaurantId }: PushNotificationBannerProps) => {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (
      isPushSupported() &&
      isPushConfigured() &&
      !isPushDismissed() &&
      !isAlreadySubscribed() &&
      Notification.permission !== "denied"
    ) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleActivate = async () => {
    if (!restaurantId) return;
    setSubscribing(true);
    const result = await subscribeToPush(restaurantId);
    setSubscribing(false);

    if (result.success) {
      toast({ title: "Notificações ativadas!", description: "Você receberá alertas de novos pedidos." });
      setVisible(false);
    } else if (result.error === "Permission denied") {
      toast({
        title: "Permissão negada",
        description: "Permita notificações nas configurações do navegador.",
        variant: "destructive",
      });
      dismissPushBanner();
      setVisible(false);
    } else {
      toast({ title: "Erro ao ativar", description: result.error || "Tente novamente mais tarde.", variant: "destructive" });
    }
  };

  const handleDismiss = () => {
    dismissPushBanner();
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="relative flex items-center gap-3 p-3 rounded-md border border-border bg-card"
        >
          <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Ative as notificações</p>
            <p className="text-xs text-muted-foreground">Receba alertas de novos pedidos e solicitações de conta em tempo real.</p>
          </div>
          <Button
            size="sm"
            className="shrink-0 h-7 text-xs"
            onClick={handleActivate}
            disabled={subscribing}
          >
            {subscribing ? "Ativando..." : "Ativar"}
          </Button>
          <button
            onClick={handleDismiss}
            className="absolute top-1 right-1 p-1 text-muted-foreground hover:text-foreground rounded-full"
            aria-label="Fechar aviso de notificações"
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PushNotificationBanner;
