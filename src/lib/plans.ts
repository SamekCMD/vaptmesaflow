export interface PlanDefinition {
  id: "starter" | "pro" | "business";
  name: string;
  price: number;
  maxRestaurants:number;
  features: string[];
  blockedFeatures: string[];
  highlighted: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "starter",
    name: "Starter",
    price: 97,
    maxRestaurants:1,
    features: [
      "1 restaurante",
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
    maxRestaurants:1,
    features: [
      "1 restaurante",
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
    maxRestaurants:25,
    features: [
      "Até 25 restaurantes por organização",
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
