import { CheckCircle2 } from "lucide-react";

import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOperationMode, type OnboardingForm } from "../onboarding-form";

const MODE_LABELS = { local: "Salão", delivery: "Delivery", both: "Salão e Delivery" } as const;

export function ReadyStep({ form }: { form: OnboardingForm }) {
  const mode = getOperationMode(form.localEnabled, form.deliveryEnabled);
  return (
    <>
      <CardHeader className="space-y-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CheckCircle2 className="h-5 w-5" strokeWidth={1.7} />
        </div>
        <CardTitle>Pronto para começar</CardTitle>
        <CardDescription>Confira os dados antes de preparar seu espaço no Vapt.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Restaurante</p>
          <p className="mt-1 font-semibold">{form.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">vapt.app/menu/{form.slug}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Operação</p>
            <p className="mt-1 text-sm font-semibold">{mode ? MODE_LABELS[mode] : "Não definida"}</p>
          </div>
          {form.localEnabled ? (
            <div className="rounded-xl border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mesas</p>
              <p className="mt-1 text-sm font-semibold">{form.totalTables}</p>
            </div>
          ) : null}
        </div>
        {form.whatsapp ? (
          <div className="rounded-xl border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">WhatsApp</p>
            <p className="mt-1 text-sm font-semibold">{form.whatsapp}</p>
          </div>
        ) : null}
      </CardContent>
    </>
  );
}
