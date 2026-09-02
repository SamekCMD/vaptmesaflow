import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { fontFamilyLabels, fontFamilyMap, type RestaurantConfig } from "@/lib/restaurant-config";
import { toast } from "@/hooks/use-toast";
import { Upload, Smartphone, ExternalLink, Loader2, UtensilsCrossed } from "lucide-react";
import { AppearanceFormSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useCurrentRestaurant } from "@/features/restaurants/current-restaurant";
import {
  buildRestaurantLogoPath,
  persistRestaurantAssetUpload,
  validateRestaurantImage,
} from "@/features/restaurants/restaurant-assets";

const AppearancePage = () => {
  const { user } = useAuth();
  const { restaurant, restaurantId } = useCurrentRestaurant();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [config, setConfig] = useState<RestaurantConfig>({
    id: "",
    name: "",
    slug: "",
    logoUrl: "",
    primaryColor: "#0ea573",
    secondaryColor: "#1e293b",
    fontFamily: "modern",
    activeModules: { menu: true, kds: true, metrics: true },
  });

  const updateConfig = (partial: Partial<RestaurantConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  // Fetch restaurant data
  useEffect(() => {
    const fetch = async () => {
      if (!restaurantId) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select("id, name, slug, logo_url, primary_color, secondary_color, font_family, delivery_enabled")
          .eq("id", restaurantId)
          .maybeSingle();

        if (error) throw error;
        const row = data as {
          id: string;
          name: string | null;
          slug: string | null;
          logo_url: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          font_family: string | null;
          delivery_enabled: boolean | null;
        } | null;

        if (row) {
          setDeliveryEnabled(Boolean(row.delivery_enabled));
          setConfig({
            id: row.id,
            name: row.name || "",
            slug: row.slug || "",
            logoUrl: row.logo_url || "",
            primaryColor: row.primary_color || "#0ea573",
            secondaryColor: row.secondary_color || "#1e293b",
            fontFamily: (row.font_family as RestaurantConfig["fontFamily"]) || "modern",
            activeModules: { menu: true, kds: true, metrics: true },
          });
          setLogoPreview(row.logo_url || "");
        }
      } catch (err: unknown) {
        if (import.meta.env.DEV) {
          console.error("Error fetching restaurant:", err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [restaurantId]);

  useEffect(() => () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      validateRestaurantImage(file, "logo");
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
      const previewUrl = URL.createObjectURL(file);
      previewObjectUrlRef.current = previewUrl;
      setLogoFile(file);
      setLogoPreview(previewUrl);
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Selecione outra imagem.";
      toast({ title: "Logo inválido", description, variant: "destructive" });
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!user || !config.id || !restaurant?.organizationId) return;
    setSaving(true);
    try {
      const persistBranding = async (logoUrl: string) => {
        const { error } = await supabase
          .from("restaurants")
          .update({
          name: config.name,
          slug: config.slug,
          primary_color: config.primaryColor,
          secondary_color: config.secondaryColor,
          font_family: config.fontFamily,
            logo_url: logoUrl,
          })
          .eq("id", config.id);

        if (error) throw error;
      };

      if (logoFile) {
        const uploaded = await persistRestaurantAssetUpload({
          bucket: "restaurant-assets",
          path: buildRestaurantLogoPath({
            organizationId: restaurant.organizationId,
            restaurantId: config.id,
            assetId: crypto.randomUUID(),
            contentType: logoFile.type,
          }),
          body: logoFile,
          contentType: logoFile.type,
          previousPublicUrl: config.logoUrl,
          persist: persistBranding,
        });

        if (previewObjectUrlRef.current) {
          URL.revokeObjectURL(previewObjectUrlRef.current);
          previewObjectUrlRef.current = null;
        }
        setLogoFile(null);
        setLogoPreview(uploaded.publicUrl);
        updateConfig({ logoUrl: uploaded.publicUrl });
      } else {
        await persistBranding(config.logoUrl);
      }

      toast({ title: "Aparencia salva", description: "As alteracoes de marca foram aplicadas." });
    } catch (err: unknown) {
      const description = err instanceof Error ? err.message : "Tente novamente.";
      toast({ title: "Erro ao salvar", description, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AppearanceFormSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Aparencia & Marca</h1>
        <p className="text-muted-foreground text-sm">Personalize a identidade visual do seu Cardapio publico</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left – Editor */}
        <div className="space-y-6">
          {/* Brand */}
          <Card>
            <CardHeader><CardTitle className="text-base">Identidade</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome do Restaurante</Label>
                <Input value={config.name} onChange={(e) => updateConfig({ name: e.target.value })} />
              </div>
              <div>
                <Label>Slug da URL</Label>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">/menu/</span>
                  <Input
                    value={config.slug}
                    onChange={(e) => updateConfig({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                    className="min-w-0"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Endereco publico: /menu/{config.slug}</p>
              </div>
              <div>
                <Label>Logo</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div
                    className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="h-11 w-full sm:h-9 sm:w-auto" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Logo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader><CardTitle className="text-base">Cores</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Cor Primaria</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <input type="color" value={config.primaryColor} onChange={(e) => updateConfig({ primaryColor: e.target.value })} className="h-10 w-10 rounded-md border border-input cursor-pointer" />
                    <Input value={config.primaryColor} onChange={(e) => updateConfig({ primaryColor: e.target.value })} className="font-mono text-sm" maxLength={7} />
                  </div>
                </div>
                <div>
                  <Label>Cor Secundaria</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <input type="color" value={config.secondaryColor} onChange={(e) => updateConfig({ secondaryColor: e.target.value })} className="h-10 w-10 rounded-md border border-input cursor-pointer" />
                    <Input value={config.secondaryColor} onChange={(e) => updateConfig({ secondaryColor: e.target.value })} className="font-mono text-sm" maxLength={7} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Font */}
          <Card>
            <CardHeader><CardTitle className="text-base">Tipografia</CardTitle></CardHeader>
            <CardContent>
              <Label>Familia de Fonte</Label>
              <Select value={config.fontFamily} onValueChange={(v) => updateConfig({ fontFamily: v as RestaurantConfig["fontFamily"] })}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(fontFamilyLabels) as RestaurantConfig["fontFamily"][]).map((key) => (
                    <SelectItem key={key} value={key}>{fontFamilyLabels[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex">
            <Button onClick={handleSave} disabled={saving} className="h-11 w-full sm:w-auto">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar alteracoes"}
            </Button>
            <Button variant="outline" asChild className="h-11 w-full sm:w-auto">
              <a href={`/menu/${config.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Menu publico
              </a>
            </Button>
            <div
              className="space-y-1"
              title={deliveryEnabled ? undefined : "Para configurar seu delivery, habilite em Configuracoes > Restaurante."}
            >
              {deliveryEnabled ? (
                <Button variant="outline" asChild className="h-11 w-full sm:w-auto">
                  <a href={`/delivery/${config.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver delivery publico
                  </a>
                </Button>
              ) : (
                <Button variant="outline" disabled aria-disabled="true" className="h-11 w-full sm:w-auto">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver delivery publico
                </Button>
              )}
              <p className="text-xs text-muted-foreground md:hidden">
                Habilite em Configuracoes &gt; Restaurante.
              </p>
            </div>
          </div>
        </div>

        {/* Right – Live Preview */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Preview ao Vivo</span>
            </div>
            <CurrentMenuPreview config={config} logoPreview={logoPreview} />
          </div>
        </div>
      </div>
    </div>
  );
};

const CurrentMenuPreview = ({ config, logoPreview }: { config: RestaurantConfig; logoPreview: string }) => {
  const font = fontFamilyMap[config.fontFamily];
  const pc = config.primaryColor;
  const sc = config.secondaryColor;
  const mutedSurface = `${sc}14`;
  const mutedBorder = `${sc}33`;

  return (
    <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[2rem] border-4 border-border bg-background shadow-xl">
      <div className="flex h-6 items-center justify-center bg-background">
        <div className="h-1.5 w-20 rounded-full bg-muted" />
      </div>
      <div className="flex min-h-[520px] h-[68vh] max-h-[640px] flex-col bg-background" style={{ fontFamily: font }}>
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2 px-3 py-3">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-border" />
            ) : (
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ring-1 ring-border"
                style={{ backgroundColor: mutedSurface, color: pc }}
              >
                {(config.name || "R").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{config.name || "Nome do Restaurante"}</p>
            </div>
            <span
              className="shrink-0 rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em]"
              style={{ borderColor: mutedBorder, backgroundColor: mutedSurface, color: pc }}
            >
              Mesa 5
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-hidden px-3 py-3">
          <div className="rounded-[20px] border border-border bg-card px-4 py-3">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cardapio da mesa</p>
              <p className="text-base font-semibold text-foreground">Escolha os itens e monte seu pedido</p>
              <p className="text-[11px] leading-5 text-muted-foreground">Abra um produto para ver detalhes, observacoes e quantidade.</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl px-3 py-2.5" style={{ backgroundColor: mutedSurface }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Itens</p>
                <p className="mt-1 text-lg font-semibold text-foreground">2</p>
              </div>
              <div className="rounded-2xl px-3 py-2.5" style={{ backgroundColor: mutedSurface }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Total</p>
                <p className="mt-1 text-lg font-semibold text-foreground">R$ 61,90</p>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {["Entradas", "Pratos", "Bebidas"].map((cat, i) => {
                const active = i === 0;
                return (
                  <span
                    key={cat}
                    className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: active ? `${pc}16` : "hsl(var(--card))",
                      borderColor: active ? `${pc}55` : mutedBorder,
                      color: active ? pc : "hsl(var(--foreground))",
                    }}
                  >
                    {cat}
                  </span>
                );
              })}
            </div>

            <div className="space-y-2.5">
              {[
                { name: "Bruschetta Caprese", desc: "Tomate e mozzarella", price: "R$ 24,90" },
                { name: "Ceviche de Peixe", desc: "Peixe marinado com limao", price: "R$ 32,00" },
                { name: "X-Burguer Especial", desc: "Blend 180g, cheddar", price: "R$ 38,90" },
              ].map((item) => (
                <div key={item.name} className="grid grid-cols-[56px_minmax(0,1fr)_auto] gap-3 rounded-[18px] border border-border bg-card p-3">
                  <div className="flex h-14 items-center justify-center rounded-xl" style={{ backgroundColor: mutedSurface }}>
                    <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{item.desc}</p>
                    <p className="mt-2 text-xs font-medium" style={{ color: pc }}>{item.price}</p>
                  </div>
                  <div className="flex items-center">
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm"
                      style={{ borderColor: `${pc}33`, backgroundColor: `${pc}10`, color: pc }}
                    >
                      +
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-background/95 px-3 py-3 backdrop-blur">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-card px-3 py-2 text-center text-[10px] font-semibold text-foreground">Menu</div>
            <div className="rounded-xl px-3 py-2 text-center text-[10px] font-semibold" style={{ backgroundColor: mutedSurface, color: pc }}>Pedidos</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearancePage;


