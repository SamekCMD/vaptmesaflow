import { Navigate, useNavigate } from "react-router-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccountBootstrap } from "@/features/auth/use-account-bootstrap";
import { useSwitchRestaurant } from "@/features/auth/use-account-bootstrap";
import { AccountBootstrapError } from "@/features/auth/AccountBootstrapError";

const RestaurantSelectorPage = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAccountBootstrap();
  const switchRestaurant = useSwitchRestaurant();

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

  const completedRestaurants = data.restaurants.filter(
    (restaurant) => restaurant.onboardingStatus === "complete",
  );

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
          <CardContent className="space-y-5">
            {data.organizations.map((organization) => {
              const organizationRestaurants = completedRestaurants.filter(
                (restaurant) => restaurant.organizationId === organization.id,
              );
              if (organizationRestaurants.length === 0) return null;

              return (
                <section key={organization.id} aria-labelledby={`organization-${organization.id}`}>
                  <h2
                    id={`organization-${organization.id}`}
                    className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {organization.name}
                  </h2>
                  <div className="space-y-2">
                    {organizationRestaurants.map((restaurant) => (
                      <Button
                        key={restaurant.id}
                        variant="outline"
                        className="h-auto w-full justify-start px-4 py-4 text-left"
                        disabled={switchRestaurant.isPending}
                        onClick={() => {
                          void switchRestaurant.mutateAsync(restaurant.id).then(() => {
                            navigate("/dashboard", { replace: true });
                          });
                        }}
                      >
                        <span className="block">
                          <span className="block text-sm font-semibold">{restaurant.name}</span>
                          <span className="block text-xs text-muted-foreground">/{restaurant.slug}</span>
                        </span>
                      </Button>
                    ))}
                  </div>
                </section>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RestaurantSelectorPage;
