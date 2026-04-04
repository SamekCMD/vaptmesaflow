import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Pencil, Trash2, Search, Loader2, Upload, X, Star, Tag, Sparkles, ChefHat } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { MenuTableSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { buildSupabaseStoragePublicUrl } from "@/lib/env";
import OnboardingGuideCard from "@/components/dashboard/OnboardingGuideCard";
import {
  completeGuideModule,
  getGuideModuleHref,
  getNextGuideModule,
  GUIDE_MODULE_CONTENT,
} from "@/lib/onboarding";

interface Variation {
  id?: string;
  name: string;
  options: string[];
  required: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
  image_url: string | null;
  available_from: string | null;
  available_until: string | null;
  badge: string | null;
  is_chef_suggestion: boolean;
  prep_time_minutes: number | null;
  variations: Variation[];
}

// --- Image resize utility ---
function resizeImage(file: File, maxSize = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxSize && height <= maxSize) {
        resolve(file);
        return;
      }
      const ratio = Math.min(maxSize / width, maxSize / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const SUPABASE_URL = "https://samuel-supabase.br8r5p.easypanel.host";

const MenuManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({ name: "", price: "", category: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  // Extended form state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [timeRestricted, setTimeRestricted] = useState(false);
  const [badge, setBadge] = useState<string>("none");
  const [isChefSuggestion, setIsChefSuggestion] = useState(false);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [newOptionInputs, setNewOptionInputs] = useState<Record<number, string>>({});
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchItems = async () => {
      if (!user) return;
      try {
        const { data: rest } = await supabase
          .from("restaurants")
          .select("id")
          .eq("owner_id", user.id)
          .single();

        if (!rest) { setLoading(false); return; }
        setRestaurantId(rest.id);

        const { data: menuData, error } = await supabase
          .from("menu_items")
          .select("*")
          .eq("restaurant_id", rest.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Fetch variations for all items
        const itemIds = (menuData || []).map((m: any) => m.id);
        let variationsMap: Record<string, Variation[]> = {};
        if (itemIds.length > 0) {
          const { data: varData } = await supabase
            .from("menu_item_variations")
            .select("*")
            .in("menu_item_id", itemIds);
          if (varData) {
            for (const v of varData) {
              if (!variationsMap[v.menu_item_id]) variationsMap[v.menu_item_id] = [];
              variationsMap[v.menu_item_id].push({
                id: v.id,
                name: v.name,
                options: Array.isArray(v.options) ? v.options : [],
                required: v.required,
              });
            }
          }
        }

        setItems(
          (menuData || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            price: Number(m.price),
            category: m.category || "Geral",
            available: m.available,
            image_url: m.image_url || null,
            available_from: m.available_from || null,
            available_until: m.available_until || null,
            badge: m.badge || null,
            is_chef_suggestion: m.is_chef_suggestion || false,
            prep_time_minutes: m.prep_time_minutes || null,
            variations: variationsMap[m.id] || [],
          }))
        );
      } catch (err: any) {
        toast({ title: "Erro ao carregar cardápio", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [user]);

  const guideMode = searchParams.get("guide") === "1";
  const guideNextModule = getNextGuideModule("menu");

  const handleGuideComplete = () => {
    completeGuideModule("menu");
    navigate(guideNextModule ? getGuideModuleHref(guideNextModule) : "/dashboard", { replace: true });
  };

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setForm({ name: "", price: "", category: "" });
    setEditItem(null);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
    setAvailableFrom("");
    setAvailableUntil("");
    setTimeRestricted(false);
    setBadge("none");
    setIsChefSuggestion(false);
    setVariations([]);
    setNewOptionInputs({});
    setPrepTimeMinutes("");
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.category || !restaurantId) return;
    setSaving(true);

    try {
      const updateData: any = {
        name: form.name,
        price: parseFloat(form.price),
        category: form.category,
        available_from: timeRestricted && availableFrom ? availableFrom : null,
        available_until: timeRestricted && availableUntil ? availableUntil : null,
        badge: badge === "none" ? null : badge,
        is_chef_suggestion: isChefSuggestion,
        prep_time_minutes: prepTimeMinutes ? parseInt(prepTimeMinutes) : null,
      };

      // If chef suggestion is on, unset others first
      if (isChefSuggestion) {
        await supabase
          .from("menu_items")
          .update({ is_chef_suggestion: false })
          .eq("restaurant_id", restaurantId)
          .neq("id", editItem?.id || "");
      }

      let itemId: string;

      if (editItem) {
        // Handle image removal
        if (removeImage && editItem.image_url) {
          const path = `${restaurantId}/${editItem.id}`;
          await supabase.storage.from("menu-images").remove([path]);
          updateData.image_url = null;
        }

        const { error } = await supabase
          .from("menu_items")
          .update(updateData)
          .eq("id", editItem.id);
        if (error) throw error;
        itemId = editItem.id;
      } else {
        const { data, error } = await supabase
          .from("menu_items")
          .insert({ restaurant_id: restaurantId, ...updateData, available: true })
          .select()
          .single();
        if (error) throw error;
        itemId = data.id;
      }

      // Handle image upload
      if (imageFile) {
        const resized = await resizeImage(imageFile);
        const path = `${restaurantId}/${itemId}`;
        const { error: upErr } = await supabase.storage
          .from("menu-images")
          .upload(path, resized, { upsert: true, contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const publicUrl = buildSupabaseStoragePublicUrl("menu-images", path);
        await supabase.from("menu_items").update({ image_url: publicUrl }).eq("id", itemId);
        updateData.image_url = publicUrl;
      }

      // Handle variations: delete existing and insert new
      await supabase.from("menu_item_variations").delete().eq("menu_item_id", itemId);
      if (variations.length > 0) {
        const validVariations = variations.filter(v => v.name.trim() && v.options.length > 0);
        if (validVariations.length > 0) {
          const { error: varErr } = await supabase.from("menu_item_variations").insert(
            validVariations.map((v) => ({
              menu_item_id: itemId,
              name: v.name,
              options: v.options,
              required: v.required,
            }))
          );
          if (varErr) throw varErr;
        }
      }

      // Refresh variations for the item
      const { data: freshVars } = await supabase
        .from("menu_item_variations")
        .select("*")
        .eq("menu_item_id", itemId);
      const itemVariations: Variation[] = (freshVars || []).map((v: any) => ({
        id: v.id, name: v.name, options: v.options, required: v.required,
      }));

      const finalItem: MenuItem = {
        id: itemId,
        name: form.name,
        price: parseFloat(form.price),
        category: form.category,
        available: editItem ? editItem.available : true,
        image_url: removeImage ? null : (imageFile ? updateData.image_url : (editItem?.image_url || null)),
        available_from: updateData.available_from,
        available_until: updateData.available_until,
        badge: updateData.badge,
        is_chef_suggestion: isChefSuggestion,
        prep_time_minutes: prepTimeMinutes ? parseInt(prepTimeMinutes) : null,
        variations: itemVariations,
      };

      if (editItem) {
        setItems((prev) => prev.map((i) => {
          if (i.id === editItem.id) return finalItem;
          if (isChefSuggestion && i.is_chef_suggestion) return { ...i, is_chef_suggestion: false };
          return i;
        }));
        toast({ title: "Item atualizado", description: `"${form.name}" foi editado com sucesso.` });
      } else {
        setItems((prev) => {
          const updated = isChefSuggestion
            ? prev.map(i => i.is_chef_suggestion ? { ...i, is_chef_suggestion: false } : i)
            : prev;
          return [finalItem, ...updated];
        });
        toast({ title: "Item adicionado", description: `"${form.name}" foi adicionado ao cardápio.` });
      }

      resetForm();
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditItem(item);
    setForm({ name: item.name, price: String(item.price), category: item.category });
    setImagePreview(item.image_url);
    setImageFile(null);
    setRemoveImage(false);
    setTimeRestricted(!!(item.available_from || item.available_until));
    setAvailableFrom(item.available_from || "");
    setAvailableUntil(item.available_until || "");
    setBadge(item.badge || "none");
    setIsChefSuggestion(item.is_chef_suggestion);
    setPrepTimeMinutes(item.prep_time_minutes ? String(item.prep_time_minutes) : "");
    setVariations(item.variations.map(v => ({ ...v })));
    setNewOptionInputs({});
    setDialogOpen(true);
  };

  const handleDelete = async (item: MenuItem) => {
    try {
      if (item.image_url) {
        await supabase.storage.from("menu-images").remove([`${restaurantId}/${item.id}`]);
      }
      const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
      if (error) throw error;
      setItems(items.filter((i) => i.id !== item.id));
      toast({ title: "Item removido", description: `"${item.name}" foi removido do cardápio.`, variant: "destructive" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 5MB", variant: "destructive" });
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Formato inválido", description: "Use JPG, PNG ou WebP", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
  };

  // Variation helpers
  const addVariation = () => setVariations([...variations, { name: "", options: [], required: true }]);
  const removeVariation = (idx: number) => {
    setVariations(variations.filter((_, i) => i !== idx));
    const inputs = { ...newOptionInputs };
    delete inputs[idx];
    setNewOptionInputs(inputs);
  };
  const updateVariationName = (idx: number, name: string) => {
    setVariations(variations.map((v, i) => i === idx ? { ...v, name } : v));
  };
  const toggleVariationRequired = (idx: number) => {
    setVariations(variations.map((v, i) => i === idx ? { ...v, required: !v.required } : v));
  };
  const addOption = (varIdx: number) => {
    const text = (newOptionInputs[varIdx] || "").trim();
    if (!text) return;
    setVariations(variations.map((v, i) =>
      i === varIdx ? { ...v, options: [...v.options, text] } : v
    ));
    setNewOptionInputs({ ...newOptionInputs, [varIdx]: "" });
  };
  const removeOption = (varIdx: number, optIdx: number) => {
    setVariations(variations.map((v, i) =>
      i === varIdx ? { ...v, options: v.options.filter((_, oi) => oi !== optIdx) } : v
    ));
  };

  const getBadgeIcon = (b: string | null) => {
    if (b === "destaque") return <Star className="h-3 w-3" />;
    if (b === "promocao") return <Tag className="h-3 w-3" />;
    if (b === "novo") return <Sparkles className="h-3 w-3" />;
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Cardápio</h1>
          <p className="text-muted-foreground text-sm">Carregando itens...</p>
        </div>
        <MenuTableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {guideMode && (
        <OnboardingGuideCard
          module="menu"
          title={GUIDE_MODULE_CONTENT.menu.title}
          description={GUIDE_MODULE_CONTENT.menu.description}
          nextHref={guideNextModule ? getGuideModuleHref(guideNextModule) : null}
          onComplete={handleGuideComplete}
        />
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Cardápio</h1>
          <p className="text-muted-foreground text-sm">{items.length} itens cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0 flex flex-col">
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle>{editItem ? "Editar Item" : "Novo Item"}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1">
              <div className="space-y-4 px-6 py-5">
                {/* Image Upload */}
                <div>
                  <Label>Imagem do Prato</Label>
                  <div className="mt-1.5">
                    {imagePreview && !removeImage ? (
                      <div className="relative w-full h-40 rounded-lg overflow-hidden bg-muted">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => { setRemoveImage(true); setImageFile(null); setImagePreview(null); }}
                          className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:opacity-90"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      >
                        <Upload className="h-5 w-5" />
                        <span className="text-xs">JPG, PNG ou WebP (máx 5MB)</span>
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Name / Price / Category */}
                <div>
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: X-Burguer" />
                </div>
                <div>
                  <Label>Preço (R$)</Label>
                  <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Hambúrgueres" />
                </div>

                {/* Prep Time */}
                <div>
                  <Label>Tempo de preparo (minutos)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={prepTimeMinutes}
                    onChange={(e) => setPrepTimeMinutes(e.target.value)}
                    placeholder="Ex: 15"
                  />
                </div>

                {/* Badge */}
                <div>
                  <Label>Badge</Label>
                  <Select value={badge} onValueChange={setBadge}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="destaque">⭐ Destaque</SelectItem>
                      <SelectItem value="promocao">🏷️ Promoção</SelectItem>
                      <SelectItem value="novo">✨ Novo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Chef Suggestion */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-4 w-4 text-muted-foreground" />
                    <Label className="mb-0">Sugestão do Chef</Label>
                  </div>
                  <Switch checked={isChefSuggestion} onCheckedChange={setIsChefSuggestion} />
                </div>

                {/* Time Restriction */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="mb-0">Restringir horário</Label>
                    <Switch checked={timeRestricted} onCheckedChange={(c) => { setTimeRestricted(c); if (!c) { setAvailableFrom(""); setAvailableUntil(""); } }} />
                  </div>
                  {timeRestricted && (
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Label className="text-xs">De</Label>
                        <Input type="time" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Até</Label>
                        <Input type="time" value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Variations */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="mb-0">Variações</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addVariation}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                    </Button>
                  </div>
                  {variations.map((v, idx) => (
                    <Card key={idx} className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={v.name}
                          onChange={(e) => updateVariationName(idx, e.target.value)}
                          placeholder="Ex: Ponto da Carne"
                          className="flex-1 h-8 text-sm"
                        />
                        <button type="button" onClick={() => removeVariation(idx)} className="text-destructive hover:opacity-70">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={newOptionInputs[idx] || ""}
                          onChange={(e) => setNewOptionInputs({ ...newOptionInputs, [idx]: e.target.value })}
                          placeholder="Adicionar opção..."
                          className="flex-1 h-8 text-sm"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(idx); } }}
                        />
                        <Button type="button" variant="secondary" size="sm" className="h-8" onClick={() => addOption(idx)}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {v.options.map((opt, oi) => (
                          <span key={oi} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
                            {opt}
                            <button type="button" onClick={() => removeOption(idx, oi)} className="hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={v.required} onCheckedChange={() => toggleVariationRequired(idx)} />
                        <span className="text-xs text-muted-foreground">{v.required ? "Obrigatório" : "Opcional"}</span>
                      </div>
                    </Card>
                  ))}
                </div>

                <Button onClick={handleSave} className="w-full" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar itens..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">—</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      {item.badge && (
                        <span className="inline-flex items-center gap-0.5 text-[10px]">
                          {getBadgeIcon(item.badge)}
                        </span>
                      )}
                      {item.is_chef_suggestion && <ChefHat className="h-3.5 w-3.5 text-amber-600" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.category}</TableCell>
                  <TableCell>R$ {item.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={item.available ? "default" : "secondary"} className={item.available ? "bg-primary/10 text-primary border-0" : ""}>
                      {item.available ? "Disponível" : "Indisponível"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum item encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MenuManagement;
