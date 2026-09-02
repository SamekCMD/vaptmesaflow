export const GUIDE_MODULES = [
  "cashier",
  "menu",
  "kitchen",
  "settings",
  "overview",
] as const;

export type GuideModule = (typeof GUIDE_MODULES)[number];

export type OnboardingGuideProgress = Record<GuideModule, boolean>;

export const EMPTY_GUIDE_PROGRESS: OnboardingGuideProgress = {
  cashier: false,
  menu: false,
  kitchen: false,
  settings: false,
  overview: false,
};

export const POST_SETUP_PRIMARY_ACTION = {
  label: "Ir para o Caixa",
  to: "/dashboard/cashier",
} as const;

export const POST_SETUP_SECONDARY_ACTION = {
  label: "Continuar guia",
  to: "/dashboard/cashier?guide=1",
} as const;

export const GUIDE_MODULE_ROUTES: Record<GuideModule, string> = {
  cashier: "/dashboard/cashier",
  menu: "/dashboard/menu",
  kitchen: "/dashboard/kitchen",
  settings: "/dashboard/settings",
  overview: "/dashboard",
};

export const GUIDE_MODULE_CONTENT: Record<
  GuideModule,
  { title: string; description: string }
> = {
  cashier: {
    title: "Guia: comece pelo Caixa",
    description:
      "Aqui você acompanha mesas abertas e pedidos em andamento. O foco agora é reconhecer onde a operação acontece no dia a dia.",
  },
  menu: {
    title: "Guia: ajuste seu cardápio",
    description:
      "Revise itens, preços e disponibilidade. Este módulo é onde você mantém a operação vendável e alinhada com o salão.",
  },
  kitchen: {
    title: "Guia: acompanhe a cozinha",
    description:
      "Use esta tela para entender o fluxo de preparo e a fila de pedidos. É aqui que atrasos e gargalos aparecem primeiro.",
  },
  settings: {
    title: "Guia: finalize as configurações",
    description:
      "Confira limites, pagamento e dados do restaurante. Essas definições sustentam o restante da operação.",
  },
  overview: {
    title: "Guia: leia a visão geral",
    description:
      "A visão geral resume o momento da operação e mostra seus próximos passos. Depois disso, o guia pode ser encerrado.",
  },
};

export function isGuideComplete(progress: OnboardingGuideProgress) {
  return GUIDE_MODULES.every((key) => progress[key]);
}

export function getRemainingGuideModules(progress: OnboardingGuideProgress) {
  return GUIDE_MODULES.filter((key) => !progress[key]);
}

export function getNextGuideModule(module: GuideModule) {
  const index = GUIDE_MODULES.indexOf(module);
  return index >= 0 ? GUIDE_MODULES[index + 1] ?? null : null;
}

export function getGuideModuleHref(module: GuideModule) {
  return `${GUIDE_MODULE_ROUTES[module]}?guide=1`;
}

export function markGuideModuleComplete(
  progress: OnboardingGuideProgress,
  module: GuideModule
) {
  return { ...progress, [module]: true };
}
