import { Navigate } from "react-router-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccountBootstrap } from "@/features/auth/use-account-bootstrap";
import { AccountBootstrapError } from "@/features/auth/AccountBootstrapError";

const RestaurantSelectorPage = () => {
  const { data, isLoading, isError, refetch } = useAccountBootstrap();

  if (isError) {
    return <AccountBootstrapError onRetry={() => void refetch()} />;
  }

  if (isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!data) {
    return <AccountBootstrapError onRetry={() => void refetch()} />;
  }

  if (data.destination !== "select-restaurant") {
    if (data.destination === "onboarding") {
      return <Navigate to="/onboarding" replace />;
    }

    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Escolha um restaurante</CardTitle>
            <CardDescription>
              Sua conta tem acesso a mais de um restaurante. Selecione qual workspace quer abrir.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.restaurants
              .filter((restaurant) => restaurant.onboardingStatus === "complete")
              .map((restaurant) => (
                <Button
                  key={restaurant.id}
                  variant="outline"
                  className="h-auto w-full justify-start px-4 py-4 text-left"
                  onClick={() => {
                    window.location.assign(
                      `/dashboard?restaurantId=${encodeURIComponent(restaurant.id)}`,
                    );
                  }}
                >
                  <span className="block">
                    <span className="block text-sm font-semibold">{restaurant.name}</span>
                    <span className="block text-xs text-muted-foreground">/{restaurant.slug}</span>
                  </span>
                </Button>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RestaurantSelectorPage;
