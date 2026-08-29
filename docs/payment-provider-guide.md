# Guia de providers de pagamento

## Finalidade

Este guia define como implementar, testar e operar providers de pagamento de pedidos sem acoplar regras de negocio a SDKs externos. Stripe de assinatura nao usa este contrato.

## Providers suportados na compatibilidade

| Codigo | Papel | Novas cobrancas | Webhook |
| --- | --- | --- | --- |
| `manual` | dinheiro, Pix externo, cartoes externos, voucher e outros | sim | nao |
| `mercado_pago` | checkout online do restaurante | por feature flag | sim |
| `asaas_legacy` | compatibilidade de Pix existente | durante migracao | sim |

## Regras invariantes

1. o pedido existe e tem total calculado pelo servidor antes da cobranca.
2. provider recebe valor/moeda do pedido persistido.
3. tenant de conta, pedido e transacao deve coincidir.
4. cada tentativa possui idempotency key.
5. retorno do browser nunca marca pagamento como aprovado.
6. webhook online e autenticado e confirmado por consulta ao provider.
7. transicao financeira e insercao de outbox ocorrem atomicamente.
8. transacao original nunca e apagada por cancelamento ou estorno.

## Interface

```ts
interface PaymentProvider {
  readonly code: "manual" | "mercado_pago" | "asaas_legacy";
  getCapabilities(): {
    onlineCheckout: boolean;
    webhooks: boolean;
    cancellation: boolean;
    fullRefunds: boolean;
    partialRefunds: false;
    oauthConnection: boolean;
  };
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPaymentStatus(input: GetPaymentStatusInput): Promise<NormalizedPayment>;
  cancelPayment?(input: CancelPaymentInput): Promise<CancelPaymentResult>;
  refundPayment?(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  handleWebhook?(input: ProviderWebhookInput): Promise<NormalizedPaymentEvent>;
}
```

Metodos opcionais so podem ser chamados quando a capability correspondente for verdadeira.

## Entrada normalizada

`CreatePaymentInput` contem IDs internos, amount decimal normalizado, moeda, descricao segura, callback URLs permitidas e idempotency key. Nao recebe credencial nem objeto livre vindo do frontend.

`NormalizedPayment` contem:

- provider e IDs interno/externo.
- status financeiro normalizado.
- amount, currency e metodo.
- timestamps do provider e da plataforma.
- metadata interna limitada para reconciliacao.
- evidencia bruta somente em armazenamento privado.

## Provider manual

Meios aceitos:

- `cash`
- `external_pix`
- `credit_card`
- `debit_card`
- `voucher`
- `other`

Fluxo:

1. operador autenticado abre pedido/conta no caixa.
2. API valida permissao, tenant, pedido aberto e valor.
3. API cria transacao manual e marca `paid` atomicamente.
4. outbox registra efeitos operacionais uma unica vez.
5. response retorna transacao e resumo atualizado.

Clique repetido com a mesma chave retorna a mesma transacao. Metodo manual nao cria conta de provider e nao depende de internet externa.

## Provider Mercado Pago

- resolve conta OAuth ativa do restaurante.
- renova token no servidor quando necessario.
- cria preferencia Checkout Pro com valor derivado do pedido.
- armazena preference/payment IDs e URL de inicio.
- normaliza consultas e webhooks.
- confirma `paid` somente depois de consultar pagamento e validar conta, valor, moeda e referencia.
- declara estorno total e cancelamento conforme estado; parcial permanece indisponivel.

## Adapter Asaas legado

O adapter encapsula chamadas atuais sem expandir o legado:

- configuracao e chave por restaurante continuam existentes durante a janela.
- criacao Pix e webhook preservam historico.
- o dominio V2 traduz estados legados para estados normalizados.
- novas telas nao devem depender de campos internos Asaas.
- desligar novas cobrancas nao apaga eventos nem IDs antigos.

## Registry

- rejeita codigo desconhecido.
- rejeita registro duplicado.
- retorna instancia configurada por request/escopo seguro.
- nao seleciona provider por dado livre do browser; usa configuracao ativa do restaurante e feature flag.
- mantem `manual` sempre disponivel para atores autorizados.

## Erros normalizados

| Codigo | Uso |
| --- | --- |
| `payment_provider_unavailable` | provider ou conta indisponivel |
| `payment_not_supported` | capability ausente |
| `payment_conflict` | estado ou idempotency key conflitante |
| `payment_amount_mismatch` | valor/moeda divergem |
| `payment_account_mismatch` | conta coletora/tenant diverge |
| `payment_pending` | provider ainda processa |
| `payment_declined` | pagamento recusado |
| `payment_authentication_failed` | credencial/assinatura invalida |
| `payment_upstream_error` | falha transitoria externa |

Mensagens ao usuario nao revelam resposta bruta, token, segredo ou arquitetura interna. Logs usam correlation ID, provider, transaction ID e categoria do erro.

## Checklist para adicionar provider

1. declarar codigo e capabilities.
2. mapear estados externos para estados normalizados.
3. implementar client HTTP/SDK com timeout e redacao de logs.
4. implementar criacao idempotente.
5. implementar consulta autoritativa.
6. validar autenticidade do webhook.
7. comparar tenant, IDs, valor e moeda.
8. suportar eventos duplicados e fora de ordem.
9. adicionar reconciliacao sem criar cobranca.
10. documentar sandbox, rate limits e operacao.
11. implementar suite de contrato parametrizada.
12. ativar apenas por feature flag e restaurante piloto.

## Suite de contrato obrigatoria

- registry conhecido, ausente e duplicado.
- todas as transicoes validas e invalidas.
- idempotency key repetida com payload igual/diferente.
- pedido de outro tenant.
- valor e moeda divergentes.
- timeout antes e depois da resposta do provider.
- webhook invalido, duplicado, fora de ordem e desconhecido.
- evento aprovado sem transacao ou pedido correspondente.
- falha de outbox e reprocessamento concorrente.
- cancelamento de pendente.
- estorno total de pago e rejeicao de parcial.
- redacao de credenciais em logs e responses.

## Observabilidade

Metricas minimas:

- criacoes por provider/status.
- latencia e erros por endpoint externo.
- webhooks recebidos, duplicados, invalidos e reprocessados.
- transacoes pendentes por idade.
- efeitos de outbox pendentes/falhos.
- divergencias de reconciliacao.

Alertas nao devem conter payload integral. Operadores precisam de transaction ID, order ID, restaurant ID, provider e correlation ID para investigacao.

## Rollback de provider

- desativar feature flag para novas cobrancas.
- preservar webhook e reconciliacao de transacoes ja iniciadas.
- manter eventos e credenciais cifradas ate finalizar pendencias.
- trocar novos pedidos para provider legado/manual sem duplicar cobrancas.
- documentar corte temporal e reconciliar ambos os lados antes de remover adapter.
