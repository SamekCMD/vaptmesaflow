import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountBootstrap } from "@/features/auth/use-account-bootstrap";
import { AccountBootstrapError } from "@/features/auth/AccountBootstrapError";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

type ProtectedRouteMode = "dashboard" | "onboarding" | "selector" | "create-restaurant";

const ProtectedRoute = ({
  children,
  mode,
}: {
  children: ReactNode;
  mode: ProtectedRouteMode;
}) => {
  const { recoveryMode, user, loading } = useAuth();
  const {
    data: bootstrap,
    isLoading: bootstrapLoading,
    isError: bootstrapError,
    refetch: refetchBootstrap,
  } = useAccountBootstrap();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (recoveryMode) {
    return <Navigate to="/reset-password" replace />;
  }

  if (user && bootstrapLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (bootstrapError) {
    return <AccountBootstrapError onRetry={() => void refetchBootstrap()} />;
  }

  if (!bootstrap) {
    return <AccountBootstrapError onRetry={() => void refetchBootstrap()} />;
  }

  if (mode === "dashboard") {
    if (bootstrap.destination === "onboarding") {
      return <Navigate to="/onboarding" replace />;
    }

    if (bootstrap.destination === "select-restaurant") {
      return <Navigate to="/restaurants/select" replace />;
    }
  }

  if (mode === "onboarding" && bootstrap.destination !== "onboarding") {
    if (bootstrap.destination === "select-restaurant") {
      return <Navigate to="/restaurants/select" replace />;
    }

    return <Navigate to="/dashboard" replace />;
  }

  if (mode === "selector" && bootstrap.destination !== "select-restaurant") {
    if (bootstrap.destination === "onboarding") {
      return <Navigate to="/onboarding" replace />;
    }

    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
