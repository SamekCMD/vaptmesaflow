import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RestaurantProvider } from "@/contexts/RestaurantContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DashboardLayout = lazy(() => import("./components/DashboardLayout"));
const Overview = lazy(() => import("./pages/dashboard/Overview"));
const MenuManagement = lazy(() => import("./pages/dashboard/MenuManagement"));
const KitchenMonitor = lazy(() => import("./pages/dashboard/KitchenMonitor"));
const SettingsPage = lazy(() => import("./pages/dashboard/SettingsPage"));
const AppearancePage = lazy(() => import("./pages/dashboard/AppearancePage"));
const CashierPage = lazy(() => import("./pages/dashboard/CashierPage"));
const PublicMenu = lazy(() => import("./pages/menu/PublicMenu"));
const PublicDelivery = lazy(() => import("./pages/delivery/PublicDelivery"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const SignupPage = lazy(() => import("./pages/auth/SignupPage"));
const OnboardingPage = lazy(() => import("./pages/onboarding/OnboardingPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const SubscriptionPage = lazy(() => import("./pages/dashboard/SubscriptionPage"));
const PaymentReturn = lazy(() => import("./pages/payment/PaymentReturn"));

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const stored = localStorage.getItem("vapt_theme") || "light";
    document.documentElement.classList.remove("light", "dark");
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
              <Suspense fallback={<div className="min-h-screen bg-background" />}>
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
                  <Route path="/delivery/:slug" element={<PublicDelivery />} />
                  <Route path="/payment/return" element={<PaymentReturn />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </RestaurantProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
