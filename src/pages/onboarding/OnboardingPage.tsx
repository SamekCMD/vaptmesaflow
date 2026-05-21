import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Check, Upload, UtensilsCrossed, Palette, Store, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  GUIDE_MODULES,
  POST_SETUP_PRIMARY_ACTION,
  POST_SETUP_SECONDARY_ACTION,
  saveGuideProgress,
} from "@/lib/onboarding";

const STEPS = [
  { title: "Boas-vindas", icon: Store },
  { title: "Sua Marca", icon: Palette },
  { title: "Primeiro prato", icon: UtensilsCrossed },
  { title: "Operação", icon: UtensilsCrossed },
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const progress = ((step + 1) / STEPS.length) * 100;

  const [restaurantName, setRestaurantName] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0ea573");
  const [secondaryColor, setSecondaryColor] = useState("#1e293b");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [tableCount, setTableCount] = useState("10");
  const [dishName, setDishName] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishCategory, setDishCategory] = useState("Pratos Principais");
  const [setupComplete, setSetupComplete] = useState(false);
  const trialEndsAt = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toISOString();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleNameChange = (value: string) => {
    setRestaurantName(value);
    setSlug(
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  };

  const canAdvance = () => {
    if (step === 0) return restaurantName.trim().length >= 2;
    if (step === 1) return true;
    if (step === 2) return dishName.trim().length >= 2 && dishPrice.trim().length > 0;
    if (step === 3) return Number.parseInt(tableCount, 10) >= 1;
    return false;
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: restaurant, error: restError } = await supabase
        .from("restaurants")
        .insert({
          owner_id: user.id,
          name: restaurantName.trim(),
          slug: slug.trim(),
          whatsapp: whatsapp.trim() || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          plan_type: "starter",
          plan_status: "trialing",
          trial_ends_at: trialEndsAt,
          total_tables: Math.max(1, Number.parseInt(tableCount, 10) || 1),
          max_tables: Math.max(1, Number.parseInt(tableCount, 10) || 1),
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (restError) throw restError;
      const { error: menuError } = await supabase.from("menu_items").insert({
        restaurant_id: restaurant.id,
        name: dishName.trim(),
        price: parseFloat(dishPrice),
        description: dishDescription.trim() || null,
        category: dishCategory.trim(),
      });
      if (menuError) throw menuError;
      const completedGuideProgress = GUIDE_MODULES.reduce(
        (acc, module) => ({ ...acc, [module]: true }),
        {} as Record<(typeof GUIDE_MODULES)[number], boolean>
      );
      saveGuideProgress(completedGuideProgress);
      toast({ title: "Restaurante criado com sucesso!" });
      setSetupComplete(true);
    } catch (err: unknown) {
      const description = err instanceof Error ? err.message : "Tente novamente.";
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
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div
                className={`h-7 w-7 rounded-md flex items-center justify-center text-xs font-medium ${
                  i <= step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className="text-xs font-medium hidden sm:inline">{s.title}</span>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pt-6 pb-12">
        <Card className="w-full max-w-lg">
          {step === 0 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Store className="h-4 w-4 text-primary" strokeWidth={1.5} /> Boas-vindas ao Vapt!
                </CardTitle>
                <CardDescription>Vamos configurar seu restaurante em poucos minutos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="restaurant-name">Nome do Restaurante</Label>
                  <Input
                    id="restaurant-name"
                    placeholder="Ex: Hamburgueria do Chef"
                    value={restaurantName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL do Cardápio</Label>
                  <div className="flex items-center gap-0 rounded-md border border-border overflow-hidden">
                    <span className="bg-secondary px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">vapt.app/menu/</span>
                    <Input className="border-0 focus:ring-0 rounded-none" value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={60} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp (opcional)</Label>
                  <Input placeholder="(11) 99999-9999" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={20} />
                </div>
              </CardContent>
            </>
          )}

          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Palette className="h-4 w-4 text-primary" strokeWidth={1.5} /> Sua Marca
                </CardTitle>
                <CardDescription>Escolha as cores e suba seu logotipo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Logo do Restaurante</Label>
                  <label className="flex flex-col items-center justify-center h-32 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors duration-150">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="h-24 w-24 object-contain rounded-lg" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-muted-foreground mb-2" strokeWidth={1.5} />
                        <span className="text-sm text-muted-foreground">Clique para enviar</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor Primária</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-9 w-9 rounded-md border border-border cursor-pointer"
                      />
                      <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono text-sm" maxLength={7} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor Secundária</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="h-9 w-9 rounded-md border border-border cursor-pointer"
                      />
                      <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono text-sm" maxLength={7} />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg overflow-hidden border border-border">
                  <div className="h-12 flex items-center justify-center text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>
                    {restaurantName || "Seu Restaurante"}
                  </div>
                  <div className="p-3 bg-card">
                    <div className="h-3 w-2/3 rounded bg-secondary mb-2" />
                    <div className="h-3 w-1/2 rounded bg-secondary" />
                    <Button size="sm" className="mt-3 text-xs" style={{ backgroundColor: primaryColor }}>
                      Exemplo de Botão
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UtensilsCrossed className="h-4 w-4 text-primary" strokeWidth={1.5} /> Primeiro prato
                </CardTitle>
                <CardDescription>Adicione um item ao cardápio para começar a operação.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dish-name">Nome do Prato</Label>
                  <Input
                    id="dish-name"
                    placeholder="Ex: X-Burguer Especial"
                    value={dishName}
                    onChange={(e) => setDishName(e.target.value)}
                    maxLength={80}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dish-price">Preço (R$)</Label>
                    <Input
                      id="dish-price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="29.90"
                      value={dishPrice}
                      onChange={(e) => setDishPrice(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dish-category">Categoria</Label>
                    <Input
                      id="dish-category"
                      placeholder="Ex: Pratos Principais"
                      value={dishCategory}
                      onChange={(e) => setDishCategory(e.target.value)}
                      maxLength={40}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dish-description">Descrição</Label>
                  <Input
                    id="dish-description"
                    placeholder="Descreva os ingredientes ou detalhes..."
                    value={dishDescription}
                    onChange={(e) => setDishDescription(e.target.value)}
                    maxLength={200}
                  />
                </div>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UtensilsCrossed className="h-4 w-4 text-primary" strokeWidth={1.5} /> Primeira operação
                </CardTitle>
                <CardDescription>Defina quantas mesas começam ativas e deixe tudo pronto para operar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="table-count">Número inicial de mesas</Label>
                  <Input
                    id="table-count"
                    type="number"
                    min="1"
                    placeholder="Ex: 10"
                    value={tableCount}
                    onChange={(e) => setTableCount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Você pode alterar isso depois nas configurações.</p>
                </div>
              </CardContent>
            </>
          )}

          <CardFooter className="flex justify-between">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={!canAdvance()} onClick={() => setStep((s) => s + 1)}>
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
