import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import {
  isPushSupported,
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
    // Show banner only if: push supported, not dismissed, not already subscribed
    if (
      isPushSupported() &&
      !isPushDismissed() &&
      !isAlreadySubscribed() &&
      Notification.permission !== "denied"
    ) {
      // Slight delay so it doesn't flash on load
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
      toast({ title: "Notificações ativadas! 🔔", description: "Você receberá alertas de novos pedidos." });
      setVisible(false);
    } else if (result.error === "Permission denied") {
      toast({ title: "Permissão negada", description: "Permita notificações nas configurações do navegador.", variant: "destructive" });
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
          className="relative flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5"
        >
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Ative as notificações</p>
            <p className="text-xs text-muted-foreground">Receba alertas de novos pedidos e solicitações de conta em tempo real.</p>
          </div>
          <Button
            size="sm"
            className="shrink-0 h-8 text-xs"
            onClick={handleActivate}
            disabled={subscribing}
          >
            {subscribing ? "Ativando..." : "Ativar"}
          </Button>
          <button
            onClick={handleDismiss}
            className="absolute top-1 right-1 p-1 text-muted-foreground hover:text-foreground rounded-full"
          >
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PushNotificationBanner;
