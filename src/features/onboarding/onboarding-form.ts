export type OperationMode = "local" | "delivery" | "both";

export type OnboardingForm = {
  name: string;
  slug: string;
  whatsapp: string;
  totalTables: number;
  localEnabled: boolean;
  deliveryEnabled: boolean;
};

export type OnboardingField = "name" | "slug" | "operationMode" | "totalTables";
export type OnboardingFieldErrors = Partial<Record<OnboardingField, string>>;

export const createSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function validateBasics(input: Pick<OnboardingForm, "name" | "slug">) {
  const errors: OnboardingFieldErrors = {};
  if (input.name.trim().length < 2) errors.name = "Informe o nome do restaurante.";
  if (!input.slug.trim()) {
    errors.slug = "Informe o endereço do cardápio.";
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug.trim())) {
    errors.slug = "Use apenas letras minúsculas, números e hífens.";
  }
  return errors;
}

export function getOperationMode(localEnabled: boolean, deliveryEnabled: boolean): OperationMode | null {
  if (localEnabled && deliveryEnabled) return "both";
  if (localEnabled) return "local";
  if (deliveryEnabled) return "delivery";
  return null;
}

export function applyOperationMode(mode: OperationMode) {
  return {
    localEnabled: mode === "local" || mode === "both",
    deliveryEnabled: mode === "delivery" || mode === "both",
  };
}

export function validateOperation(input: Pick<OnboardingForm, "localEnabled" | "deliveryEnabled" | "totalTables">) {
  const errors: OnboardingFieldErrors = {};
  if (!getOperationMode(input.localEnabled, input.deliveryEnabled)) {
    errors.operationMode = "Escolha como seu restaurante atende.";
  }
  if (input.localEnabled && (!Number.isInteger(input.totalTables) || input.totalTables < 1)) {
    errors.totalTables = "Informe pelo menos uma mesa.";
  }
  return errors;
}

export function mapOnboardingSaveError(error: unknown): { field: OnboardingField | null; message: string } {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  if (code === "23505") {
    return { field: "slug", message: "Este endereço de cardápio já está em uso." };
  }
  return { field: null, message: error instanceof Error ? error.message : "Tente novamente." };
}

