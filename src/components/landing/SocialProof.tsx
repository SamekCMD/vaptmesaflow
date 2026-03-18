import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Carlos Mendes",
    role: "Dono — Bistrô du Chef",
    text: "O Vapt reduziu nosso tempo de atendimento em 40%. A integração com WhatsApp é surreal.",
  },
  {
    name: "Ana Paula Ferreira",
    role: "Gerente — Sushi Express",
    text: "Finalmente um sistema que não complica. Em 1 semana já estávamos operando 100% digital.",
  },
  {
    name: "Roberto Lima",
    role: "Sócio — Rede Burguer Point",
    text: "O dashboard de métricas mudou a forma como tomamos decisões. Recomendo fortemente.",
  },
];

const partners = ["Bistrô du Chef", "Sushi Express", "Burguer Point", "Trattoria Bella", "Café Central", "Poke House"];

const SocialProof = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container">
        {/* Partners */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] mb-8">
            Restaurantes que confiam no Vapt
          </p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {partners.map((p) => (
              <span key={p} className="text-lg font-semibold font-display text-text-disabled hover:text-foreground transition-colors cursor-default">
                {p}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border rounded-xl p-6"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-4 text-text-secondary">"{t.text}"</p>
              <div>
                <p className="font-semibold font-display text-sm">{t.name}</p>
                <p className="text-xs text-text-tertiary">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
