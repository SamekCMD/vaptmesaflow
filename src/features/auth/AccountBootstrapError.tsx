import { Button } from "@/components/ui/button";

type AccountBootstrapErrorProps = {
  onRetry: () => void;
};

export function AccountBootstrapError({ onRetry }: AccountBootstrapErrorProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm space-y-4 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar sua conta.</p>
        <Button type="button" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
