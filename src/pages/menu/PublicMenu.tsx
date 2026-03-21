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
import { ShoppingBag, Menu, ClipboardList, BellRing, Clock, QrCode, UtensilsCrossed, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
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

const PublicMenu = () => {
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
  const [activeTab, setActiveTab] = useState<"menu" | "orders">("menu");
  const [hasReadyOrder, setHasReadyOrder] = useState(false);
  const [tableSessionId, setTableSessionId] = useState<string | null>(null);
  const [hasPlacedOrder, setHasPlacedOrder] = useState(false);
  const [restaurantIdState, setRestaurantIdState] = useState<string | null>(null);

  const [ratingOrder, setRatingOrder] = useState<{ id: string; displayId: number } | null>(null);
  const prevItemsRef = useRef<Map<string | number, boolean>>(new Map());
  const isInitialLoadRef = useRef(true);

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

      const prev = prevItemsRef.current;
      for (const item of newItems) {
        const wasAvailable = prev.get(item.id);
        if (wasAvailable === undefined) continue;

        if (wasAvailable && !item.available) {
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
          toast({
            title: `✅ "${item.name}" disponível novamente!`,
            description: "Você já pode adicionar ao pedido.",
          });
        }
      }

      const newMap = new Map<string | number, boolean>();
      newItems.forEach(i => newMap.set(i.id, i.available));
      prevItemsRef.current = newMap;

      setItems(newItems);
    }, 5000);

    return () => clearInterval(interval);
  }, [restaurantIdState, cart.items]);

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
    // Mark initial load complete after a short delay so we skip stale events
    const initTimer = setTimeout(() => { isInitialLoadRef.current = false; }, 3000);
    const getSessionOrderIds = (): string[] => {
      try { return JSON.parse(sessionStorage.getItem('vapt_current_order_ids') || "[]"); } catch { return []; }
    };
    const sessionIds = getSessionOrderIds();
    if (sessionIds.length === 0) {
      // Still subscribe in case orders are placed later this session
    }
    const channel = supabase
      .channel("client-orders-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const updated = payload.new as any;
        const currentSessionIds = getSessionOrderIds();
        if (!currentSessionIds.includes(updated.id)) return;
        if (isInitialLoadRef.current) return;
        if (updated.status === "ready") {
          setHasReadyOrder(true);
          toast({ title: "🎉 Pedido pronto!", description: `Seu pedido #${updated.display_id} está pronto para retirada!` });
        }
      })
      .subscribe();
    return () => { clearTimeout(initTimer); supabase.removeChannel(channel); };
  }, [restaurant]);

  const handleSessionCreated = useCallback((sessionId: string) => {
    if (!restaurant) return;
    setTableSessionId(sessionId);
    setHasPlacedOrder(true);
    localStorage.setItem(`table_session_${restaurant.id}_${tableNumber}`, sessionId);
  }, [restaurant, tableNumber]);

  const handleOrderPlaced = useCallback((orderId: string) => {
    if (!restaurant) return;
    // Save to localStorage (for rating/history)
    const key = `orders_${restaurant.id}`;
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "[]");
      stored.push(orderId);
      localStorage.setItem(key, JSON.stringify(stored));
    } catch {
      localStorage.setItem(key, JSON.stringify([orderId]));
    }
    // Save to sessionStorage (for current-session toast filtering)
    try {
      const sessionIds = JSON.parse(sessionStorage.getItem('vapt_current_order_ids') || "[]");
      sessionIds.push(orderId);
      sessionStorage.setItem('vapt_current_order_ids', JSON.stringify(sessionIds));
    } catch {
      sessionStorage.setItem('vapt_current_order_ids', JSON.stringify([orderId]));
    }
    setHasPlacedOrder(true);
  }, [restaurant]);

  if (loading) return <PublicMenuSkeleton />;

  if (error || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0C0C0E' }}>
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold" style={{ color: '#F2F2F0' }}>{error || "Restaurante não encontrado"}</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Verifique o endereço e tente novamente.</p>
        </div>
      </div>
    );
  }

  if (!tableNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0C0C0E', fontFamily: fontFamilyMap[restaurant.fontFamily] }}>
        <div className="text-center space-y-4 px-6">
          <QrCode className="h-16 w-16 mx-auto" style={{ color: 'rgba(255,255,255,0.3)' }} />
          <h1 className="text-xl font-semibold" style={{ color: '#F2F2F0' }}>Leia o QR Code da mesa</h1>
          <p className="text-sm max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>Para fazer seu pedido, escaneie o QR Code disponível na sua mesa.</p>
        </div>
      </div>
    );
  }

  const primaryColor = restaurant.primaryColor;
  const availableItems = items.filter(i => i.available);
  const unavailableItems = items.filter(i => !i.available);
  const filteredAvailable = availableItems.filter((i) => i.category === activeCategory);
  const filteredUnavailable = unavailableItems.filter((i) => i.category === activeCategory);
  const filteredItems = [...filteredAvailable, ...filteredUnavailable];
  const font = fontFamilyMap[restaurant.fontFamily];

  const openProduct = (item: PublicMenuItem) => {
    setSelectedItem(item);
    setProductDrawerOpen(true);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0C0C0E', fontFamily: font }}>
      {/* Fixed Header */}
      <header
        className="fixed top-0 inset-x-0 z-30 flex items-center px-4"
        style={{
          height: 60,
          backgroundColor: 'rgba(12,12,14,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 max-w-md mx-auto w-full">
          {/* Logo */}
          {restaurant.logoUrl ? (
            <img
              src={restaurant.logoUrl}
              alt={restaurant.name}
              className="shrink-0 object-cover"
              style={{ width: 36, height: 36, borderRadius: 8 }}
            />
          ) : (
            <div
              className="shrink-0 flex items-center justify-center font-semibold text-sm"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: primaryColor + '33',
                color: primaryColor,
              }}
            >
              {restaurant.name.substring(0, 2).toUpperCase()}
            </div>
          )}

          {/* Name */}
          <span className="text-sm font-semibold truncate" style={{ color: '#F2F2F0' }}>
            {restaurant.name}
          </span>

          {/* Mesa Badge */}
          <span
            className="ml-auto shrink-0 uppercase font-medium"
            style={{
              fontSize: 11,
              letterSpacing: '0.06em',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              padding: '4px 10px',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            Mesa {tableNumber}
          </span>
        </div>
      </header>

      {/* Category Navigation — sticky below header */}
      <nav
        className="sticky z-20 overflow-x-auto"
        style={{
          top: 60,
          backgroundColor: '#0C0C0E',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          scrollbarWidth: 'none',
        }}
      >
        <div className="flex gap-2 px-4 max-w-md mx-auto" style={{ padding: '10px 16px' }}>
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="whitespace-nowrap"
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 500 : 400,
                  borderRadius: 6,
                  padding: '6px 14px',
                  transition: 'all 120ms ease',
                  backgroundColor: isActive ? primaryColor + '26' : 'rgba(255,255,255,0.04)',
                  border: isActive ? `1px solid ${primaryColor}66` : '1px solid rgba(255,255,255,0.08)',
                  color: isActive ? primaryColor : 'rgba(255,255,255,0.45)',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Spacer for fixed header */}
      <div style={{ height: 60 }} />

      {/* Menu Items — 2-column grid */}
      <main className="max-w-md mx-auto px-4 pt-4" style={{ paddingBottom: 100 }}>
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, index) => {
              const inTime = isWithinTimeRange(item.availableFrom, item.availableUntil);
              const isAvailable = item.available && inTime;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className="flex flex-col overflow-hidden cursor-pointer"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 10,
                    transition: 'border-color 120ms ease, background 120ms ease',
                  }}
                  onClick={() => isAvailable && openProduct(item)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                  }}
                >
                  {/* Image */}
                  <div className="relative" style={{ aspectRatio: '4/3' }}>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        style={{ opacity: isAvailable ? 1 : 0.4 }}
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                      >
                        <UtensilsCrossed style={{ width: 24, height: 24, color: 'rgba(255,255,255,0.15)' }} />
                      </div>
                    )}

                    {/* Unavailable overlay */}
                    {!isAvailable && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <span
                          className="uppercase font-medium"
                          style={{
                            fontSize: 10,
                            letterSpacing: '0.05em',
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            color: 'rgba(255,255,255,0.4)',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        >
                          {!item.available ? 'Indisponível' : formatTimeRange(item.availableFrom, item.availableUntil)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: '10px 10px 12px' }}>
                    <h3
                      className="font-medium"
                      style={{
                        fontSize: 13,
                        lineHeight: 1.3,
                        color: isAvailable ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {item.name}
                    </h3>

                    {item.description && (
                      <p
                        style={{
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.35)',
                          marginTop: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.description}
                      </p>
                    )}

                    {/* Price + Add button row */}
                    <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                      <span
                        className="font-mono font-medium"
                        style={{
                          fontSize: 14,
                          color: isAvailable ? primaryColor : 'rgba(255,255,255,0.4)',
                        }}
                      >
                        R$ {item.price.toFixed(2).replace(".", ",")}
                      </span>

                      {isAvailable && (
                        <button
                          className="flex items-center justify-center"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            backgroundColor: primaryColor + '26',
                            border: `1px solid ${primaryColor}4D`,
                            color: primaryColor,
                            fontSize: 18,
                            lineHeight: 1,
                            transition: 'background 120ms ease',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openProduct(item);
                          }}
                        >
                          <Plus style={{ width: 16, height: 16 }} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filteredItems.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Nenhum item disponível nesta categoria.
          </p>
        )}
      </main>

      {/* Floating "Ver Pedido" button */}
      {cart.totalItems > 0 && (
        <div className="fixed inset-x-0 z-20 px-4 pb-2" style={{ bottom: 64 }}>
          <div className="max-w-md mx-auto">
            <Button
              className="w-full h-12 text-sm font-semibold flex items-center justify-between px-5"
              style={{
                backgroundColor: primaryColor,
                color: '#000',
                borderRadius: 10,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
              onClick={() => setOrderDrawerOpen(true)}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Ver Pedido ({cart.totalItems} {cart.totalItems === 1 ? "item" : "itens"})
              </span>
              <span className="font-mono">R$ {cart.totalPrice.toFixed(2).replace(".", ",")}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 inset-x-0 z-20 flex"
        style={{
          height: 64,
          backgroundColor: 'rgba(12,12,14,0.96)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="max-w-md mx-auto flex items-center w-full">
          {/* Menu tab */}
          <button
            className="flex-1 flex flex-col items-center justify-center gap-1 relative"
            onClick={() => setActiveTab("menu")}
          >
            <Menu
              className="h-5 w-5"
              strokeWidth={1.5}
              style={{ color: activeTab === "menu" ? primaryColor : 'rgba(255,255,255,0.3)' }}
            />
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.04em',
                color: activeTab === "menu" ? primaryColor : 'rgba(255,255,255,0.3)',
              }}
            >
              Menu
            </span>
            {/* Cart badge */}
            {cart.totalItems > 0 && (
              <span
                className="absolute flex items-center justify-center"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: primaryColor,
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#000',
                  top: 8,
                  right: 'calc(50% - 18px)',
                }}
              >
                {cart.totalItems}
              </span>
            )}
          </button>

          {/* Meus Pedidos tab */}
          <button
            className="flex-1 flex flex-col items-center justify-center gap-1 relative"
            onClick={() => { setActiveTab("orders"); setMyOrdersOpen(true); setHasReadyOrder(false); }}
          >
            {hasReadyOrder && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 animate-ping" />}
            {hasReadyOrder ? (
              <BellRing className="h-5 w-5 animate-bounce" strokeWidth={1.5} style={{ color: primaryColor }} />
            ) : (
              <ClipboardList
                className="h-5 w-5"
                strokeWidth={1.5}
                style={{ color: activeTab === "orders" ? primaryColor : 'rgba(255,255,255,0.3)' }}
              />
            )}
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.04em',
                color: hasReadyOrder ? primaryColor : (activeTab === "orders" ? primaryColor : 'rgba(255,255,255,0.3)'),
              }}
            >
              Meus Pedidos
            </span>
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
