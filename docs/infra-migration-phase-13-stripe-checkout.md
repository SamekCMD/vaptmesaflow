# Etapa 13 — Checkout e Portal no Worker production, Stripe Test

## Resultado observado — 08/10/2026

Ensaio concluído no par publicado existente, API `94fffd63-f759-43c3-9f6a-0387e14e8c73`/frontend `916951fb-b0a8-43a2-ab7a-ba4923064425`, CPU1000, sem mudança de runtime, secret, schema, DNS, main, assinatura ou Stripe Live. O endpoint Test existente foi habilitado apenas durante as entregas reais e restaurado disabled. Cleanup próprio, logout/revogação, readback pós-ensaio e encerramento do operador confirmados.

### Conta descartável e escopo

Owner `0d095abc-432d-4bab-aa7e-a6e718a55fae`, restaurante `ad300cce-28b4-4d69-8d6b-45b41fdbc8a2`, tag `stage13-checkout-20261008-0d095abc`; destinatário sintético `delivered+stage13-checkout-20261008-0d095abc@resend.dev`. Bootstrap SQL somente de user verificado/credential/restaurante Starter/trialing, com senha aleatória e hash nativo em memória. Não é prova de signup/verificação, já tratados no gate de autenticação; nenhum estado financeiro foi escrito pelo operador SQL.

Turnstile concluído pelo usuário na página loopback. Login na API pública respondeu200, resolveu o próprio owner e emitiu cookie Secure/HttpOnly/SameSiteLax usado em memória. Não houve cookie fabricado/injetado no browser, desafio falso ou relaxamento de autenticação. Este ensaio autentica chamadas HTTP da API, não é um novo teste de sessão/CORS do frontend.

### Checkout, pagamento simulado e eventos

- Status inicial Starter/trialing/canStartCheckout=true. Checkout autenticado retornou200; uma segunda solicitação sequencial, com outra Idempotency-Key, reutilizou a mesma sessão pendente. SDK conferiu livemode=false, ambos os UUIDs, Customer próprio, client_reference_id, Price Pro existente `price_1UKLz7QYNWCekS7FA9lBwZEd`, total19700BRL e os callbacks exatos do dashboard. Sem ativação antecipada nem intent antes do pagamento. Não certifica concorrência.
- Brave exibiu Área restrita/Vapt Pro R$197/mês. Foram usados apenas cartão4242/futuro12/34/CVC123 e nome fictício publicados para testes; não foi marcada a opção de salvar dados no Link. [Transações do sandbox Stripe não movimentam fundos](https://docs.stripe.com/testing).
- A primeira tentativa de enviar foi interrompida por UI de extensão. GET independente confirmou sessão open/unpaid/Test/sem Subscription; depois de o navegador liberar a página, o mesmo Checkout foi enviado e confirmado. Não houve segundo Checkout/pagamento duplicado.
- Fatura `in_1UOMP8QYNWCekS7FUzJr0Ps2`: Test, paid, total/amount_paid19700. Subscription `sub_1UOMP9QYNWCekS7FtDrSflJh`: Test, active, metadados próprios.
- `invoice.paid` — `evt_1UOMPAQYNWCekS7FP6IPCobb`; `checkout.session.completed` — `evt_1UOMPBQYNWCekS7Fg8l2kGqv`: entregas reais assinadas pelo Stripe, ambas processed/attempt_count1. Worker persistiu Pro/active, os vínculos próprios e um único intent subscription_activated; pending Checkout ficou null. Nenhuma assinatura de webhook/secret foi fabricada ou lida da Cloudflare.

### Portal e prova de navegador

POST autenticado `/billing/stripe/portal` respondeu200 e retornou URL HTTPS no host exato billing.stripe.com. Portal existente do sandbox exibiu Vapt Pro R$197/mês, Visa de teste4242/12-2034 e fatura paga R$197 em08/10, próxima data08/11. Evidência visual no scratch `checkout-portal-test-success.png`. Não foram testadas alteração de plano, forma de pagamento, cancelamento via UI do Portal, renewal/payment_failed ou fatura Live. O retorno do Checkout ao frontend mostrou login, esperado porque esta sessão estava no operador HTTP, não no browser; não confundir com regressão do pareamento previamente aprovado.

### Segurança, verificação e pendências

Guards de ownership Test/ambos UUIDs e host HTTPS exato: RED2→GREEN2. Handoff real HTTP restrito a Host/Origin/um único desafio/redirects guardados: RED→GREEN; suite relacionada9/9 e sintaxe passaram. Nada alterado no runtime do produto; não atribuir nova certificação das suítes históricas a esse ensaio.

Valores de API key privada, senha, cookie e Turnstile não foram registrados. A saída AX inicial incluiu URLs opacas de Checkout/Portal em iframe/links sem esquema; não são secrets administrativos, mas são links de acesso do teste. A leitura seguinte omitiu integralmente WebAreas/URLs do provedor. Após excluir o Customer, reload do Portal exibiu “Página não encontrada”, conferindo a invalidação do acesso hospedado. Não reutilizar ou versionar esses URLs.

Logout respondeu200; reutilização do cookie em `/auth/me` recebeu401/unauthorized. Cleanup restaurou primeiro endpoint disabled, verificou as sessões próprias/ausência de Checkout aberto, cancelou somente a Subscription própria e excluiu Customer próprio, todos conferidos por GET. SQL transacional apagou apenas os metadados/UUIDs/events/outbox da fixture e confirmou zero em seis tabelas; pool/receiver encerrados, exit0. Readback independente confirmou endpoint disabled, Subscription canceled, Customer deleted/ausente no sink e fatura Test paid de19700. Fatura, eventos e Subscription cancelada permanecem como histórico normal do Stripe; não afirmar zero objetos no provedor.

Readbacks Cloudflare antes/depois confirmaram os mesmos dois deploys a100%, CPU1000, oito nomes de secrets, bindings/recursos/domínios/flags, API sem Cron/realtime, StripeTest, bucket privado e API workers.dev/VersionURLs off. Não houve implantação ou mudança desses recursos. CI dos commits anteriores exatos API8bbb88a/frontend e535c67 passou nos dois runs push/PR; isso não certifica automaticamente este novo registro documental.

Etapa13/cutover continuam abertos: entrega Queue/Resend de billing, ciclo ampliado/replay/out-of-order/recuperação, imagens públicas deliberadas, realtime production e observabilidade/capacidade. Não habilitar endpoint permanentemente, Live, main ou desligamento da VPS por inferência deste gate.
