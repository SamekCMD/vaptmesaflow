import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import type { PlanDefinition } from "@/lib/plans";
import { STRIPE_PUBLISHABLE_KEY, N8N_CHECKOUT_WEBHOOK_URL } from "@/lib/constants";

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

interface CheckoutFormProps {
  planName: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
}

function CheckoutForm({ planName, loading, setLoading }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard?subscribed=true`,
      },
    });

    if (error) {
      setError(error.message || "Erro ao processar pagamento.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</p>
      )}
      <Button type="submit" className="w-full" disabled={!stripe || loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processando...
          </>
        ) : (
          `Assinar plano ${planName}`
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" />
        Pagamento seguro via Stripe. Cancele quando quiser.
      </p>
    </form>
  );
}

interface StripeCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanDefinition | null;
  onAutoCharged?: () => void;
}

export default function StripeCheckoutModal({ open, onOpenChange, plan, onAutoCharged }: StripeCheckoutModalProps) {
  const { user } = useAuth();
  const { restaurantId } = useSubscription();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchingSecret, setFetchingSecret] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !plan || !user || !restaurantId) {
      setClientSecret(null);
      setFetchError(null);
      return;
    }

    const createSession = async () => {
      setFetchingSecret(true);
      setFetchError(null);
      try {
        const response = await fetch(N8N_CHECKOUT_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_checkout_session",
            restaurant_id: restaurantId,
            email: user.email,
            price_id: plan.priceId,
            plan_type: plan.id,
          }),
        });
        const data = await response.json();

        if (data.autoCharged === true || !data.clientSecret) {
          // Plan was auto-charged or no payment needed
          onAutoCharged?.();
          onOpenChange(false);
        } else if (
          typeof data.clientSecret === "string" &&
          (data.clientSecret.startsWith("seti_") || data.clientSecret.startsWith("pi_"))
        ) {
          setClientSecret(data.clientSecret);
        } else {
          setFetchError("Não foi possível iniciar o checkout. Tente novamente.");
        }
      } catch {
        setFetchError("Erro de conexão. Tente novamente.");
      } finally {
        setFetchingSecret(false);
      }
    };

    createSession();
  }, [open, plan, user, restaurantId]);

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assinar plano {plan.name}</DialogTitle>
          <DialogDescription>
            R$ {plan.price},00/mês
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {fetchingSecret && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Preparando checkout...</p>
            </div>
          )}

          {fetchError && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Lock className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive text-center">{fetchError}</p>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          )}

          {clientSecret && !fetchingSecret && !fetchError && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: {
                    colorPrimary: "hsl(142, 76%, 36%)",
                    borderRadius: "8px",
                  },
                },
              }}
            >
              <CheckoutForm
                planName={plan.name}
                loading={submitting}
                setLoading={setSubmitting}
              />
            </Elements>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
