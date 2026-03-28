import { STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS } from '@/lib/constants';

export interface PlanDefinition {
  id: "starter" | "pro" | "business";
  name: string;
  price: number;
  priceId: string;
  features: string[];
  blockedFeatures: string[];
  highlighted: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "starter",
    name: "Starter",
    price: 97,
    priceId: STRIPE_PRICE_STARTER,
    features: [
      "Cardápio digital ilimitado",
      "QR Codes para mesas",
      "KDS - Monitor de Cozinha",
      "Pedidos ilimitados",
      "Suporte por e-mail",
    ],
    blockedFeatures: ["Caixa e Comanda Aberta", "Multi-usuários"],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 197,
    priceId: STRIPE_PRICE_PRO,
    features: [
      "Tudo do Starter",
      "Caixa e Comanda Aberta",
      "Dashboard de métricas",
      "Suporte prioritário",
    ],
    blockedFeatures: ["Multi-usuários"],
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    price: 347,
    priceId: STRIPE_PRICE_BUSINESS,
    features: [
      "Tudo do Pro",
      "Multi-usuários",
      "Relatórios avançados",
      "Gerente de conta dedicado",
      "SLA 99.9%",
    ],
    blockedFeatures: [],
    highlighted: false,
  },
];
