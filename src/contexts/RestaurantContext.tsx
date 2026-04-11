/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { defaultRestaurantConfig, type RestaurantConfig } from "@/lib/restaurant-config";

interface RestaurantContextValue {
  config: RestaurantConfig;
  updateConfig: (partial: Partial<RestaurantConfig>) => void;
}

const RestaurantContext = createContext<RestaurantContextValue | undefined>(undefined);

export const RestaurantProvider = ({ children }: { children: ReactNode }) => {
  // TODO: In production, fetch from Supabase by restaurant_id / auth user
  const [config, setConfig] = useState<RestaurantConfig>(defaultRestaurantConfig);

  const updateConfig = useCallback((partial: Partial<RestaurantConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
    // TODO: Persist to Supabase – upsert into `restaurants` table
  }, []);

  return (
    <RestaurantContext.Provider value={{ config, updateConfig }}>
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = () => {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error("useRestaurant must be used within RestaurantProvider");
  return ctx;
};
