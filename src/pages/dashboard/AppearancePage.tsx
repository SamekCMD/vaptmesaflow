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
import { Upload, Smartphone, ExternalLink, Loader2 } from "lucide-react";
import { AppearanceFormSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const AppearancePage = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");
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
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select("*")
          .eq("owner_id", user.id)
          .single();

        if (error) throw error;
        if (data) {
          setConfig({
            id: data.id,
            name: data.name || "",
            slug: data.slug || "",
            logoUrl: data.logo_url || "",
            primaryColor: data.primary_color || "#0ea573",
            secondaryColor: data.secondary_color || "#1e293b",
            fontFamily: (data.font_family as RestaurantConfig["fontFamily"]) || "modern",
            activeModules: { menu: true, kds: true, metrics: true },
          });
          setLogoPreview(data.logo_url || "");
        }
      } catch (err: any) {
        console.error("Error fetching restaurant:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
    updateConfig({ logoUrl: url });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({
          name: config.name,
          slug: config.slug,
          primary_color: config.primaryColor,
          secondary_color: config.secondaryColor,
          font_family: config.fontFamily,
          logo_url: config.logoUrl,
        })
        .eq("owner_id", user.id);

      if (error) throw error;
      toast({ title: "Aparência salva", description: "As alterações de marca foram aplicadas." });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message || "Tente novamente.", variant: "destructive" });
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
        <h1 className="text-2xl font-bold">Aparência & Marca</h1>
        <p className="text-muted-foreground text-sm">Personalize a identidade visual do seu cardápio público</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
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
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">/menu/</span>
                  <Input value={config.slug} onChange={(e) => updateConfig({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Endereço público: /menu/{config.slug}</p>
              </div>
              <div>
                <Label>Logo</Label>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <div className="flex items-center gap-4 mt-2">
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
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cor Primária</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <input type="color" value={config.primaryColor} onChange={(e) => updateConfig({ primaryColor: e.target.value })} className="h-10 w-10 rounded-md border border-input cursor-pointer" />
                    <Input value={config.primaryColor} onChange={(e) => updateConfig({ primaryColor: e.target.value })} className="font-mono text-sm" maxLength={7} />
                  </div>
                </div>
                <div>
                  <Label>Cor Secundária</Label>
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
              <Label>Família de Fonte</Label>
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

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar Alterações"}
            </Button>
            <Button variant="outline" asChild>
              <a href={`/menu/${config.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Menu Público
              </a>
            </Button>
          </div>
        </div>

        {/* Right – Live Preview */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Preview ao Vivo</span>
            </div>
            <LivePreview config={config} logoPreview={logoPreview} />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Live Preview (phone mockup) ── */
const LivePreview = ({ config, logoPreview }: { config: RestaurantConfig; logoPreview: string }) => {
  const font = fontFamilyMap[config.fontFamily];

  return (
    <div className="w-full max-w-[320px] mx-auto rounded-[2rem] border-4 border-border bg-background shadow-xl overflow-hidden">
      <div className="h-6 bg-muted flex items-center justify-center">
        <div className="w-20 h-1.5 rounded-full bg-border" />
      </div>
      <div className="h-[560px] overflow-auto" style={{ fontFamily: font }}>
        <div className="p-4 text-center" style={{ backgroundColor: config.primaryColor }}>
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="h-12 w-12 rounded-full object-cover mx-auto mb-2 border-2 border-white/30" />
          ) : (
            <div className="h-12 w-12 rounded-full mx-auto mb-2 bg-white/20 flex items-center justify-center text-white font-bold text-lg">
              {config.name.charAt(0)}
            </div>
          )}
          <p className="text-white font-semibold text-sm">{config.name || "Nome do Restaurante"}</p>
        </div>
        <div className="flex gap-2 p-3 overflow-x-auto">
          {["Entradas", "Pratos", "Bebidas"].map((cat, i) => (
            <Badge key={cat} variant={i === 0 ? "default" : "outline"} className="whitespace-nowrap text-xs cursor-pointer" style={i === 0 ? { backgroundColor: config.primaryColor, color: "#fff" } : {}}>
              {cat}
            </Badge>
          ))}
        </div>
        <div className="px-3 space-y-2 pb-20">
          {[
            { name: "Bruschetta Caprese", desc: "Tomate e mozzarella", price: "R$ 24,90" },
            { name: "Ceviche de Peixe", desc: "Peixe marinado com limão", price: "R$ 32,00" },
            { name: "X-Burguer Especial", desc: "Blend 180g, cheddar, bacon", price: "R$ 38,90" },
          ].map((item) => (
            <div key={item.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <span className="text-sm font-bold" style={{ color: config.primaryColor }}>{item.price}</span>
            </div>
          ))}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-14 border-t border-border bg-background flex items-center justify-around px-4">
          <div className="flex flex-col items-center">
            <div className="h-5 w-5 rounded bg-muted-foreground/30" />
            <span className="text-[10px] mt-0.5" style={{ color: config.primaryColor }}>Menu</span>
          </div>
          <div className="flex flex-col items-center opacity-40">
            <div className="h-5 w-5 rounded bg-muted-foreground/20" />
            <span className="text-[10px] mt-0.5 text-muted-foreground">Pedidos</span>
          </div>
          <div className="flex flex-col items-center opacity-40">
            <div className="h-5 w-5 rounded bg-muted-foreground/20" />
            <span className="text-[10px] mt-0.5 text-muted-foreground">Suporte</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearancePage;
