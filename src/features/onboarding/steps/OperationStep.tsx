import { Bike, Store, UtensilsCrossed } from "lucide-react";

import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getOperationMode,
  type OnboardingFieldErrors,
  type OnboardingForm,
  type OperationMode,
} from "../onboarding-form";

const MODES = [
  { value: "local" as const, label: "Salão", description: "Atendimento em mesas", icon: Store },
  { value: "delivery" as const, label: "Delivery", description: "Pedidos para entrega", icon: Bike },
  { value: "both" as const, label: "Ambos", description: "Salão e entregas", icon: UtensilsCrossed },
];

type Props = {
  form: OnboardingForm;
  errors: OnboardingFieldErrors;
  disabled: boolean;
  onModeChange: (mode: OperationMode) => void;
  onTableCountChange: (value: number) => void;
};

export function OperationStep({ form, errors, disabled, onModeChange, onTableCountChange }: Props) {
  const selectedMode = getOperationMode(form.localEnabled, form.deliveryEnabled);
  return (
    <>
      <CardHeader className="space-y-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UtensilsCrossed className="h-5 w-5" strokeWidth={1.7} />
        </div>
        <CardTitle>Como você atende hoje?</CardTitle>
        <CardDescription>Escolha o formato da operação. Você poderá alterar isso depois.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Formato de atendimento</Label>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Formato de atendimento">
            {MODES.map(({ value, label, description, icon: Icon }) => {
              const selected = selectedMode === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => onModeChange(value)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30",
                  )}
                >
                  <Icon className={cn("mb-3 h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} />
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
                </button>
              );
            })}
          </div>
          {errors.operationMode ? <p className="text-xs text-destructive">{errors.operationMode}</p> : null}
        </div>
        {form.localEnabled ? (
          <div className="space-y-2">
            <Label htmlFor="table-count">Número inicial de mesas</Label>
            <Input
              id="table-count"
              type="number"
              min={1}
              value={form.totalTables}
              onChange={(event) => onTableCountChange(Number.parseInt(event.target.value, 10) || 0)}
              disabled={disabled}
              aria-invalid={Boolean(errors.totalTables)}
            />
            {errors.totalTables ? <p className="text-xs text-destructive">{errors.totalTables}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </>
  );
}

