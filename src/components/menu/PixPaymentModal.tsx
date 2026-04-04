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
import { supabase } from "@/lib/supabase";

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  qrCodeBase64: string;
  pixPayload: string;
  expiration: string;
  primaryColor: string;
  onPaymentConfirmed: () => void;
}

const PixPaymentModal = ({
  open,
  onClose,
  orderId,
  qrCodeBase64,
  pixPayload,
  primaryColor,
  expiration,
  onPaymentConfirmed,
}: PixPaymentModalProps) => {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  // Relógio de Expiração
  useEffect(() => {
    if (!open || confirmed) return;
    const updateTimer = () => {
      const diff = Math.floor((new Date(expiration).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        setTimeLeft("Expirado");
        return;
      }
      const minutes = Math.floor(diff / 60).toString().padStart(2, "0");
      const seconds = (diff % 60).toString().padStart(2, "0");
      setTimeLeft(`${minutes}:${seconds}`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [open, expiration, confirmed]);

  // VIGILÂNCIA DO BANCO (Polling)
  const checkStatus = useCallback(async () => {
    if (!orderId || confirmed || !open) return;

    if (import.meta.env.DEV) console.log("🔍 Vapt Vigilante: Verificando pagamento do pedido:", orderId);

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("payment_status")
        .eq("id", orderId)
        .single();

      if (error) {
        if (import.meta.env.DEV) console.error("❌ Erro na vigilância:", error.message);
        return;
      }
      
      if (import.meta.env.DEV) console.log("📡 Status atual no banco:", data?.payment_status);

      // Se o n8n já mudou para CONFIRMED ou RECEIVED, ativa o sucesso!
      if (data && ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(data.payment_status)) {
        if (import.meta.env.DEV) console.log("✅ PAGAMENTO DETECTADO!");
        setConfirmed(true);
        onPaymentConfirmed();
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error("🚨 Erro crítico ao checar pagamento:", err);
    }
  }, [orderId, confirmed, open, onPaymentConfirmed]);

  // Inicia o vigia a cada 2 segundos (Mais rápido que os 5s anteriores)
  useEffect(() => {
    if (!open || confirmed) return;
    const interval = setInterval(checkStatus, 2000);
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

                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Expira em {timeLeft}</span>
                </div>

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