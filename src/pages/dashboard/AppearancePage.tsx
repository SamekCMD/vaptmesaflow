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
        <h1 className="text-xl font-semibold tracking-tight">Aparência & Marca</h1>
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
  const pc = config.primaryColor;

  return (
    <div className="w-full max-w-[320px] mx-auto rounded-[2rem] border-4 border-border bg-[#0C0C0E] shadow-xl overflow-hidden">
      {/* Phone notch */}
      <div className="h-6 bg-[#0C0C0E] flex items-center justify-center">
        <div className="w-20 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
      </div>
      <div className="h-[560px] overflow-auto relative" style={{ fontFamily: font, backgroundColor: '#0C0C0E' }}>
        {/* Fixed Header */}
        <div
          className="sticky top-0 z-10 flex items-center px-3 gap-2"
          style={{
            height: 48,
            backgroundColor: 'rgba(12,12,14,0.95)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="shrink-0 object-cover" style={{ width: 28, height: 28, borderRadius: 6 }} />
          ) : (
            <div
              className="shrink-0 flex items-center justify-center font-semibold"
              style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: pc + '33', color: pc, fontSize: 11 }}
            >
              {config.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-xs font-semibold truncate" style={{ color: '#F2F2F0' }}>
            {config.name || "Nome do Restaurante"}
          </span>
          <span
            className="ml-auto shrink-0 uppercase font-medium"
            style={{
              fontSize: 9,
              letterSpacing: '0.06em',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              padding: '2px 6px',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            Mesa 5
          </span>
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {["Entradas", "Pratos", "Bebidas"].map((cat, i) => (
            <span
              key={cat}
              className="whitespace-nowrap"
              style={{
                fontSize: 11,
                fontWeight: i === 0 ? 500 : 400,
                borderRadius: 4,
                padding: '4px 10px',
                backgroundColor: i === 0 ? pc + '26' : 'rgba(255,255,255,0.04)',
                border: i === 0 ? `1px solid ${pc}66` : '1px solid rgba(255,255,255,0.08)',
                color: i === 0 ? pc : 'rgba(255,255,255,0.45)',
              }}
            >
              {cat}
            </span>
          ))}
        </div>

        {/* 2-column grid of items */}
        <div className="grid grid-cols-2 gap-2 px-3 pt-3 pb-16">
          {[
            { name: "Bruschetta Caprese", desc: "Tomate e mozzarella", price: "R$ 24,90" },
            { name: "Ceviche de Peixe", desc: "Peixe marinado com limão", price: "R$ 32,00" },
            { name: "X-Burguer Especial", desc: "Blend 180g, cheddar", price: "R$ 38,90" },
          ].map((item) => (
            <div
              key={item.name}
              className="flex flex-col overflow-hidden"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 8,
              }}
            >
              {/* Image placeholder */}
              <div
                className="w-full flex items-center justify-center"
                style={{ aspectRatio: '4/3', backgroundColor: 'rgba(255,255,255,0.04)' }}
              >
                <UtensilsCrossed style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.15)' }} />
              </div>
              {/* Content */}
              <div style={{ padding: '6px 6px 8px' }}>
                <p className="font-medium" style={{ fontSize: 10, lineHeight: 1.3, color: 'rgba(255,255,255,0.9)' }}>
                  {item.name}
                </p>
                <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{item.desc}</p>
                <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
                  <span className="font-mono font-medium" style={{ fontSize: 10, color: pc }}>
                    {item.price}
                  </span>
                  <span
                    className="flex items-center justify-center"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      backgroundColor: pc + '26',
                      border: `1px solid ${pc}4D`,
                      color: pc,
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    +
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom nav */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-around"
          style={{
            height: 48,
            backgroundColor: 'rgba(12,12,14,0.96)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex flex-col items-center gap-0.5">
            <div className="h-4 w-4 rounded" style={{ backgroundColor: pc + '30' }} />
            <span style={{ fontSize: 8, color: pc }}>Menu</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="h-4 w-4 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Pedidos</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearancePage;
