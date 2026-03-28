import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";

const faqs = [
  {
    question: "Quanto tempo leva para configurar o Vapt?",
    answer: "Em média, 5 minutos. Basta criar sua conta, cadastrar os itens do cardápio e gerar os QR Codes. Nossa equipe acompanha todo o processo.",
  },
  {
    question: "Preciso de algum equipamento especial?",
    answer: "Não. O Vapt funciona em qualquer dispositivo com acesso à internet — tablet, celular ou computador. Para o KDS da cozinha, recomendamos um tablet ou monitor dedicado.",
  },
  {
    question: "Posso cancelar a qualquer momento?",
    answer: "Sim. Não há fidelidade nem multa. Você pode fazer upgrade, downgrade ou cancelar quando quiser.",
  },
  {
    question: "O sistema funciona offline?",
    answer: "O Vapt precisa de conexão com a internet para funcionar. Recomendamos uma conexão estável no estabelecimento para melhor experiência.",
  },
  {
    question: "Como funciona o suporte?",
    answer: "No plano Básico, suporte por e-mail. Nos planos Pro e Enterprise, suporte prioritário via chat e telefone, com tempo de resposta garantido.",
  },
];

const FAQ = () => {
  return (
    <section id="faq" className="py-24 bg-card">
      <div className="container max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">
            Perguntas frequentes
          </h2>
          <p className="text-muted-foreground text-base">
            Tire suas dúvidas sobre o Vapt
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="bg-background border border-border rounded-md px-5">
                <AccordionTrigger className="text-left font-medium text-sm hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;
