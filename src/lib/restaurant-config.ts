// =============================================================
// Restaurant Configuration – Multi-tenancy data model
// =============================================================
// Each restaurant tenant has its own config. In a production app
// this would be fetched from Supabase filtered by restaurant_id.
// =============================================================

export interface RestaurantConfig {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  primaryColor: string;   // hex e.g. "#0ea573"
  secondaryColor: string; // hex e.g. "#1e293b"
  fontFamily: "modern" | "classic" | "rounded";
  activeModules: {
    menu: boolean;
    kds: boolean;
    metrics: boolean;
  };
}

export const fontFamilyMap: Record<RestaurantConfig["fontFamily"], string> = {
  modern: "'Inter', system-ui, sans-serif",
  classic: "'Georgia', 'Times New Roman', serif",
  rounded: "'Nunito', 'Quicksand', sans-serif",
};

export const fontFamilyLabels: Record<RestaurantConfig["fontFamily"], string> = {
  modern: "Moderno (Sans)",
  classic: "Clássico (Serif)",
  rounded: "Arredondado",
};

export const defaultRestaurantConfig: RestaurantConfig = {
  id: "demo-001",
  name: "Bistrô du Chef",
  slug: "bistro-du-chef",
  logoUrl: "",
  primaryColor: "#0ea573",
  secondaryColor: "#1e293b",
  fontFamily: "modern",
  activeModules: {
    menu: true,
    kds: true,
    metrics: true,
  },
};

/**
 * Convert a hex color to HSL string for CSS variables.
 */
export function hexToHsl(hex: string): string {
  let r = 0, g = 0, b = 0;
  const h = hex.replace("#", "");
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16); g = parseInt(h[1] + h[1], 16); b = parseInt(h[2] + h[2], 16);
  } else {
    r = parseInt(h.substring(0, 2), 16); g = parseInt(h.substring(2, 4), 16); b = parseInt(h.substring(4, 6), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const lum = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = lum > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: hue = ((b - r) / d + 2) / 6; break;
      case b: hue = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(lum * 100)}%`;
}

// =============================================================
// Mock menu items – In production, fetched from Supabase
// filtered by restaurant_id
// =============================================================
export interface MenuItemVariation {
  id: string;
  name: string;
  options: string[];
  required: boolean;
}

export interface PublicMenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  available: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
  badge?: string | null;
  isChefSuggestion?: boolean;
  variations?: MenuItemVariation[];
}

export const mockMenuItems: PublicMenuItem[] = [
  { id: 1, name: "Bruschetta Caprese", description: "Tomate, mozzarella de búfala e manjericão fresco", price: 24.9, category: "Entradas", available: true },
  { id: 2, name: "Ceviche de Peixe Branco", description: "Peixe marinado com limão, cebola roxa e coentro", price: 32.0, category: "Entradas", available: true },
  { id: 3, name: "X-Burguer Especial", description: "Pão brioche, blend 180g, queijo cheddar e bacon", price: 38.9, category: "Pratos Principais", available: true },
  { id: 4, name: "Risoto de Cogumelos", description: "Arroz arbóreo, mix de cogumelos e parmesão", price: 52.0, category: "Pratos Principais", available: true },
  { id: 5, name: "Salmão Grelhado", description: "Filé de salmão com legumes na manteiga", price: 62.0, category: "Pratos Principais", available: true },
  { id: 6, name: "Limonada Artesanal", description: "Limão siciliano, hortelã e água com gás", price: 14.0, category: "Bebidas", available: true },
  { id: 7, name: "Suco Natural", description: "Laranja, abacaxi ou maracujá", price: 12.0, category: "Bebidas", available: false },
  { id: 8, name: "Brownie com Sorvete", description: "Brownie quente com sorvete de baunilha", price: 22.0, category: "Sobremesas", available: true },
];
