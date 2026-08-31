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
import { useAccountBootstrap } from "@/features/auth/use-account-bootstrap";
import type { PlanDefinition } from "@/lib/plans";
import { STRIPE_PUBLISHABLE_KEY } from "@/lib/constants";
import { n8nClient, N8nClientError } from "@/lib/n8n-client";

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

interface CheckoutFormProps {
  planName: string;
  clientSecret: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
}

function CheckoutForm({ planName, clientSecret, loading, setLoading }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const confirmParams = {
      return_url: `${window.location.origin}/dashboard?subscribed=true`,
    };

    const result = clientSecret.startsWith("seti_")
      ? await stripe.confirmSetup({
          elements,
          confirmParams,
        })
      : clientSecret.startsWith("pi_")
        ? await stripe.confirmPayment({
            elements,
            confirmParams,
          })
        : {
            error: {
              message: "Tipo de confirmação da Stripe não suportado para este checkout.",
            },
          };

    if (result.error) {
      setError(result.error.message || "Erro ao processar pagamento.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={!stripe || loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processando...
          </>
        ) : (
          `Assinar plano ${planName}`
        )}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
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
  const { data: bootstrap } = useAccountBootstrap();
  const organizationId = bootstrap?.currentOrganizationId ?? null;
  const { restaurantId, planStatus } = useSubscription();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchingSecret, setFetchingSecret] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !plan || !user || !organizationId || !restaurantId) {
      setClientSecret(null);
      setFetchError(null);
      return;
    }

    const createSession = async () => {
      setFetchingSecret(true);
      setFetchError(null);

      try {
        const data =
          planStatus === "active"
            ? await n8nClient.stripe.changeSubscription({
                organizationId,
                restaurantId,
                targetPlanType: plan.id,
                targetPriceId: plan.priceId,
              })
            : await n8nClient.stripe.createSubscription({
                organizationId,
                restaurantId,
                email: user.email || "",
                planType: plan.id,
                priceId: plan.priceId,
              });

        if (data.autoCharged === true) {
          onAutoCharged?.();
          onOpenChange(false);
        } else if (
          typeof data.clientSecret === "string" &&
          (data.clientSecret.startsWith("seti_") || data.clientSecret.startsWith("pi_"))
        ) {
          setClientSecret(data.clientSecret);
        } else {
          setFetchError(
            "A assinatura foi criada sem client secret retornado pela Stripe. O fluxo no n8n ainda não concluiu a etapa de confirmação.",
          );
        }
      } catch (error) {
        if (error instanceof N8nClientError) {
          setFetchError(error.message);
        } else {
          setFetchError("Erro de conexão. Tente novamente.");
        }
      } finally {
        setFetchingSecret(false);
      }
    };

    createSession();
  }, [open, plan, user, organizationId, restaurantId, planStatus, onAutoCharged, onOpenChange]);

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assinar plano {plan.name}</DialogTitle>
          <DialogDescription>R$ {plan.price},00/mês</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {fetchingSecret && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Preparando checkout...</p>
            </div>
          )}

          {fetchError && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Lock className="h-8 w-8 text-destructive" />
              <p className="text-center text-sm text-destructive">{fetchError}</p>
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
                clientSecret={clientSecret}
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

