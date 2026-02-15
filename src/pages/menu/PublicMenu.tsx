import { useParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  fontFamilyMap,
  hexToHsl,
  type RestaurantConfig,
  type PublicMenuItem,
} from "@/lib/restaurant-config";
import { ShoppingBag, Menu, MessageCircle, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { PublicMenuSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { useCart } from "@/hooks/use-cart";
import ProductDrawer from "@/components/menu/ProductDrawer";
import OrderSummaryDrawer from "@/components/menu/OrderSummaryDrawer";
import { supabase } from "@/integrations/supabase/client";

const PublicMenu = () => {
  const { theme, setTheme } = useTheme();
  const { slug } = useParams<{ slug: string }>();

  const [restaurant, setRestaurant] = useState<RestaurantConfig | null>(null);
  const [items, setItems] = useState<PublicMenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cart
  const cart = useCart();
  const [selectedItem, setSelectedItem] = useState<PublicMenuItem | null>(null);
  const [productDrawerOpen, setProductDrawerOpen] = useState(false);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);

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
          <p className="text-white/70 text-sm mt-1">Cardápio Digital</p>
        </div>
      </header>

      {/* Category Navigation */}
      <nav className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-md mx-auto flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat ? "text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              style={activeCategory === cat ? { backgroundColor: restaurant.primaryColor } : {}}
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>

      {/* Menu Items */}
      <main className="max-w-md mx-auto px-4 py-4 pb-32 space-y-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="flex gap-3 p-4 rounded-xl bg-card border border-border cursor-pointer hover:shadow-md transition-shadow"
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
              className="self-end shrink-0 h-8 text-xs"
              style={{ backgroundColor: restaurant.primaryColor }}
              onClick={(e) => { e.stopPropagation(); openProduct(item); }}
            >
              Adicionar
            </Button>
          </div>
        ))}
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
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-background border-t border-border">
        <div className="max-w-md mx-auto flex items-center justify-around h-14">
          <button className="flex flex-col items-center gap-0.5">
            <Menu className="h-5 w-5" style={{ color: restaurant.primaryColor }} />
            <span className="text-[10px] font-medium" style={{ color: restaurant.primaryColor }}>Menu</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 relative" onClick={() => setOrderDrawerOpen(true)}>
            <ShoppingBag
              className="h-5 w-5"
              style={{ color: cart.totalItems > 0 ? restaurant.primaryColor : undefined }}
            />
            {cart.totalItems > 0 && (
              <span
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                style={{ backgroundColor: restaurant.primaryColor }}
              >
                {cart.totalItems}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">Pedidos</span>
          </button>
          <button className="flex flex-col items-center gap-0.5" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="h-5 w-5 text-muted-foreground" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
            <span className="text-[10px] text-muted-foreground">Tema</span>
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
        primaryColor={restaurant.primaryColor}
      />
    </div>
  );
};

export default PublicMenu;
