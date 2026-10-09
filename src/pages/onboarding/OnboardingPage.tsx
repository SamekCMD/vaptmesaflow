import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Store, UtensilsCrossed } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  GUIDE_MODULES,
  POST_SETUP_PRIMARY_ACTION,
  POST_SETUP_SECONDARY_ACTION,
  saveGuideProgress,
} from "@/lib/onboarding";
import { createOnboarding } from "@/lib/restaurants";

const STEPS = [
  { title: "Boas-vindas", icon: Store },
  { title: "Primeiro prato", icon: UtensilsCrossed },
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
  const [slug, setSlug] = useState("");
  const [dishName, setDishName] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const progress = ((step + 1) / STEPS.length) * 100;

  const handleNameChange = (value: string) => {
    setRestaurantName(value);
    setSlug(
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  };

  const canAdvance = () => {
    if (step === 0) return restaurantName.trim().length >= 2 && slug.trim().length >= 2;
    return dishName.trim().length >= 2 && dishPrice.trim().length > 0;
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await createOnboarding({
        restaurantName: restaurantName.trim(),
        slug: slug.trim(),
        dishName: dishName.trim(),
        dishPrice: dishPrice.trim(),
      });
      const completedGuideProgress = GUIDE_MODULES.reduce(
        (acc, module) => ({ ...acc, [module]: true }),
        {} as Record<(typeof GUIDE_MODULES)[number], boolean>,
      );
      saveGuideProgress(completedGuideProgress);
      toast({ title: "Restaurante criado com sucesso!" });
      setSetupComplete(true);
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Tente novamente.";
      toast({ title: "Erro ao salvar", description, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (setupComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">Operação pronta</CardTitle>
            <CardDescription>
              Seu restaurante já está configurado. Agora você pode ir direto para o caixa ou continuar o guia.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link to={POST_SETUP_PRIMARY_ACTION.to}>{POST_SETUP_PRIMARY_ACTION.label}</Link>
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => navigate(POST_SETUP_SECONDARY_ACTION.to)}
            >
              {POST_SETUP_SECONDARY_ACTION.label}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 pt-6 pb-2 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((item, index) => (
            <div key={item.title} className="flex items-center gap-1.5">
              <div className={`h-7 w-7 rounded-md flex items-center justify-center text-xs font-medium ${
                index <= step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>
                {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span className="text-xs font-medium hidden sm:inline">{item.title}</span>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pt-6 pb-12">
        <Card className="w-full max-w-lg">
          {step === 0 ? (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Store className="h-4 w-4 text-primary" strokeWidth={1.5} /> Boas-vindas ao Vapt!
                </CardTitle>
                <CardDescription>Crie o restaurante. Marca e operação podem ser refinadas no painel.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="restaurant-name">Nome do Restaurante</Label>
                  <Input
                    id="restaurant-name"
                    placeholder="Ex: Hamburgueria do Chef"
                    value={restaurantName}
                    onChange={(event) => handleNameChange(event.target.value)}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="restaurant-slug">URL do Cardápio</Label>
                  <div className="flex items-center gap-0 rounded-md border border-border overflow-hidden">
                    <span className="bg-secondary px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">vapt.app/menu/</span>
                    <Input
                      id="restaurant-slug"
                      className="border-0 focus:ring-0 rounded-none"
                      value={slug}
                      onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      maxLength={60}
                    />
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UtensilsCrossed className="h-4 w-4 text-primary" strokeWidth={1.5} /> Primeiro prato
                </CardTitle>
                <CardDescription>Esse item confirma o cardápio inicial na mesma transação do restaurante.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dish-name">Nome do Prato</Label>
                  <Input
                    id="dish-name"
                    placeholder="Ex: X-Burguer Especial"
                    value={dishName}
                    onChange={(event) => setDishName(event.target.value)}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dish-price">Preço (R$)</Label>
                  <Input
                    id="dish-price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="29.90"
                    value={dishPrice}
                    onChange={(event) => setDishPrice(event.target.value)}
                  />
                </div>
              </CardContent>
            </>
          )}

          <CardFooter className="flex justify-between">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            {step === 0 ? (
              <Button disabled={!canAdvance()} onClick={() => setStep(1)}>
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button disabled={!canAdvance() || saving} onClick={handleFinish}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Finalizar
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingPage;
