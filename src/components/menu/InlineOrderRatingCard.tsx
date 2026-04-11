import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Star } from "lucide-react";
import {
  FEEDBACK_REASONS,
  markOrderAsRated,
  shouldPromptForOrderFeedback,
  submitOrderFeedback,
} from "@/lib/order-feedback";

type InlineOrderRatingCardProps = {
  orderId: string;
  restaurantId: string;
  displayId: number;
  primaryColor: string;
  feedbackWebhookUrl?: string;
};

const InlineOrderRatingCard = ({
  orderId,
  restaurantId,
  displayId,
  primaryColor,
  feedbackWebhookUrl,
}: InlineOrderRatingCardProps) => {
  const [hasRatedBefore] = useState(() => !shouldPromptForOrderFeedback({ orderId, status: "completed" }));
  const [rating, setRating] = useState(0);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (hasRatedBefore) {
    return null;
  }

  const toggleReason = (reason: string) => {
    setSelectedReasons((current) =>
      current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason],
    );
  };

  const handleSubmit = async () => {
    if (rating === 0 || sending) return;

    setSending(true);
    setError("");

    try {
      await submitOrderFeedback({
        orderId,
        restaurantId,
        rating,
        reasons: selectedReasons,
        comment: comment.trim() || null,
        feedbackWebhookUrl,
      });
      markOrderAsRated(orderId);
      setSubmitted(true);
    } catch {
      setError("Não foi possível enviar agora. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-3 rounded-2xl border border-border bg-muted/20 px-4 py-4 text-center">
        <CheckCircle2 className="mx-auto h-7 w-7" style={{ color: primaryColor }} />
        <p className="mt-2 text-sm font-medium text-foreground">Avaliação enviada</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Obrigado. O restaurante já recebeu o retorno do pedido #{displayId}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-border bg-muted/20 px-4 py-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Como foi este pedido?</p>
        <p className="text-xs text-muted-foreground">Sua opinião ajuda o restaurante a melhorar a operação.</p>
      </div>

      <div className="mt-3 flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= rating;
          return (
            <button
              key={star}
              type="button"
              aria-label={`${star} estrela${star === 1 ? "" : "s"}`}
              aria-pressed={active}
              onClick={() => setRating(star)}
              className="transition-transform active:scale-90"
            >
              <Star
                className={`h-8 w-8 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                fill={active ? "currentColor" : "none"}
                color="currentColor"
              />
            </button>
          );
        })}
      </div>

      {rating > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_REASONS.map((reason) => {
              const active = selectedReasons.includes(reason);
              return (
                <button
                  key={reason}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleReason(reason)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: active ? `${primaryColor}55` : "hsl(var(--border))",
                    backgroundColor: active ? `${primaryColor}10` : "hsl(var(--background))",
                    color: active ? primaryColor : "hsl(var(--foreground))",
                  }}
                >
                  {reason}
                </button>
              );
            })}
          </div>

          <Textarea
            placeholder={`Comentário opcional para o pedido #${displayId}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="min-h-20 resize-none"
            maxLength={200}
          />

          <Button
            type="button"
            className="h-11 w-full text-sm font-semibold"
            style={{ backgroundColor: primaryColor }}
            onClick={handleSubmit}
            disabled={sending}
          >
            {sending ? "Enviando..." : "Enviar avaliação"}
          </Button>

          {error && <p className="text-[11px] text-destructive">{error}</p>}

          <p className="text-[11px] text-muted-foreground">
            O retorno fica vinculado ao pedido #{displayId} e ajuda a equipe a entender satisfação e operação.
          </p>
        </div>
      )}
    </div>
  );
};

export default InlineOrderRatingCard;
