export interface PlanDefinition {
  id: "starter" | "pro" | "business";
  name: string;
  price: number;
  features: string[];
  blockedFeatures: string[];
  highlighted: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "starter",
    name: "Starter",
    price: 97,
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
