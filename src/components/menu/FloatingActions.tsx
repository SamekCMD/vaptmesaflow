import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { HandHelping, Receipt, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface FloatingActionsProps {
  sessionId: string;
  primaryColor: string;
}

const FloatingActions = ({ sessionId, primaryColor }: FloatingActionsProps) => {
  const [expanded, setExpanded] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const handleCallWaiter = () => {
    toast({
      title: "Atendimento solicitado",
      description: "Um atendente vai até a mesa em instantes.",
    });
    setExpanded(false);
  };

  const handleRequestCheck = async () => {
    setRequesting(true);
    try {
      const { error } = await supabase
        .from("table_sessions")
        .update({ status: "check_requested" })
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Conta solicitada",
        description: "O caixa foi notificado. Aguarde o atendimento.",
      });
      setExpanded(false);
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível solicitar a conta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-30 flex flex-col items-end gap-2">
      <AnimatePresence>
        {expanded && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                size="sm"
                variant="secondary"
                className="shadow-lg gap-2 text-xs"
                onClick={handleCallWaiter}
              >
                <HandHelping className="h-4 w-4" />
                Chamar atendimento
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              transition={{ duration: 0.2, delay: 0.05 }}
            >
              <Button
                size="sm"
                variant="secondary"
                className="shadow-lg gap-2 text-xs"
                onClick={handleRequestCheck}
                disabled={requesting}
              >
                <Receipt className="h-4 w-4" />
                {requesting ? "Solicitando..." : "Pedir a Conta"}
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button aria-label="Abrir ações de atendimento"
        whileTap={{ scale: 0.9 }}
        className="h-12 w-12 rounded-full shadow-lg flex items-center justify-center text-white"
        style={{ backgroundColor: primaryColor }}
        onClick={() => setExpanded(!expanded)}
      >
        <AnimatePresence mode="wait">
          {expanded ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-5 w-5" />
            </motion.div>
          ) : (
            <motion.div key="bell" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <HandHelping className="h-5 w-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};

export default FloatingActions;

