import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RestaurantProvider } from "@/contexts/RestaurantContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import DashboardLayout from "./components/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import MenuManagement from "./pages/dashboard/MenuManagement";
import KitchenMonitor from "./pages/dashboard/KitchenMonitor";
import SettingsPage from "./pages/dashboard/SettingsPage";
import AppearancePage from "./pages/dashboard/AppearancePage";
import WhatsAppIntegration from "./pages/dashboard/WhatsAppIntegration";
import PublicMenu from "./pages/menu/PublicMenu";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RestaurantProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Overview />} />
              <Route path="menu" element={<MenuManagement />} />
              <Route path="kitchen" element={<KitchenMonitor />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="appearance" element={<AppearancePage />} />
              <Route path="whatsapp" element={<WhatsAppIntegration />} />
            </Route>
            {/* Public menu – identifies restaurant by slug */}
            <Route path="/menu/:slug" element={<PublicMenu />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </RestaurantProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
