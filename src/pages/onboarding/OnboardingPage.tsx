import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountBootstrap } from "@/features/auth/use-account-bootstrap";
import {
  applyOperationMode,
  createSlug,
  mapOnboardingSaveError,
  validateBasics,
  validateOperation,
  type OnboardingFieldErrors,
  type OnboardingForm,
  type OperationMode,
} from "@/features/onboarding/onboarding-form";
import { OperationStep } from "@/features/onboarding/steps/OperationStep";
import { ReadyStep } from "@/features/onboarding/steps/ReadyStep";
import { RestaurantBasicsStep } from "@/features/onboarding/steps/RestaurantBasicsStep";
import { useOnboardingDraft, useSaveOnboardingDraft } from "@/features/onboarding/use-onboarding-draft";
import { useToast } from "@/hooks/use-toast";
import { POST_SETUP_PRIMARY_ACTION, POST_SETUP_SECONDARY_ACTION } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";

const STEPS = ["Dados básicos", "Operação", "Pronto"] as const;
const DEFAULT_FORM: OnboardingForm = {
  name: "",
  slug: "",
  whatsapp: "",
  totalTables: 10,
  localEnabled: true,
  deliveryEnabled: false,
};

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingForm>(DEFAULT_FORM);
  const [errors, setErrors] = useState<OnboardingFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [branding, setBranding] = useState({ primaryColor: "#0ea573", secondaryColor: "#1e293b" });
  const slugManuallyEdited = useRef(false);
  const hydratedDraftId = useRef<string | null>(null);

  const bootstrapQuery = useAccountBootstrap();
  const organizationId = bootstrapQuery.data?.currentOrganizationId ?? null;
  const draftQuery = useOnboardingDraft(restaurantId);
  const saveDraft = useSaveOnboardingDraft();
  const progress = ((step + 1) / STEPS.length) * 100;

  useEffect(() => {
    if (bootstrapQuery.data?.currentRestaurantId) {
      setRestaurantId(bootstrapQuery.data.currentRestaurantId);
    }
  }, [bootstrapQuery.data?.currentRestaurantId]);

  useEffect(() => {
    const draft = draftQuery.data;
    if (!draft || hydratedDraftId.current === draft.id) return;

    hydratedDraftId.current = draft.id;
    slugManuallyEdited.current = true;
    setForm({
      name: draft.name,
      slug: draft.slug,
      whatsapp: draft.whatsapp,
      totalTables: draft.totalTables,
      localEnabled: draft.localEnabled,
      deliveryEnabled: draft.deliveryEnabled,
    });
    setBranding({ primaryColor: draft.primaryColor, secondaryColor: draft.secondaryColor });
    setStep(Math.min(draft.onboardingStep, STEPS.length - 1));
  }, [draftQuery.data]);

  const updateForm = (values: Partial<OnboardingForm>) => {
    setForm((current) => ({ ...current, ...values }));
  };

  const handleNameChange = (name: string) => {
    updateForm({ name, ...(!slugManuallyEdited.current ? { slug: createSlug(name) } : {}) });
    setErrors((current) => ({ ...current, name: undefined }));
  };

  const handleSlugChange = (slug: string) => {
    slugManuallyEdited.current = true;
    updateForm({ slug: createSlug(slug) });
    setErrors((current) => ({ ...current, slug: undefined }));
  };

  const handleModeChange = (mode: OperationMode) => {
    updateForm(applyOperationMode(mode));
    setErrors((current) => ({ ...current, operationMode: undefined, totalTables: undefined }));
  };

  const validateStep = (targetStep: number) => {
    const nextErrors = targetStep === 0 ? validateBasics(form) : validateOperation(form);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const persistDraft = async (onboardingStep: number) => {
    const draft = await saveDraft.mutateAsync({
      restaurantId,
      organizationId,
      name: form.name.trim(),
      slug: form.slug.trim(),
      whatsapp: form.whatsapp.trim(),
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      totalTables: form.localEnabled ? form.totalTables : Math.max(1, form.totalTables),
      localEnabled: form.localEnabled,
      deliveryEnabled: form.deliveryEnabled,
      onboardingStep,
    });
    setRestaurantId(draft.id);
    return draft;
  };

  const handleSaveError = (error: unknown) => {
    const mappedError = mapOnboardingSaveError(error);
    if (mappedError.field === "slug") {
      setErrors({ slug: mappedError.message });
      setStep(0);
      return;
    }
    toast({ title: "Erro ao salvar rascunho", description: mappedError.message, variant: "destructive" });
  };

  const handleNext = async () => {
    if (saving || !validateStep(step)) return;

    setSaving(true);
    try {
      const nextStep = step + 1;
      await persistDraft(nextStep);
      setErrors({});
      setStep(nextStep);
    } catch (error: unknown) {
      handleSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = async () => {
    if (saving || step === 0) return;

    setSaving(true);
    try {
      const previousStep = step - 1;
      await persistDraft(previousStep);
      setErrors({});
      setStep(previousStep);
    } catch (error: unknown) {
      handleSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!user || saving) return;

    const basicsErrors = validateBasics(form);
    if (Object.keys(basicsErrors).length > 0) {
      setErrors(basicsErrors);
      setStep(0);
      return;
    }
    if (!validateStep(1)) {
      setStep(1);
      return;
    }

    setSaving(true);
    try {
      const restaurant = await persistDraft(2);
      const { error } = await supabase
        .from("restaurants")
        .update({ onboarding_completed: true })
        .eq("id", restaurant.id);
      if (error) throw error;

      toast({ title: "Restaurante criado com sucesso!" });
      setSetupComplete(true);
    } catch (error: unknown) {
      handleSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  if (setupComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Operação pronta</CardTitle>
            <CardDescription>
              Seu restaurante já está configurado. Agora você pode ir direto para o caixa ou continuar o guia.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link to={POST_SETUP_PRIMARY_ACTION.to}>{POST_SETUP_PRIMARY_ACTION.label}</Link>
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate(POST_SETUP_SECONDARY_ACTION.to)}>
              {POST_SETUP_SECONDARY_ACTION.label}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 pb-2 pt-6">
        <div className="mb-3 grid grid-cols-3 gap-2">
          {STEPS.map((title, index) => (
            <div key={title} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  index <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span className="hidden text-xs font-medium sm:inline">{title}</span>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-6">
        <Card className="w-full max-w-2xl">
          {step === 0 ? (
            <RestaurantBasicsStep
              form={form}
              errors={errors}
              disabled={saving}
              onNameChange={handleNameChange}
              onSlugChange={handleSlugChange}
              onWhatsappChange={(whatsapp) => updateForm({ whatsapp })}
            />
          ) : null}
          {step === 1 ? (
            <OperationStep
              form={form}
              errors={errors}
              disabled={saving}
              onModeChange={handleModeChange}
              onTableCountChange={(totalTables) => {
                updateForm({ totalTables });
                setErrors((current) => ({ ...current, totalTables: undefined }));
              }}
            />
          ) : null}
          {step === 2 ? <ReadyStep form={form} /> : null}

          <CardFooter className="flex justify-between border-t pt-6">
            <Button variant="outline" disabled={step === 0 || saving} onClick={handleBack}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={saving} onClick={handleNext}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Próximo <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button disabled={saving} onClick={handleFinish}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                Finalizar
              </Button>
            )}
          </CardFooter>
        </Card>
      </main>
    </div>
  );
};

export default OnboardingPage;
