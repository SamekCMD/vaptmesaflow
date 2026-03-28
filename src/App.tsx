import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RestaurantProvider } from "@/contexts/RestaurantContext";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import DashboardLayout from "./components/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import MenuManagement from "./pages/dashboard/MenuManagement";
import KitchenMonitor from "./pages/dashboard/KitchenMonitor";
import SettingsPage from "./pages/dashboard/SettingsPage";
import AppearancePage from "./pages/dashboard/AppearancePage";
import CashierPage from "./pages/dashboard/CashierPage";
import PublicMenu from "./pages/menu/PublicMenu";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import OnboardingPage from "./pages/onboarding/OnboardingPage";
import PricingPage from "./pages/PricingPage";
import SubscriptionPage from "./pages/dashboard/SubscriptionPage";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const stored = localStorage.getItem('vapt_theme') || 'light';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(stored);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <RestaurantProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                  <Route index element={<Overview />} />
                  <Route path="menu" element={<MenuManagement />} />
                  <Route path="kitchen" element={<KitchenMonitor />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="appearance" element={<AppearancePage />} />
                  <Route path="whatsapp" element={<Navigate to="/dashboard" replace />} />
                  <Route path="cashier" element={<CashierPage />} />
                  <Route path="subscription" element={<SubscriptionPage />} />
                </Route>
                <Route path="/menu/:slug" element={<PublicMenu />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </RestaurantProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
