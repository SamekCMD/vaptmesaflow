import {useState} from "react";
import {useActivationProgress} from "@/features/onboarding/use-activation-progress";
import {useTenantContinuation} from "@/features/restaurants/RestaurantScopeBoundary";
import { Link,useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GUIDE_MODULES, type GuideModule } from "@/lib/onboarding";

type OnboardingGuideCardProps = {
  module: GuideModule;
  title: string;
  description: string;
  nextHref?: string | null;
  restaurantId: string;
};

export default function OnboardingGuideCard({
  module,
  title,
  description,
  nextHref,
  restaurantId,
}: OnboardingGuideCardProps) {
  const navigate=useNavigate(),capture=useTenantContinuation();
  const activation=useActivationProgress(restaurantId);
  const [error,setError]=useState<string|null>(null);
  const complete=async()=>{
    if(activation.completing)return;const isCurrent=capture();if(!isCurrent())return;setError(null);
    try{await activation.complete(module);if(isCurrent())navigate(nextHref??'/dashboard?restaurantId='+restaurantId,{replace:true});}
    catch{if(isCurrent())setError('Não foi possível salvar o progresso. Tente novamente.');}
  };
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
        {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button disabled={activation.completing} onClick={()=>void complete()}>
          {activation.completing?"Salvando…":nextHref ? "Concluir e continuar" : "Concluir guia"}
        </Button>
        <Button asChild variant="outline">
          <Link to={"/dashboard?restaurantId="+restaurantId}>Voltar ao overview</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
