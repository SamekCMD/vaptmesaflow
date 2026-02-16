import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, Loader2, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  paymentId: string;
  restaurantId: string;
  qrCodeBase64: string;
  pixPayload: string;
  expiration: string;
  primaryColor: string;
  onPaymentConfirmed: () => void;
}

const PixPaymentModal = ({
  open,
  onClose,
  paymentId,
  restaurantId,
  qrCodeBase64,
  pixPayload,
  primaryColor,
  expiration,
  onPaymentConfirmed,
}: PixPaymentModalProps) => {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  // Countdown timer
  useEffect(() => {
    if (!open || confirmed) return;
    const updateTimer = () => {
      const remaining = new Date(expiration).getTime() - Date.now();
      if (remaining <= 0) {
        setTimeLeft("Expirado");
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [open, expiration, confirmed]);

  // Polling for payment status
  const checkStatus = useCallback(async () => {
    if (!paymentId || !restaurantId || confirmed) return;

    try {
      const { data, error } = await supabase.functions.invoke(
        "check-payment-status",
        {
          body: { restaurant_id: restaurantId, payment_id: paymentId },
        }
      );

      if (error) throw error;
      if (data?.is_confirmed) {
        setConfirmed(true);
        onPaymentConfirmed();
      }
    } catch (err) {
      console.error("Error checking payment:", err);
    }
  }, [paymentId, restaurantId, confirmed, onPaymentConfirmed]);

  useEffect(() => {
    if (!open || confirmed) return;
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [open, confirmed, checkStatus]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      toast({ title: "Código Pix copiado!" });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handleClose = () => {
    if (confirmed) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm mx-auto">
        <AnimatePresence mode="wait">
          {confirmed ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1, stiffness: 200 }}
              >
                <CheckCircle2
                  className="h-16 w-16 mb-4"
                  style={{ color: primaryColor }}
                />
              </motion.div>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-xl font-bold mb-2 text-center"
              >
                Pagamento Confirmado!
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground text-sm text-center"
              >
                Pedido enviado para a cozinha! 🎉
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  className="mt-6"
                  style={{ backgroundColor: primaryColor }}
                  onClick={onClose}
                >
                  Fechar
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="payment"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <DialogTitle className="text-center">
                  Pagamento via Pix
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-col items-center gap-4 py-4">
                {/* QR Code */}
                {qrCodeBase64 ? (
                  <div className="bg-white p-3 rounded-xl">
                    <img
                      src={`data:image/png;base64,${qrCodeBase64}`}
                      alt="QR Code Pix"
                      className="w-48 h-48"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 bg-muted rounded-xl flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}

                {/* Timer */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Expira em {timeLeft}</span>
                </div>

                {/* Copy button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar código Pix
                    </>
                  )}
                </Button>

                {/* Waiting indicator */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aguardando pagamento...
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default PixPaymentModal;
