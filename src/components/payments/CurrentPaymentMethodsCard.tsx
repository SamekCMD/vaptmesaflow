import {
  Banknote,
  CheckCircle2,
  CreditCard,
  QrCode,
  ReceiptText,
  Ticket,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const methods = [
  { label: "Dinheiro", icon: Banknote },
  { label: "Pix externo", icon: QrCode },
  { label: "Crédito", icon: CreditCard },
  { label: "Débito", icon: CreditCard },
  { label: "Vale", icon: Ticket },
  { label: "Outro", icon: ReceiptText },
];

export default function CurrentPaymentMethodsCard() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">Usar meus meios atuais</CardTitle>
        <CardDescription className="max-w-xl leading-relaxed">
          Continue utilizando suas maquininhas, Pix, dinheiro e outros meios de pagamento.
          O recebimento será confirmado pelo operador no Vapt.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2" aria-label="Meios aceitos no caixa">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <span
                key={method.label}
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 text-sm"
              >
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {method.label}
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          Confirmação pelo operador no caixa, sem trocar suas ferramentas atuais.
        </div>
      </CardContent>
    </Card>
  );
}
