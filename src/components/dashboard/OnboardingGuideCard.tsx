import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GUIDE_MODULES, type GuideModule } from "@/lib/onboarding";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

type OnboardingGuideCardProps = {
  module: GuideModule;
  title: string;
  description: string;
  nextHref?: string | null;
  onComplete: () => Promise<void>;
};

export default function OnboardingGuideCard({
  module,
  title,
  description,
  nextHref,
  onComplete,
}: OnboardingGuideCardProps) {
  const step = GUIDE_MODULES.indexOf(module) + 1;
  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      await onComplete();
    } catch {
      toast({
        title: "Não foi possível salvar o progresso",
        description: "Tente concluir esta etapa novamente.",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-accent/40">
      <CardHeader className="space-y-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">
          Guia {step} de {GUIDE_MODULES.length}
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={handleComplete} disabled={isCompleting}>
          {isCompleting
            ? "Salvando..."
            : nextHref ? "Concluir e continuar" : "Concluir guia"}
        </Button>
        <Button asChild variant="outline">
          <Link to="/dashboard">Voltar ao overview</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
