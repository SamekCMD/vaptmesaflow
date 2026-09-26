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
import { fetchOwnedRestaurant } from "@/lib/restaurants";
import { deleteMenuImage, uploadMenuImage } from "@/lib/menu-image-storage";
import type { MenuItemDto } from "@/lib/business-api.types";
import {
  createMenuItem,
  deleteMenuItem,
  listOwnedMenuItems,
  type MenuItemInput,
  type MenuVariationInput,
  updateMenuItem,
} from "@/lib/menu-items";
import OnboardingGuideCard from "@/components/dashboard/OnboardingGuideCard";
import {
  completeGuideModule,
  getGuideModuleHref,
  getNextGuideModule,
  GUIDE_MODULE_CONTENT,
} from "@/lib/onboarding";

type MenuItem = MenuItemDto;
type Variation = MenuVariationInput;
type MenuBadge = MenuItemInput["badge"] | "none";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Tente novamente.";
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
  const [badge, setBadge] = useState<MenuBadge>("none");
  const [isChefSuggestion, setIsChefSuggestion] = useState(false);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [newOptionInputs, setNewOptionInputs] = useState<Record<number, string>>({});
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchItems = async () => {
      if (!user) return;
      try {
        const rest = await fetchOwnedRestaurant();

        if (!rest) { setLoading(false); return; }
        setRestaurantId(rest.id);

        setItems(await listOwnedMenuItems());
      } catch (err: unknown) {
        toast({ title: "Erro ao carregar cardápio", description: errorMessage(err), variant: "destructive" });
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
      const input: MenuItemInput = {
        name: form.name,
        price: form.price,
        description: editItem?.description ?? null,
        category: form.category,
        available: editItem?.available ?? true,
        imageUrl: removeImage ? null : (editItem?.imageUrl ?? null),
        availableFrom: timeRestricted && availableFrom ? availableFrom : null,
        availableUntil: timeRestricted && availableUntil ? availableUntil : null,
        badge: badge === "none" ? null : badge,
        isChefSuggestion,
        prepTimeMinutes: prepTimeMinutes ? parseInt(prepTimeMinutes, 10) : null,
        variations,
      };
      let savedItem = editItem
        ? await updateMenuItem(editItem.id, input)
        : await createMenuItem(input);

      if (removeImage && editItem?.imageUrl) {
        try {
          await deleteMenuImage({ restaurantId, itemId: editItem.id });
        } catch (error: unknown) {
          toast({
            title: "Item salvo; limpeza da imagem pendente",
            description: errorMessage(error),
            variant: "destructive",
          });
        }
      }

      if (imageFile) {
        const resized = await resizeImage(imageFile);
        const publicUrl = await uploadMenuImage({ restaurantId, itemId: savedItem.id, image: resized });
        savedItem = await updateMenuItem(savedItem.id, { imageUrl: publicUrl });
      }

      if (editItem) {
        setItems((prev) => prev.map((i) => {
          if (i.id === editItem.id) return savedItem;
          if (savedItem.isChefSuggestion && i.isChefSuggestion) return { ...i, isChefSuggestion: false };
          return i;
        }));
        toast({ title: "Item atualizado", description: `"${form.name}" foi editado com sucesso.` });
      } else {
        setItems((prev) => {
          const updated = savedItem.isChefSuggestion
            ? prev.map(i => i.isChefSuggestion ? { ...i, isChefSuggestion: false } : i)
            : prev;
          return [savedItem, ...updated];
        });
        toast({ title: "Item adicionado", description: `"${form.name}" foi adicionado ao cardápio.` });
      }

      resetForm();
      setDialogOpen(false);
    } catch (err: unknown) {
      toast({ title: "Erro ao salvar", description: errorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditItem(item);
    setForm({ name: item.name, price: String(item.price), category: item.category });
    setImagePreview(item.imageUrl);
    setImageFile(null);
    setRemoveImage(false);
    setTimeRestricted(!!(item.availableFrom || item.availableUntil));
    setAvailableFrom(item.availableFrom || "");
    setAvailableUntil(item.availableUntil || "");
    setBadge(item.badge || "none");
    setIsChefSuggestion(item.isChefSuggestion);
    setPrepTimeMinutes(item.prepTimeMinutes ? String(item.prepTimeMinutes) : "");
    setVariations(item.variations.map(({ name, options, required }) => ({ name, options, required })));
    setNewOptionInputs({});
    setDialogOpen(true);
  };

  const handleDelete = async (item: MenuItem) => {
    try {
      if (item.imageUrl) {
        await deleteMenuImage({ restaurantId, itemId: item.id });
      }
      await deleteMenuItem(item.id);
      setItems((current) => current.filter((i) => i.id !== item.id));
      toast({ title: "Item removido", description: `"${item.name}" foi removido do cardápio.`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Erro ao remover", description: errorMessage(err), variant: "destructive" });
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
                  <Select value={badge} onValueChange={(value) => setBadge(value as MenuBadge)}>
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
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="h-10 w-10 rounded object-cover" />
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
                      {item.isChefSuggestion && <ChefHat className="h-3.5 w-3.5 text-amber-600" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.category}</TableCell>
                  <TableCell>R$ {Number(item.price).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={item.available ? "default" : "secondary"} className={item.available ? "bg-primary/10 text-primary border-0" : ""}>
                      {item.available ? "Disponível" : "Indisponível"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Editar ${item.name}`} onClick={() => handleEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Remover ${item.name}`} onClick={() => handleDelete(item)}>
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
