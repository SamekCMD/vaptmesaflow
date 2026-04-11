import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  fontFamilyMap,
  hexToHsl,
  type RestaurantConfig,
  type PublicMenuItem,
  type MenuItemVariation,
} from "@/lib/restaurant-config";
import { ShoppingBag, ClipboardList, Clock, QrCode, UtensilsCrossed, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PublicMenuSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { useCart } from "@/hooks/use-cart";
import ProductDrawer from "@/components/menu/ProductDrawer";
import OrderSummaryDrawer from "@/components/menu/OrderSummaryDrawer";
import MyOrdersDrawer from "@/components/menu/MyOrdersDrawer";
import FloatingActions from "@/components/menu/FloatingActions";
import { supabase } from "@/lib/supabase";

type RestaurantPublicRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  font_family: RestaurantConfig["fontFamily"] | null;
  payment_mode: "open_tab" | "prepaid" | null;
  max_pending_orders: number | null;
};

type MenuItemRow = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  category: string | null;
  image_url: string | null;
  available: boolean;
  available_from: string | null;
  available_until: string | null;
  badge: string | null;
  is_chef_suggestion: boolean | null;
  prep_time_minutes: number | null;
};

type MenuVariationRow = {
  id: string;
  menu_item_id: string;
  name: string;
  options: unknown;
  required: boolean;
};

function isWithinTimeRange(from: string | null | undefined, until: string | null | undefined): boolean {
  if (!from && !until) return true;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const parse = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  if (from && until) {
    const f = parse(from);
    const u = parse(until);
    return f <= u ? mins >= f && mins <= u : mins >= f || mins <= u;
  }
  if (from) return mins >= parse(from);
  if (until) return mins <= parse(until);
  return true;
}

function formatTimeRange(from: string | null | undefined, until: string | null | undefined): string {
  const fmt = (t: string) => t.substring(0, 5).replace(":", "h");
  if (from && until) return `${fmt(from)} - ${fmt(until)}`;
  if (from) return `a partir de ${fmt(from)}`;
  if (until) return `até ${fmt(until)}`;
  return "";
}

const PublicMenu = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get("table") || searchParams.get("mesa") || "";

  const [restaurant, setRestaurant] = useState<RestaurantConfig | null>(null);
  const [items, setItems] = useState<PublicMenuItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<"open_tab" | "prepaid">("open_tab");
  const [maxPendingOrders, setMaxPendingOrders] = useState(3);
  const [activeCategory, setActiveCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PublicMenuItem | null>(null);
  const [productDrawerOpen, setProductDrawerOpen] = useState(false);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [myOrdersOpen, setMyOrdersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"menu" | "orders">("menu");
  const [hasReadyOrder, setHasReadyOrder] = useState(false);
  const [tableSessionId, setTableSessionId] = useState<string | null>(null);
  const [hasPlacedOrder, setHasPlacedOrder] = useState(false);
  const [restaurantIdState, setRestaurantIdState] = useState<string | null>(null);

  const cart = useCart();
  const prevItemsRef = useRef<Map<string | number, boolean>>(new Map());
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) {
        setError("URL inválida");
        setLoading(false);
        return;
      }

      try {
        const { data: restData, error: restError } = await supabase
          .from("restaurants")
          .select("id, name, slug, logo_url, primary_color, secondary_color, font_family, payment_mode, max_pending_orders")
          .eq("slug", slug)
          .single();

        if (restError || !restData) {
          setError("Restaurante não encontrado");
          setLoading(false);
          return;
        }

        const restaurantRow = restData as RestaurantPublicRow;
        const config: RestaurantConfig = {
          id: restaurantRow.id,
          name: restaurantRow.name,
          slug: restaurantRow.slug,
          logoUrl: restaurantRow.logo_url || "",
          primaryColor: restaurantRow.primary_color || "#0ea573",
          secondaryColor: restaurantRow.secondary_color || "#1e293b",
          fontFamily: restaurantRow.font_family || "modern",
          activeModules: { menu: true, kds: true, metrics: true },
        };

        setRestaurant(config);
        setRestaurantIdState(restaurantRow.id);
        setPaymentMode(restaurantRow.payment_mode || "open_tab");
        setMaxPendingOrders(restaurantRow.max_pending_orders || 3);

        const mode = restaurantRow.payment_mode || "open_tab";
        if (mode === "open_tab" && tableNumber) {
          const storedSessionId = localStorage.getItem(`table_session_${restaurantRow.id}_${tableNumber}`);
          if (storedSessionId) {
            const { data: existingSession } = await supabase
              .from("table_sessions")
              .select("id, status")
              .eq("id", storedSessionId)
              .in("status", ["open", "check_requested"])
              .single();
            if (existingSession) {
              setTableSessionId(existingSession.id);
              setHasPlacedOrder(true);
            } else {
              localStorage.removeItem(`table_session_${restaurantRow.id}_${tableNumber}`);
            }
          }

          if (!storedSessionId) {
            const { data: dbSession } = await supabase
              .from("table_sessions")
              .select("id")
              .eq("restaurant_id", restaurantRow.id)
              .eq("table_number", tableNumber)
              .in("status", ["open", "check_requested"])
              .single();
            if (dbSession) {
              setTableSessionId(dbSession.id);
              setHasPlacedOrder(true);
              localStorage.setItem(`table_session_${restaurantRow.id}_${tableNumber}`, dbSession.id);
            }
          }
        }

        const { data: menuData } = await supabase.from("menu_items").select("*").eq("restaurant_id", restaurantRow.id);
        const menuItems: PublicMenuItem[] = ((menuData || []) as MenuItemRow[]).map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description || "",
          price: Number(m.price),
          category: m.category || "Geral",
          imageUrl: m.image_url || undefined,
          available: m.available,
          availableFrom: m.available_from || null,
          availableUntil: m.available_until || null,
          badge: m.badge || null,
          isChefSuggestion: m.is_chef_suggestion || false,
          prepTimeMinutes: m.prep_time_minutes || null,
        }));

        const itemIds = menuItems.map((item) => String(item.id));
        if (itemIds.length > 0) {
          const { data: varData } = await supabase.from("menu_item_variations").select("*").in("menu_item_id", itemIds);
          if (varData) {
            const varMap: Record<string, MenuItemVariation[]> = {};
            for (const v of varData as MenuVariationRow[]) {
              if (!varMap[v.menu_item_id]) varMap[v.menu_item_id] = [];
              varMap[v.menu_item_id].push({
                id: v.id,
                name: v.name,
                options: Array.isArray(v.options) ? v.options : [],
                required: v.required,
              });
            }
            for (const item of menuItems) item.variations = varMap[item.id] || [];
          }
        }

        const map = new Map<string | number, boolean>();
        menuItems.forEach((item) => map.set(item.id, item.available));
        prevItemsRef.current = map;
        setItems(menuItems);
      } catch {
        setError("Erro ao carregar o cardápio");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug, tableNumber]);

  useEffect(() => {
    if (!restaurantIdState) return;
    const interval = setInterval(async () => {
      const { data: menuData } = await supabase.from("menu_items").select("*").eq("restaurant_id", restaurantIdState);
      if (!menuData) return;

      const newItems: PublicMenuItem[] = (menuData as MenuItemRow[]).map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description || "",
        price: Number(m.price),
        category: m.category || "Geral",
        imageUrl: m.image_url || undefined,
        available: m.available,
        availableFrom: m.available_from || null,
        availableUntil: m.available_until || null,
        badge: m.badge || null,
        isChefSuggestion: m.is_chef_suggestion || false,
        prepTimeMinutes: m.prep_time_minutes || null,
      }));

      const itemIds = newItems.map((item) => String(item.id));
      if (itemIds.length > 0) {
        const { data: varData } = await supabase.from("menu_item_variations").select("*").in("menu_item_id", itemIds);
        if (varData) {
          const varMap: Record<string, MenuItemVariation[]> = {};
          for (const v of varData as MenuVariationRow[]) {
            if (!varMap[v.menu_item_id]) varMap[v.menu_item_id] = [];
            varMap[v.menu_item_id].push({
              id: v.id,
              name: v.name,
              options: Array.isArray(v.options) ? v.options : [],
              required: v.required,
            });
          }
          for (const item of newItems) item.variations = varMap[item.id] || [];
        }
      }

      const prev = prevItemsRef.current;
      for (const item of newItems) {
        const wasAvailable = prev.get(item.id);
        if (wasAvailable === undefined) continue;
        if (wasAvailable && !item.available) {
          const inCart = cart.items.some((ci) => ci.item.id === item.id);
          toast({
            title: inCart ? "Item indisponível no pedido" : `"${item.name}" ficou indisponível`,
            description: inCart
              ? `"${item.name}" saiu do cardápio agora. Remova antes de confirmar.`
              : "Este item não está disponível no momento.",
            variant: inCart ? "destructive" : undefined,
          });
        } else if (!wasAvailable && item.available) {
          toast({
            title: `"${item.name}" voltou ao cardápio`,
            description: "Você já pode adicionar esse item ao pedido.",
          });
        }
      }

      const newMap = new Map<string | number, boolean>();
      newItems.forEach((item) => newMap.set(item.id, item.available));
      prevItemsRef.current = newMap;
      setItems(newItems);
    }, 8000);

    return () => clearInterval(interval);
  }, [restaurantIdState, cart.items]);

  const categories = useMemo(() => Array.from(new Set(items.filter((i) => i.available).map((i) => i.category))), [items]);
  const availableItems = useMemo(() => items.filter((i) => i.available), [items]);
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) setActiveCategory(categories[0]);
  }, [categories, activeCategory]);

  useEffect(() => {
    if (!restaurant) return;
    const root = document.documentElement;
    root.style.setProperty("--menu-primary", hexToHsl(restaurant.primaryColor));
    root.style.setProperty("--menu-secondary", hexToHsl(restaurant.secondaryColor));
    root.style.setProperty("--menu-font", fontFamilyMap[restaurant.fontFamily]);
    return () => {
      root.style.removeProperty("--menu-primary");
      root.style.removeProperty("--menu-secondary");
      root.style.removeProperty("--menu-font");
    };
  }, [restaurant]);

  useEffect(() => {
    if (!restaurant) return;
    const initTimer = setTimeout(() => { isInitialLoadRef.current = false; }, 3000);
    const getSessionOrderIds = (): string[] => {
      try { return JSON.parse(sessionStorage.getItem("vapt_current_order_ids") || "[]"); } catch { return []; }
    };

    const channel = supabase
      .channel(`client-orders-realtime-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        (payload) => {
        const updated = payload.new as { id: string; display_id: number; status: string };
        const currentSessionIds = getSessionOrderIds();
        if (!currentSessionIds.includes(updated.id) || isInitialLoadRef.current) return;
        if (updated.status === "ready") {
          setHasReadyOrder(true);
          toast({ title: "Pedido pronto", description: `Seu pedido #${updated.display_id} está pronto para retirada.` });
        }
      })
      .subscribe();

    return () => {
      clearTimeout(initTimer);
      supabase.removeChannel(channel);
    };
  }, [restaurant]);

  const handleSessionCreated = useCallback((sessionId: string) => {
    if (!restaurant) return;
    setTableSessionId(sessionId);
    setHasPlacedOrder(true);
    localStorage.setItem(`table_session_${restaurant.id}_${tableNumber}`, sessionId);
  }, [restaurant, tableNumber]);

  const handleOrderPlaced = useCallback((orderId: string) => {
    if (!restaurant) return;
    const key = `orders_${restaurant.id}`;
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "[]");
      stored.push(orderId);
      localStorage.setItem(key, JSON.stringify(stored));
    } catch {
      localStorage.setItem(key, JSON.stringify([orderId]));
    }
    try {
      const sessionIds = JSON.parse(sessionStorage.getItem("vapt_current_order_ids") || "[]");
      sessionIds.push(orderId);
      sessionStorage.setItem("vapt_current_order_ids", JSON.stringify(sessionIds));
    } catch {
      sessionStorage.setItem("vapt_current_order_ids", JSON.stringify([orderId]));
    }
    setHasPlacedOrder(true);
  }, [restaurant]);

  const openProduct = (item: PublicMenuItem) => {
    setSelectedItem(item);
    setProductDrawerOpen(true);
  };

  if (loading) return <PublicMenuSkeleton />;
  if (error || !restaurant) {
    return <div className="min-h-screen flex items-center justify-center bg-background px-6 text-center"><div className="space-y-2"><h1 className="text-xl font-semibold text-foreground">{error || "Restaurante não encontrado"}</h1><p className="text-sm text-muted-foreground">Verifique o endereço e tente novamente.</p></div></div>;
  }
  if (!tableNumber) {
    return <div className="min-h-screen flex items-center justify-center bg-background px-6 text-center" style={{ fontFamily: fontFamilyMap[restaurant.fontFamily] }}><div className="space-y-4"><QrCode className="mx-auto h-16 w-16 text-muted-foreground" /><h1 className="text-xl font-semibold text-foreground">Leia o QR Code da mesa</h1><p className="mx-auto max-w-xs text-sm text-muted-foreground">Para fazer seu pedido, escaneie o QR Code disponível na sua mesa.</p></div></div>;
  }

  const primaryColor = restaurant.primaryColor;
  const secondaryColor = restaurant.secondaryColor;
  const font = fontFamilyMap[restaurant.fontFamily];
  const unavailableItems = items.filter((i) => !i.available);
  const filteredAvailable = availableItems.filter((i) => i.category === activeCategory);
  const filteredUnavailable = unavailableItems.filter((i) => i.category === activeCategory);
  const filteredItems = [...filteredAvailable, ...filteredUnavailable];
  const heroTitle = hasPlacedOrder ? "Seu pedido segue com a mesa" : "Cardápio da mesa";
  const heroDescription = hasPlacedOrder
    ? "Acompanhe os pedidos em andamento e revise o carrinho quando precisar."
    : "Escolha os itens por categoria e abra cada produto para ver detalhes.";

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: font }}>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          {restaurant.logoUrl ? <img src={restaurant.logoUrl} alt={restaurant.name} className="h-11 w-11 rounded-xl object-cover ring-1 ring-border" /> : <div className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold ring-1 ring-border" style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}>{restaurant.name.substring(0, 2).toUpperCase()}</div>}
          <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mesa {tableNumber}</p><h1 className="truncate text-base font-semibold text-foreground">{restaurant.name}</h1></div>
          <Button variant="outline" className="h-11 min-w-[136px] justify-between rounded-xl border-border bg-card px-4 text-sm" onClick={() => { setActiveTab("orders"); setMyOrdersOpen(true); setHasReadyOrder(false); }}><span className="flex items-center gap-2"><ClipboardList className="h-4 w-4" />Pedidos</span>{hasReadyOrder && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />}</Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-32 pt-6 sm:px-6 lg:pb-24">
        <section className="mb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="rounded-[24px] border border-border bg-card px-5 py-5 sm:px-6"
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {paymentMode === "prepaid" ? "Pagamento por Pix" : "Conta aberta na mesa"}
                </p>
                <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">{heroTitle}</h2>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">{heroDescription}</p>
              </div>

              <div className="grid min-w-[220px] grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: `${secondaryColor}14` }}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Itens
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{cart.totalItems}</p>
                </div>
                <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: `${secondaryColor}14` }}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Total
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    R$ {cart.totalPrice.toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cardápio</p>
              <h2 className="mt-1 text-2xl font-semibold text-foreground">Escolha por categoria</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Toque no item para ver detalhes e adicionar ao pedido.
            </p>
          </div>

          <nav aria-label="Categorias do cardápio" className="sticky top-[72px] z-20 -mx-1 overflow-x-auto px-1 pb-4" style={{ scrollbarWidth: "none" }}><div className="flex gap-2">{categories.map((cat) => { const isActive = activeCategory === cat; return <button key={cat} type="button" aria-pressed={isActive} onClick={() => { setActiveCategory(cat); setActiveTab("menu"); }} className="whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-medium transition-colors" style={{ backgroundColor: isActive ? `${primaryColor}16` : "hsl(var(--card))", borderColor: isActive ? `${primaryColor}55` : "hsl(var(--border))", color: isActive ? primaryColor : "hsl(var(--foreground))" }}>{cat}</button>; })}</div></nav>

          <div className="space-y-3"><AnimatePresence mode="popLayout">{filteredItems.map((item, index) => { const inTime = isWithinTimeRange(item.availableFrom, item.availableUntil); const isAvailable = item.available && inTime; return <motion.button key={item.id} type="button" layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16, delay: index * 0.015 }} className="grid w-full gap-4 rounded-[20px] border border-border bg-card p-4 text-left transition-colors md:grid-cols-[88px_minmax(0,1fr)_auto]" onClick={() => isAvailable && openProduct(item)} disabled={!isAvailable}><div className="relative h-20 overflow-hidden rounded-xl md:h-full" style={{ backgroundColor: `${secondaryColor}14` }}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name} className={`h-full w-full object-cover ${isAvailable ? "" : "opacity-45"}`} /> : <div className="flex h-full w-full items-center justify-center"><UtensilsCrossed className="h-5 w-5 text-muted-foreground" /></div>}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className={`text-base font-semibold ${isAvailable ? "text-foreground" : "text-muted-foreground"}`}>{item.name}</h3>{item.badge && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}>{item.badge}</span>}{!isAvailable && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground" style={{ backgroundColor: `${secondaryColor}14` }}>{!item.available ? "Indisponível" : formatTimeRange(item.availableFrom, item.availableUntil)}</span>}</div>{item.description && <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.description}</p>}<div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">{item.prepTimeMinutes && <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{item.prepTimeMinutes} min</span>}<span className="mono text-base font-medium" style={{ color: isAvailable ? primaryColor : "hsl(var(--muted-foreground))" }}>R$ {item.price.toFixed(2).replace(".", ",")}</span></div></div><div className="flex items-center justify-between gap-3 md:flex-col md:items-end md:justify-center"><span className="text-sm text-muted-foreground">{isAvailable ? "Ver detalhes" : "Indisponível"}</span>{isAvailable && <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: `${primaryColor}33`, color: primaryColor, backgroundColor: `${primaryColor}10` }}><Plus className="h-4 w-4" /></span>}</div></motion.button>; })}</AnimatePresence>
            {filteredItems.length === 0 && <div className="rounded-[24px] border border-dashed border-border bg-card px-6 py-12 text-center"><p className="text-base font-medium text-foreground">Nada disponível nessa categoria agora.</p><p className="mt-2 text-sm text-muted-foreground">Troque de categoria ou fale com a equipe se quiser confirmar a disponibilidade.</p></div>}
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6"><div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><Button variant="outline" className="h-11 rounded-xl border-border bg-card text-sm font-semibold" onClick={() => { setActiveTab("orders"); setMyOrdersOpen(true); setHasReadyOrder(false); }} aria-current={activeTab === "orders" ? "page" : undefined}><ClipboardList className="mr-2 h-4 w-4" />{hasReadyOrder ? "Pedido pronto" : "Acompanhar pedidos"}</Button><Button className="h-11 rounded-xl text-sm font-semibold" style={{ backgroundColor: primaryColor }} onClick={() => setOrderDrawerOpen(true)} aria-current={activeTab === "menu" ? "page" : undefined}><ShoppingBag className="mr-2 h-4 w-4" />{cart.totalItems > 0 ? `Revisar pedido • ${cart.totalItems} ${cart.totalItems === 1 ? "item" : "itens"}` : "Montar pedido"}</Button></div></div>

      <ProductDrawer item={selectedItem} open={productDrawerOpen} onClose={() => setProductDrawerOpen(false)} onAdd={cart.addItem} primaryColor={restaurant.primaryColor} />
      <OrderSummaryDrawer
        open={orderDrawerOpen}
        onClose={() => setOrderDrawerOpen(false)}
        items={cart.items}
        totalPrice={cart.totalPrice}
        onUpdateQuantity={cart.updateQuantity}
        onRemove={cart.removeItem}
        onClearCart={cart.clearCart}
        primaryColor={restaurant.primaryColor}
        restaurantId={restaurant.id}
        tableNumber={tableNumber}
        onOrderPlaced={handleOrderPlaced}
        onSessionCreated={handleSessionCreated}
        paymentMode={paymentMode}
        maxPendingOrders={maxPendingOrders}
        tableSessionId={tableSessionId}
      />
      <MyOrdersDrawer
        open={myOrdersOpen}
        onClose={() => {
          setMyOrdersOpen(false);
          setActiveTab("menu");
        }}
        restaurantId={restaurant.id}
        primaryColor={restaurant.primaryColor}
        tableSessionId={tableSessionId}
        paymentMode={paymentMode}
      />
      {paymentMode === "open_tab" && hasPlacedOrder && tableSessionId && <FloatingActions sessionId={tableSessionId} primaryColor={restaurant.primaryColor} />}
    </div>
  );
};

export default PublicMenu;

