import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GUIDE_MODULES, type GuideModule } from "@/lib/onboarding";

type OnboardingGuideCardProps = {
  module: GuideModule;
  title: string;
  description: string;
  nextHref?: string | null;
  onComplete: () => void;
};

export default function OnboardingGuideCard({
  module,
  title,
  description,
  nextHref,
  onComplete,
}: OnboardingGuideCardProps) {
  const step = GUIDE_MODULES.indexOf(module) + 1;

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
        <Button onClick={onComplete}>
          {nextHref ? "Concluir e continuar" : "Concluir guia"}
        </Button>
        <Button asChild variant="outline">
          <Link to="/dashboard">Voltar ao overview</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
