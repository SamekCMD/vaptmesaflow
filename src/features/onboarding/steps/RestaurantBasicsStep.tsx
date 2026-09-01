import { Store } from "lucide-react";

import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingFieldErrors, OnboardingForm } from "../onboarding-form";

type Props = {
  form: OnboardingForm;
  errors: OnboardingFieldErrors;
  disabled: boolean;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onWhatsappChange: (value: string) => void;
};

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? <p id={id} className="text-xs text-destructive">{message}</p> : null;

export function RestaurantBasicsStep({
  form,
  errors,
  disabled,
  onNameChange,
  onSlugChange,
  onWhatsappChange,
}: Props) {
  return (
    <>
      <CardHeader className="space-y-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Store className="h-5 w-5" strokeWidth={1.7} />
        </div>
        <CardTitle>Vamos criar seu restaurante</CardTitle>
        <CardDescription>Comece pelas informações que seus clientes reconhecerão.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="restaurant-name">Nome do restaurante</Label>
          <Input
            id="restaurant-name"
            value={form.name}
            onChange={(event) => onNameChange(event.target.value)}
            disabled={disabled}
            maxLength={80}
            placeholder="Ex: Hamburgueria do Chef"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "restaurant-name-error" : undefined}
          />
          <FieldError id="restaurant-name-error" message={errors.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="restaurant-slug">Endereço do cardápio</Label>
          <div className="flex overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
            <span className="flex items-center border-r border-input bg-muted/60 px-3 text-xs text-muted-foreground">vapt.app/menu/</span>
            <Input
              id="restaurant-slug"
              className="rounded-none border-0 focus-visible:ring-0"
              value={form.slug}
              onChange={(event) => onSlugChange(event.target.value)}
              disabled={disabled}
              maxLength={60}
              aria-invalid={Boolean(errors.slug)}
              aria-describedby={errors.slug ? "restaurant-slug-error" : undefined}
            />
          </div>
          <FieldError id="restaurant-slug-error" message={errors.slug} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="restaurant-whatsapp">WhatsApp <span className="font-normal text-muted-foreground">(opcional)</span></Label>
          <Input
            id="restaurant-whatsapp"
            value={form.whatsapp}
            onChange={(event) => onWhatsappChange(event.target.value)}
            disabled={disabled}
            maxLength={20}
            placeholder="(11) 99999-9999"
          />
        </div>
      </CardContent>
    </>
  );
}

