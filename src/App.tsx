import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import DashboardLayout from "./components/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import MenuManagement from "./pages/dashboard/MenuManagement";
import KitchenMonitor from "./pages/dashboard/KitchenMonitor";
import SettingsPage from "./pages/dashboard/SettingsPage";
import WhatsAppIntegration from "./pages/dashboard/WhatsAppIntegration";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="menu" element={<MenuManagement />} />
            <Route path="kitchen" element={<KitchenMonitor />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="whatsapp" element={<WhatsAppIntegration />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
