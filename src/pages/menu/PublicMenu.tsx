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
import { ShoppingBag, Menu, ClipboardList, Moon, Sun, QrCode, BellRing, Star, Tag, Sparkles, Clock, ChefHat } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { PublicMenuSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { useCart } from "@/hooks/use-cart";
import ProductDrawer from "@/components/menu/ProductDrawer";
import OrderSummaryDrawer from "@/components/menu/OrderSummaryDrawer";
import MyOrdersDrawer from "@/components/menu/MyOrdersDrawer";
import FloatingActions from "@/components/menu/FloatingActions";
import OrderRatingModal from "@/components/menu/OrderRatingModal";
import { supabase } from "@/integrations/supabase/client";

function isWithinTimeRange(from: string | null | undefined, until: string | null | undefined): boolean {
  if (!from && !until) return true;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const parse = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  if (from && until) {
    const f = parse(from), u = parse(until);
    return f <= u ? mins >= f && mins <= u : mins >= f || mins <= u;
  }
  if (from) return mins >= parse(from);
  if (until) return mins <= parse(until);
  return true;
}

function formatTimeRange(from: string | null | undefined, until: string | null | undefined): string {
  const fmt = (t: string) => t.substring(0, 5).replace(":", "h");
  if (from && until) return `${fmt(from)}–${fmt(until)}`;
  if (from) return `a partir de ${fmt(from)}`;
  if (until) return `até ${fmt(until)}`;
  return "";
}

const badgeConfig: Record<string, { label: string; icon: React.ReactNode; bgClass: string; textClass: string }> = {
  destaque: { label: "Destaque", icon: <Star className="h-3 w-3" />, bgClass: "bg-amber-100", textClass: "text-amber-800" },
  promocao: { label: "Promoção", icon: <Tag className="h-3 w-3" />, bgClass: "bg-red-100", textClass: "text-red-700" },
  novo: { label: "Novo", icon: <Sparkles className="h-3 w-3" />, bgClass: "bg-emerald-100", textClass: "text-emerald-700" },
};

const PublicMenu = () => {
  const { theme, setTheme } = useTheme();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get("table") || searchParams.get("mesa") || "";

  const [restaurant, setRestaurant] = useState<RestaurantConfig | null>(null);
  const [items, setItems] = useState<PublicMenuItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<"open_tab" | "prepaid">("open_tab");
  const [maxPendingOrders, setMaxPendingOrders] = useState(3);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cart = useCart();
  const [selectedItem, setSelectedItem] = useState<PublicMenuItem | null>(null);
  const [productDrawerOpen, setProductDrawerOpen] = useState(false);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [myOrdersOpen, setMyOrdersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"menu" | "orders" | "theme">("menu");
  const [hasReadyOrder, setHasReadyOrder] = useState(false);
  const [tableSessionId, setTableSessionId] = useState<string | null>(null);
  const [hasPlacedOrder, setHasPlacedOrder] = useState(false);
  const [restaurantIdState, setRestaurantIdState] = useState<string | null>(null);

  // 4.4 — Rating state
  const [ratingOrder, setRatingOrder] = useState<{ id: string; displayId: number } | null>(null);

  // 4.5 — Previous items ref for availability comparison
  const prevItemsRef = useRef<Map<string | number, boolean>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) { setError("URL inválida"); setLoading(false); return; }
      try {
        const { data: restData, error: restError } = await supabase
          .from("restaurants")
          .select("id, name, slug, logo_url, primary_color, secondary_color, font_family, payment_mode, max_pending_orders")
          .eq("slug", slug)
          .single();

        if (restError || !restData) { setError("Restaurante não encontrado"); setLoading(false); return; }

        const config: RestaurantConfig = {
          id: restData.id,
          name: restData.name,
          slug: restData.slug,
          logoUrl: restData.logo_url || "",
          primaryColor: restData.primary_color || "#0ea573",
          secondaryColor: restData.secondary_color || "#1e293b",
          fontFamily: (restData.font_family as RestaurantConfig["fontFamily"]) || "modern",
          activeModules: { menu: true, kds: true, metrics: true },
        };
        setRestaurant(config);
        setRestaurantIdState(restData.id);
        setPaymentMode((restData as any).payment_mode || "open_tab");
        setMaxPendingOrders((restData as any).max_pending_orders || 3);

        // Check for existing table session
        const mode = (restData as any).payment_mode || "open_tab";
        const table = searchParams.get("table") || searchParams.get("mesa") || "";
        if (mode === "open_tab" && table) {
          const storedSessionId = localStorage.getItem(`table_session_${restData.id}_${table}`);
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
              localStorage.removeItem(`table_session_${restData.id}_${table}`);
            }
          }
          if (!storedSessionId) {
            const { data: dbSession } = await supabase
              .from("table_sessions")
              .select("id")
              .eq("restaurant_id", restData.id)
              .eq("table_number", table)
              .in("status", ["open", "check_requested"])
              .single();
            if (dbSession) {
              setTableSessionId(dbSession.id);
              setHasPlacedOrder(true);
              localStorage.setItem(`table_session_${restData.id}_${table}`, dbSession.id);
            }
          }
        }

        // Fetch menu items
        const { data: menuData } = await supabase
          .from("menu_items")
          .select("*")
          .eq("restaurant_id", restData.id);

        const menuItems: PublicMenuItem[] = (menuData || []).map((m: any) => ({
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

        // Fetch variations
        const itemIds = menuItems.map(i => i.id);
        if (itemIds.length > 0) {
          const { data: varData } = await supabase
            .from("menu_item_variations")
            .select("*")
            .in("menu_item_id", itemIds);
          if (varData) {
            const varMap: Record<string, MenuItemVariation[]> = {};
            for (const v of varData) {
              if (!varMap[v.menu_item_id]) varMap[v.menu_item_id] = [];
              varMap[v.menu_item_id].push({
                id: v.id, name: v.name,
                options: Array.isArray(v.options) ? v.options : [],
                required: v.required,
              });
            }
            for (const item of menuItems) {
              item.variations = varMap[item.id] || [];
            }
          }
        }

        // Initialize prev items ref
        const map = new Map<string | number, boolean>();
        menuItems.forEach(i => map.set(i.id, i.available));
        prevItemsRef.current = map;

        setItems(menuItems);
      } catch {
        setError("Erro ao carregar o cardápio");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug]);

  // 4.5 — Polling for availability changes every 5s
  useEffect(() => {
    if (!restaurantIdState) return;
    const interval = setInterval(async () => {
      const { data: menuData } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurantIdState);

      if (!menuData) return;

      const newItems: PublicMenuItem[] = menuData.map((m: any) => ({
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

      // Fetch variations
      const itemIds = newItems.map(i => i.id);
      if (itemIds.length > 0) {
        const { data: varData } = await supabase
          .from("menu_item_variations")
          .select("*")
          .in("menu_item_id", itemIds);
        if (varData) {
          const varMap: Record<string, MenuItemVariation[]> = {};
          for (const v of varData) {
            if (!varMap[v.menu_item_id]) varMap[v.menu_item_id] = [];
            varMap[v.menu_item_id].push({
              id: v.id, name: v.name,
              options: Array.isArray(v.options) ? v.options : [],
              required: v.required,
            });
          }
          for (const item of newItems) {
            item.variations = varMap[item.id] || [];
          }
        }
      }

      // Compare availability with previous state
      const prev = prevItemsRef.current;
      for (const item of newItems) {
        const wasAvailable = prev.get(item.id);
        if (wasAvailable === undefined) continue;

        if (wasAvailable && !item.available) {
          // Item became unavailable
          const inCart = cart.items.some(ci => ci.item.id === item.id);
          if (inCart) {
            toast({
              title: "⚠️ Item indisponível no carrinho",
              description: `"${item.name}" ficou indisponível. Remova-o antes de confirmar o pedido.`,
              variant: "destructive",
            });
          } else {
            toast({
              title: `"${item.name}" ficou indisponível`,
              description: "Este item não está mais disponível no momento.",
            });
          }
        } else if (!wasAvailable && item.available) {
          // Item became available again
          toast({
            title: `✅ "${item.name}" disponível novamente!`,
            description: "Você já pode adicionar ao pedido.",
          });
        }
      }

      // Update ref
      const newMap = new Map<string | number, boolean>();
      newItems.forEach(i => newMap.set(i.id, i.available));
      prevItemsRef.current = newMap;

      setItems(newItems);
    }, 5000);

    return () => clearInterval(interval);
  }, [restaurantIdState, cart.items]);

  // 4.4 — Polling for delivered orders to trigger rating
  useEffect(() => {
    if (!restaurantIdState) return;
    const interval = setInterval(async () => {
      const key = `orders_${restaurantIdState}`;
      let ids: string[] = [];
      try { ids = JSON.parse(localStorage.getItem(key) || "[]"); } catch { /* empty */ }
      if (ids.length === 0) return;

      const { data } = await supabase
        .from("orders")
        .select("id, display_id, status")
        .in("id", ids)
        .eq("status", "delivered");

      if (!data || data.length === 0) return;

      const ratedKey = "rated_orders";
      const rated: string[] = JSON.parse(sessionStorage.getItem(ratedKey) || "[]");

      for (const order of data) {
        if (!rated.includes(order.id) && !ratingOrder) {
          setRatingOrder({ id: order.id, displayId: order.display_id });
          break;
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [restaurantIdState, ratingOrder]);

  const categories = useMemo(() => Array.from(new Set(items.filter(i => i.available).map((i) => i.category))), [items]);

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
    const key = `orders_${restaurant.id}`;
    const getIds = (): string[] => {
      try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
    };
    const ids = getIds();
    if (ids.length === 0) return;
    const channel = supabase
      .channel("client-orders-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const updated = payload.new as any;
        if (!getIds().includes(updated.id)) return;
        if (updated.status === "ready") {
          setHasReadyOrder(true);
          toast({ title: "🎉 Pedido pronto!", description: `Seu pedido #${updated.display_id} está pronto para retirada!` });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
    setHasPlacedOrder(true);
  }, [restaurant]);

  if (loading) return <PublicMenuSkeleton />;

  if (error || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">{error || "Restaurante não encontrado"}</h1>
          <p className="text-muted-foreground text-sm">Verifique o endereço e tente novamente.</p>
        </div>
      </div>
    );
  }

  if (!tableNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" style={{ fontFamily: fontFamilyMap[restaurant.fontFamily] }}>
        <div className="text-center space-y-4 px-6">
          <QrCode className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-bold">Leia o QR Code da mesa</h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">Para fazer seu pedido, escaneie o QR Code disponível na sua mesa.</p>
        </div>
      </div>
    );
  }

  const chefSuggestion = items.find(i => i.isChefSuggestion && i.available);
  const availableItems = items.filter(i => i.available);
  const filteredItems = availableItems.filter((i) => i.category === activeCategory);
  const font = fontFamilyMap[restaurant.fontFamily];

  const openProduct = (item: PublicMenuItem) => {
    setSelectedItem(item);
    setProductDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: font }}>
      {/* Header */}
      <header className="py-6 px-4 text-center" style={{ backgroundColor: restaurant.primaryColor }}>
        <div className="max-w-md mx-auto">
          {restaurant.logoUrl ? (
            <img src={restaurant.logoUrl} alt={restaurant.name} className="h-16 w-16 rounded-full mx-auto mb-3 object-cover border-2 border-white/30" />
          ) : (
            <div className="h-16 w-16 rounded-full mx-auto mb-3 bg-white/20 flex items-center justify-center text-white font-bold text-2xl">
              {restaurant.name.charAt(0)}
            </div>
          )}
          <h1 className="text-white text-xl font-bold">{restaurant.name}</h1>
          <p className="text-white/70 text-sm mt-1">Mesa {tableNumber}</p>
        </div>
      </header>

      {/* Chef Suggestion */}
      {chefSuggestion && (
        <section className="max-w-md mx-auto px-4 pt-4">
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: restaurant.primaryColor + "15" }}
          >
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <ChefHat className="h-5 w-5" style={{ color: restaurant.primaryColor }} />
                <h2 className="font-bold text-sm" style={{ color: restaurant.primaryColor }}>Sugestão do Chef</h2>
              </div>
              <div className="flex gap-3">
                {chefSuggestion.imageUrl && (
                  <img src={chefSuggestion.imageUrl} alt={chefSuggestion.name} className="w-24 h-24 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{chefSuggestion.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{chefSuggestion.description}</p>
                  <p className="text-sm font-bold mt-1.5" style={{ color: restaurant.primaryColor }}>
                    R$ {chefSuggestion.price.toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="w-full mt-3 h-9 text-xs"
                style={{ backgroundColor: restaurant.primaryColor }}
                onClick={() => openProduct(chefSuggestion)}
              >
                Pedir Agora
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Category Navigation */}
      <nav className="sticky top-0 z-10 bg-background border-b" style={{ borderColor: restaurant.secondaryColor + "33" }}>
        <div className="max-w-md mx-auto flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
              style={
                activeCategory === cat
                  ? { backgroundColor: restaurant.primaryColor, color: "#fff" }
                  : { backgroundColor: restaurant.secondaryColor + "15", color: restaurant.secondaryColor }
              }
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>

      {/* Menu Items */}
      <main className="max-w-md mx-auto px-4 py-4 pb-32 space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredItems.map((item, index) => {
            const inTime = isWithinTimeRange(item.availableFrom, item.availableUntil);
            const hasTimeLimit = !!(item.availableFrom || item.availableUntil);
            const itemBadge = item.badge && badgeConfig[item.badge] ? badgeConfig[item.badge] : null;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, delay: index * 0.05 }}
                className={`relative flex gap-3 p-4 rounded-xl bg-card cursor-pointer hover:shadow-md transition-all active:scale-[0.98] ${!inTime ? "opacity-60" : ""}`}
                style={{ border: `1px solid ${restaurant.secondaryColor}20` }}
                onClick={() => inTime && openProduct(item)}
              >
                {/* Badge */}
                {itemBadge && (
                  <span className={`absolute top-2 left-2 z-[1] inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${itemBadge.bgClass} ${itemBadge.textClass}`}>
                    {itemBadge.icon} {itemBadge.label}
                  </span>
                )}

                {/* Image */}
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.name} className="w-20 h-20 rounded-lg object-cover shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{item.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                  <p className="text-sm font-bold mt-2" style={{ color: restaurant.primaryColor }}>
                    R$ {item.price.toFixed(2).replace(".", ",")}
                  </p>
                  {/* Prep time on card */}
                  {item.prepTimeMinutes && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" /> ~{item.prepTimeMinutes} min
                    </span>
                  )}
                </div>

                {inTime ? (
                  <Button
                    size="sm"
                    className="self-end shrink-0 h-8 text-xs transition-transform active:scale-90"
                    style={{ backgroundColor: restaurant.primaryColor }}
                    onClick={(e) => { e.stopPropagation(); openProduct(item); }}
                  >
                    Adicionar
                  </Button>
                ) : (
                  <div className="self-end shrink-0 text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full">
                      <Clock className="h-3 w-3" />
                      {formatTimeRange(item.availableFrom, item.availableUntil)}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filteredItems.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">Nenhum item disponível nesta categoria.</p>
        )}
      </main>

      {/* Floating "Ver Pedido" button */}
      {cart.totalItems > 0 && (
        <div className="fixed bottom-16 inset-x-0 z-20 px-4 pb-2">
          <div className="max-w-md mx-auto">
            <Button
              className="w-full h-12 text-sm font-semibold shadow-lg flex items-center justify-between px-5"
              style={{ backgroundColor: restaurant.primaryColor }}
              onClick={() => setOrderDrawerOpen(true)}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Ver Pedido ({cart.totalItems} {cart.totalItems === 1 ? "item" : "itens"})
              </span>
              <span>R$ {cart.totalPrice.toFixed(2).replace(".", ",")}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-background border-t" style={{ borderColor: restaurant.secondaryColor + "33" }}>
        <div className="max-w-md mx-auto flex items-center justify-around h-14">
          <button className="flex flex-col items-center gap-0.5" onClick={() => setActiveTab("menu")}>
            <Menu className="h-5 w-5" style={{ color: activeTab === "menu" ? restaurant.primaryColor : restaurant.secondaryColor + "80" }} />
            <span className="text-[10px] font-medium" style={{ color: activeTab === "menu" ? restaurant.primaryColor : restaurant.secondaryColor + "80" }}>Menu</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 relative" onClick={() => { setActiveTab("orders"); setMyOrdersOpen(true); setHasReadyOrder(false); }}>
            {hasReadyOrder && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 animate-ping" />}
            {hasReadyOrder ? (
              <BellRing className="h-5 w-5 animate-bounce" style={{ color: restaurant.primaryColor }} />
            ) : (
              <ClipboardList className="h-5 w-5" style={{ color: activeTab === "orders" ? restaurant.primaryColor : restaurant.secondaryColor + "80" }} />
            )}
            <span className="text-[10px]" style={{ color: hasReadyOrder ? restaurant.primaryColor : (activeTab === "orders" ? restaurant.primaryColor : restaurant.secondaryColor + "80") }}>Meus Pedidos</span>
          </button>
          <button className="flex flex-col items-center gap-0.5" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="h-5 w-5" style={{ color: restaurant.secondaryColor + "80" }} /> : <Moon className="h-5 w-5" style={{ color: restaurant.secondaryColor + "80" }} />}
            <span className="text-[10px]" style={{ color: restaurant.secondaryColor + "80" }}>Tema</span>
          </button>
        </div>
      </nav>

      {/* Drawers */}
      <ProductDrawer
        item={selectedItem}
        open={productDrawerOpen}
        onClose={() => setProductDrawerOpen(false)}
        onAdd={cart.addItem}
        primaryColor={restaurant.primaryColor}
      />
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
        onClose={() => { setMyOrdersOpen(false); setActiveTab("menu"); }}
        restaurantId={restaurant.id}
        primaryColor={restaurant.primaryColor}
        tableSessionId={tableSessionId}
        paymentMode={paymentMode}
      />

      {/* 4.4 — Rating Modal */}
      {ratingOrder && (
        <OrderRatingModal
          open={!!ratingOrder}
          onClose={() => setRatingOrder(null)}
          orderId={ratingOrder.id}
          displayId={ratingOrder.displayId}
          restaurantId={restaurant.id}
          primaryColor={restaurant.primaryColor}
        />
      )}

      {paymentMode === "open_tab" && hasPlacedOrder && tableSessionId && (
        <FloatingActions sessionId={tableSessionId} primaryColor={restaurant.primaryColor} />
      )}
    </div>
  );
};

export default PublicMenu;
