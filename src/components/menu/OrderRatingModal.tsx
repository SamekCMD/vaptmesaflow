import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Check } from "lucide-react";

interface OrderRatingModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  displayId: number;
  restaurantId: string;
  primaryColor: string;
  webhookUrl?: string;
}

const OrderRatingModal = ({
  open,
  onClose,
  orderId,
  displayId,
  restaurantId,
  primaryColor,
  webhookUrl,
}: OrderRatingModalProps) => {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSending(true);
    try {
      // POST to webhook if available
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: orderId,
            restaurant_id: restaurantId,
            rating,
            comment: comment.trim() || null,
          }),
        });
      }
      // Mark as rated in sessionStorage
      const key = `rated_orders`;
      const rated: string[] = JSON.parse(sessionStorage.getItem(key) || "[]");
      rated.push(orderId);
      sessionStorage.setItem(key, JSON.stringify(rated));

      setSubmitted(true);
      setTimeout(onClose, 2000);
    } catch {
      // silently fail, still mark as rated to avoid re-prompting
      const key = `rated_orders`;
      const rated: string[] = JSON.parse(sessionStorage.getItem(key) || "[]");
      rated.push(orderId);
      sessionStorage.setItem(key, JSON.stringify(rated));
      setSubmitted(true);
      setTimeout(onClose, 2000);
    } finally {
      setSending(false);
    }
  };

  const handleSkip = () => {
    const key = `rated_orders`;
    const rated: string[] = JSON.parse(sessionStorage.getItem(key) || "[]");
    rated.push(orderId);
    sessionStorage.setItem(key, JSON.stringify(rated));
    onClose();
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-w-md mx-auto">
        <DrawerHeader>
          <DrawerTitle className="text-center">
            {submitted ? "Obrigado! 🎉" : "Como foi seu pedido?"}
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-6 pb-6">
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="thanks"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-6 space-y-3"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="h-16 w-16 rounded-full mx-auto flex items-center justify-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Check className="h-8 w-8 text-white" />
                </motion.div>
                <p className="text-sm text-muted-foreground">
                  Sua avaliação do pedido #{displayId} foi enviada!
                </p>
              </motion.div>
            ) : (
              <motion.div key="form" className="space-y-4">
                <p className="text-center text-sm text-muted-foreground">
                  Pedido #{displayId}
                </p>

                {/* Stars */}
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(0)}
                      onClick={() => setRating(star)}
                      className="transition-transform active:scale-90"
                    >
                      <Star
                        className="h-9 w-9 transition-colors"
                        fill={star <= (hoveredStar || rating) ? "#facc15" : "none"}
                        color={star <= (hoveredStar || rating) ? "#facc15" : "hsl(var(--muted-foreground))"}
                      />
                    </button>
                  ))}
                </div>

                <Textarea
                  placeholder="Algum comentário? (opcional)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="resize-none h-20"
                  maxLength={200}
                />

                <Button
                  className="w-full h-11"
                  style={{ backgroundColor: primaryColor }}
                  onClick={handleSubmit}
                  disabled={rating === 0 || sending}
                >
                  {sending ? "Enviando..." : "Enviar Avaliação"}
                </Button>

                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full text-center text-sm text-muted-foreground hover:underline"
                >
                  Pular
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default OrderRatingModal;
