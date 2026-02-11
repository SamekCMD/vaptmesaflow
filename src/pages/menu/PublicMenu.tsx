import { useParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  defaultRestaurantConfig,
  fontFamilyMap,
  hexToHsl,
  mockMenuItems,
  type RestaurantConfig,
  type PublicMenuItem,
} from "@/lib/restaurant-config";
import { ShoppingBag, Menu, MessageCircle, HelpCircle } from "lucide-react";

// =============================================================
// Public Menu – "Site Camaleão"
// In production, fetch restaurantConfig and menu items from
// Supabase filtered by slug (restaurant_id).
// =============================================================

const PublicMenu = () => {
  const { slug } = useParams<{ slug: string }>();

  // TODO: Fetch restaurant config from Supabase by slug
  const [restaurant, setRestaurant] = useState<RestaurantConfig>(defaultRestaurantConfig);
  const [items] = useState<PublicMenuItem[]>(mockMenuItems);
  const [activeCategory, setActiveCategory] = useState<string>("");

  // Derive categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.filter((i) => i.available).map((i) => i.category)));
    return cats;
  }, [items]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  // Apply dynamic CSS variables to this page's root
  useEffect(() => {
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

  const filteredItems = items.filter((i) => i.available && i.category === activeCategory);
  const font = fontFamilyMap[restaurant.fontFamily];

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: font }}>
      {/* Header */}
      <header
        className="py-6 px-4 text-center"
        style={{ backgroundColor: restaurant.primaryColor }}
      >
        <div className="max-w-md mx-auto">
          {restaurant.logoUrl ? (
            <img
              src={restaurant.logoUrl}
              alt={restaurant.name}
              className="h-16 w-16 rounded-full mx-auto mb-3 object-cover border-2 border-white/30"
            />
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
      <main className="max-w-md mx-auto px-4 py-4 pb-24 space-y-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="flex gap-3 p-4 rounded-xl bg-card border border-border"
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

      {/* Bottom Navigation – placeholder for future pages */}
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-background border-t border-border">
        <div className="max-w-md mx-auto flex items-center justify-around h-14">
          <button className="flex flex-col items-center gap-0.5">
            <Menu className="h-5 w-5" style={{ color: restaurant.primaryColor }} />
            <span className="text-[10px] font-medium" style={{ color: restaurant.primaryColor }}>Menu</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 opacity-40" disabled>
            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Pedidos</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 opacity-40" disabled>
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Suporte</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default PublicMenu;
