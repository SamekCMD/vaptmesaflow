import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { QrCode, Monitor, MessageCircle, BarChart3 } from "lucide-react";

const features = [
  {
    icon: QrCode,
    title: "Cardápio Digital",
    description: "Clientes fazem pedidos via QR Code direto na mesa. Sem filas, sem erros, mais agilidade.",
  },
  {
    icon: Monitor,
    title: "Gestão de Cozinha (KDS)",
    description: "Tela em tempo real para chefs acompanharem pedidos, tempos de preparo e prioridades.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Bot com IA",
    description: "Inteligência artificial que atende, tira dúvidas e anota pedidos automaticamente pelo WhatsApp.",
  },
  {
    icon: BarChart3,
    title: "Métricas do Dono",
    description: "Dashboard completo com faturamento, ticket médio, itens mais vendidos e relatórios.",
  },
];

const Features = () => {
  return (
    <section id="funcionalidades" className="py-24 bg-background">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight mb-4">
            Tudo que seu restaurante precisa
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Uma plataforma integrada que conecta salão, cozinha e delivery em uma só experiência.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="card-hover h-full">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-brand-coral-muted flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold font-display text-lg mb-2">{feature.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
