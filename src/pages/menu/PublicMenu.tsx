import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  fontFamilyMap,
  hexToHsl,
  type RestaurantConfig,
  type PublicMenuItem,
} from "@/lib/restaurant-config";
import { ShoppingBag, Menu, ClipboardList, Moon, Sun, QrCode, BellRing } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { PublicMenuSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { useCart } from "@/hooks/use-cart";
import ProductDrawer from "@/components/menu/ProductDrawer";
import OrderSummaryDrawer from "@/components/menu/OrderSummaryDrawer";
import MyOrdersDrawer from "@/components/menu/MyOrdersDrawer";
import FloatingActions from "@/components/menu/FloatingActions";
import { supabase } from "@/integrations/supabase/client";

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

  // Cart
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

  // Fetch restaurant + menu items from Supabase
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
          .select("*")
          .eq("slug", slug)
          .single();

        if (restError || !restData) {
          setError("Restaurante não encontrado");
          setLoading(false);
          return;
        }

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

        // Check for existing table session (open_tab mode)
        const mode = (restData as any).payment_mode || "open_tab";
        const table = searchParams.get("table") || searchParams.get("mesa") || "";
        if (mode === "open_tab" && table) {
          // Try localStorage first
          const storedSessionId = localStorage.getItem(`table_session_${restData.id}_${table}`);
          if (storedSessionId) {
            // Verify it's still open
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
          // If not in localStorage, check DB
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
          .eq("restaurant_id", restData.id)
          .eq("available", true);

        if (menuData) {
          setItems(
            menuData.map((m: any) => ({
              id: m.id,
              name: m.name,
              description: m.description || "",
              price: Number(m.price),
              category: m.category || "Geral",
              imageUrl: m.image_url || undefined,
              available: m.available,
            }))
          );
        }
      } catch {
        setError("Erro ao carregar o cardápio");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  // Derive categories
  const categories = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.category)));
  }, [items]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  // Apply dynamic CSS variables
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

  // Realtime: listen for order status changes (client-side)
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new as any;
          if (!getIds().includes(updated.id)) return;

          if (updated.status === "ready") {
            setHasReadyOrder(true);
            toast({
              title: "🎉 Pedido pronto!",
              description: `Seu pedido #${updated.display_id} está pronto para retirada!`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant]);

  const handleSessionCreated = useCallback(
    (sessionId: string) => {
      if (!restaurant) return;
      setTableSessionId(sessionId);
      setHasPlacedOrder(true);
      localStorage.setItem(`table_session_${restaurant.id}_${tableNumber}`, sessionId);
    },
    [restaurant, tableNumber]
  );

  const handleOrderPlaced = useCallback(
    (orderId: string) => {
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
    },
    [restaurant]
  );

  if (loading) {
    return <PublicMenuSkeleton />;
  }

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

  // No table number — show QR code prompt
  if (!tableNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" style={{ fontFamily: fontFamilyMap[restaurant.fontFamily] }}>
        <div className="text-center space-y-4 px-6">
          <QrCode className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-bold">Leia o QR Code da mesa</h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Para fazer seu pedido, escaneie o QR Code disponível na sua mesa.
          </p>
        </div>
      </div>
    );
  }

  const filteredItems = items.filter((i) => i.category === activeCategory);
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
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
              className="flex gap-3 p-4 rounded-xl bg-card cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
              style={{ border: `1px solid ${restaurant.secondaryColor}20` }}
              onClick={() => openProduct(item)}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">{item.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                <p className="text-sm font-bold mt-2" style={{ color: restaurant.primaryColor }}>
                  R$ {item.price.toFixed(2).replace(".", ",")}
                </p>
              </div>
              <Button
                size="sm"
                className="self-end shrink-0 h-8 text-xs transition-transform active:scale-90"
                style={{ backgroundColor: restaurant.primaryColor }}
                onClick={(e) => { e.stopPropagation(); openProduct(item); }}
              >
                Adicionar
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
        {filteredItems.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">
            Nenhum item disponível nesta categoria.
          </p>
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
          <button
            className="flex flex-col items-center gap-0.5"
            onClick={() => setActiveTab("menu")}
          >
            <Menu className="h-5 w-5" style={{ color: activeTab === "menu" ? restaurant.primaryColor : restaurant.secondaryColor + "80" }} />
            <span className="text-[10px] font-medium" style={{ color: activeTab === "menu" ? restaurant.primaryColor : restaurant.secondaryColor + "80" }}>Menu</span>
          </button>
          <button
            className="flex flex-col items-center gap-0.5 relative"
            onClick={() => { setActiveTab("orders"); setMyOrdersOpen(true); setHasReadyOrder(false); }}
          >
            {hasReadyOrder && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 animate-ping" />
            )}
            {hasReadyOrder ? (
              <BellRing className="h-5 w-5 animate-bounce" style={{ color: restaurant.primaryColor }} />
            ) : (
              <ClipboardList className="h-5 w-5" style={{ color: activeTab === "orders" ? restaurant.primaryColor : restaurant.secondaryColor + "80" }} />
            )}
            <span className="text-[10px]" style={{ color: hasReadyOrder ? restaurant.primaryColor : (activeTab === "orders" ? restaurant.primaryColor : restaurant.secondaryColor + "80") }}>Meus Pedidos</span>
          </button>
          <button
            className="flex flex-col items-center gap-0.5"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
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

      {/* Floating Actions for open_tab mode */}
      {paymentMode === "open_tab" && hasPlacedOrder && tableSessionId && (
        <FloatingActions
          sessionId={tableSessionId}
          primaryColor={restaurant.primaryColor}
        />
      )}
    </div>
  );
};

export default PublicMenu;
