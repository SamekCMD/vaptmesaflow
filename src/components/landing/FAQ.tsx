import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion, useReducedMotion } from "framer-motion";

const faqs = [
  {
    question: "Quanto tempo leva para colocar o Vapt no ar?",
    answer:
      "Em média, 5 minutos. Você cria a conta, cadastra o cardápio e já pode gerar os QR Codes. Nossa equipe acompanha o início.",
  },
  {
    question: "Preciso de algum equipamento especial?",
    answer:
      "Não. O Vapt roda em celular, tablet ou computador. Para a cozinha, recomendamos um tablet ou monitor dedicado para ficar sempre visível.",
  },
  {
    question: "Posso cancelar a qualquer momento?",
    answer:
      "Sim. Não há fidelidade nem multa. Você pode fazer upgrade, downgrade ou cancelar quando quiser.",
  },
  {
    question: "O sistema funciona com internet instável?",
    answer:
      "O Vapt precisa de conexão estável com a internet para manter salão, cozinha e caixa sincronizados. Isso evita fila parada e informação desencontrada.",
  },
  {
    question: "Como funciona o suporte?",
    answer:
      "No plano Básico, suporte por e-mail. Nos planos Pro e Business, suporte prioritário via chat e telefone, com acompanhamento mais próximo.",
  },
];

const FAQ = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const entranceEase = [0.16, 1, 0.3, 1] as const;

  return (
    <section id="faq" className="py-24 bg-card">
      <div className="container max-w-3xl">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: entranceEase }}
          className="text-center mb-12"
        >
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-4">
            Dúvidas de operação
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">
            Respostas para entrar em produção sem surpresa
          </h2>
          <p className="text-muted-foreground text-base">
            Perguntas comuns de quem quer rodar com clareza do salão ao fechamento.
          </p>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: entranceEase }}
        >
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <motion.div
                key={faq.question}
                initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.4,
                  delay: prefersReducedMotion ? 0 : i * 0.05,
                  ease: entranceEase,
                }}
              >
                <AccordionItem
                  value={"item-" + i}
                  className="bg-background border border-border rounded-md px-5"
                >
                  <AccordionTrigger className="text-left font-medium text-sm hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;