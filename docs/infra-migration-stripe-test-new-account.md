# Billing da nova conta Stripe em modo Test

Em 15/11/2026, a API de produção ainda tinha IDs de preços e portal da conta anterior na configuração versionada. O usuário informou que mudou de conta e que a nova conta ainda estava sem webhook. O backup de 10/11 registrou zero vínculos Stripe nas duas tabelas de recursos de billing, zero eventos recebidos e zero registros na outbox de pagamentos. Essa conferência corresponde ao snapshot do backup.

## Recursos da nova conta

O conector confirmou os três produtos e preços ativos na conta Vapt `acct_1UKK1yH4hY0s7wXr` em modo de teste (`livemode=false`).

| Plano | Moeda | Recorrência | Valor | Price ID |
| --- | --- | --- | ---: | --- |
| Starter | BRL | Mensal | R$ 97 | `price_1UcFaVH4hY0s7wXreJOC8Yx4` |
| Pro | BRL | Mensal | R$ 197 | `price_1UcFajH4hY0s7wXrqOTSZ0dg` |
| Business | BRL | Mensal | R$ 347 | `price_1UcFayH4hY0s7wXrraPQM4Rz` |

O Customer Portal `bpc_1UcFh3H4hY0s7wXrWVIEJQMK` está ativo em Test. O conector confirmou histórico de faturas, atualização do método de pagamento, cancelamento no fim do período e troca entre os três preços com prorrata e quantidade fixa.

O webhook Test `we_1UcFhTH4hY0s7wXrMvGtmKNN` está habilitado e aponta para `https://stage11-inert-vapt-api-parallel.autoistloko.workers.dev/webhooks/stripe`. O destino inicial foi corrigido após confirmar a separação de ambientes. A versão `2026-08-26.dahlia` corresponde à versão fixada no cliente. Os eventos configurados correspondem aos que a API trata.

- `checkout.session.completed`
- `checkout.session.expired`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Instalação e verificação

O Preview `stage11-inert` do Worker `vapt-api-parallel` usa o Hyperdrive `vapt-api-neon-preview` e a branch Neon `preview`. A API `vapt-api-production` usa `vapt-api-neon-production` e a branch Neon `production`. A leitura dos bindings publicados confirmou que a API de produção ainda está em Stripe Test com os IDs da conta anterior. O destino planejado para esse Worker é a conta Vapt em Stripe Live.

Os IDs de preços e portal da nova conta ficam na configuração versionada do Preview. A instalação no Preview também exige `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` da mesma conta Test, armazenados como secrets. A entrega direta exige que a rota de webhook seja alcançável pelo Stripe. Hoje o host redireciona para o Cloudflare Access e o wrapper exige bearer.

Validar a sequência Checkout → webhook assinado → associação da assinatura no Vapt → Portal. Conferir a conciliação no banco e os efeitos de billing com dados de teste. A aprovação depende do resultado no Vapt após o webhook, além do retorno do Checkout. [Ensaio anterior no Worker](infra-migration-phase-13-stripe-provider.md)

Em 23/11/2026, o usuário retomou o trabalho e confirmou que ainda não entregou as chaves. O readback encontrou o Preview no deployment `97af4604-7bc0-4dba-b867-a757d28d6ee0` (número 36), com `STRIPE_ENVIRONMENT=test`, Hyperdrive `vapt-api-neon-preview`, role `vapt_api_preview` e CPU de 1000 ms. A leitura independente no Stripe confirmou o webhook desativado no endereço de preview acima. Os secrets presentes nesse deployment são os anteriores. A instalação da nova conta depende da entrega privada da chave restrita Test e do segredo de assinatura. Foi aberto novo formulário local com validação da conta pelos três preços e pelo Portal e conferência dos bindings após a instalação.

O primeiro envio pelo formulário local não chegou à validação de credenciais. A resposta usava `Referrer-Policy: no-referrer`, que faz formulários POST enviarem `Origin: null`, e o servidor exigia a origem local. A política foi corrigida para `same-origin`, preservando o bloqueio de origens externas e a validação de CSRF. Verificações locais com requisições sintéticas confirmaram renderização, política corrigida, rejeição de origens externas/opacas e rejeição de CSRF inválido. O formulário foi reiniciado no mesmo endereço, e a instalação aguarda o reenvio privado. [Efeito de Referrer-Policy no cabeçalho Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy#effect_on_the_origin_header)

### Instalação concluída em 23/11/2026

Após outro relato de tela vazia, o formulário passou a enviar por `fetch` e mostrar progresso e resultado na própria página. As verificações locais confirmaram sintaxe do script, nonce de CSP e resposta JSON de erro com campos sintéticos vazios. O envio real foi registrado com origem local e formato esperado, e a instalação terminou no deployment `b2e2d7f4-344b-4df0-911e-4cbe8e03591c`, número 37, do Preview `stage11-inert`.

A chave restrita Test conseguiu ler os três preços mensais e a configuração do Portal da nova conta, todos conferidos como `livemode=false`. O mesmo PATCH instalou `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e os quatro IDs de preços/Portal no Preview. Os valores dos secrets foram recebidos em memória e enviados diretamente à Cloudflare. A conferência do operador verificou todos os demais bindings e a lista de deployments da API de produção contra o estado anterior.

Uma leitura independente posterior confirmou deployment 37, `ENVIRONMENT=preview`, `STRIPE_ENVIRONMENT=test`, Hyperdrive de preview, CPU de 1000 ms, os quatro IDs corretos e os dois bindings `secret_text`. A assinatura do segredo de webhook ainda exige uma entrega real do Stripe para validação. A rota de webhook continua respondendo HTTP 302 para visitantes sem autenticação. O webhook permanece desativado até preparar a entrada de preview que receba eventos assinados e validar a sequência completa.

### Admissão de webhook no wrapper de preview

Em 23/11/2026, `parallel-preview.ts` foi ajustado para encaminhar apenas `POST /webhooks/stripe` em Stripe Test ao handler canônico sem exigir o bearer do operador. A verificação de ambiente preview e da presença do bearer configurado continua antecedendo o despacho. O handler canônico conserva assinatura sobre o corpo original, limitação de requisições e deduplicação. Os demais caminhos e métodos continuam exigindo o bearer.

O teste de regressão falhou antes da alteração e passou depois. Os nove testes do wrapper incluem assinatura ausente/inválida, corpo adulterado e entrega repetida pelo handler canônico com efeitos sintéticos deduplicados. O teste existente de Stripe no runtime Workers, o typecheck e o dry-run do bundle passaram. A publicação criou o deployment `9588e72c-a4ca-4b30-accc-615ade7a3d56`, número 38, apenas em `stage11-inert`. O operador comparou os bindings, limites, compatibilidade, tag de migration, metadados de Preview e os cinco deployments de controle antes/depois, confirmando preservação.

O acesso ao app Cloudflare Access exige uma credencial adicional: a sessão Wrangler conseguiu listar zero apps, mas o GET do app conhecido retornou 403. O controle do navegador também foi encerrado por impossibilidade de confirmar sua URL. O usuário autorizou criar um token restrito a `Access: Apps and Policies: Edit` na conta Vapt, com expiração em 24/11/2026, e informou que chegou à tela com o token criado. A entrega privada está pendente. A exceção de Access e a validação remota da assinatura ainda precisam ser concluídas.

### Cloudflare Access e habilitação do webhook Test

O token foi entregue pelo formulário local após corrigir a data de início, que originalmente estava no futuro. A API confirmou validade de `2026-11-23T03:00:00Z` até `2026-11-25T02:59:59Z`, equivalentes ao início de 23/11 e fim de 24/11 em Brasília. O token tem permissão sobre os apps Access da conta Vapt; o controlador local limita as operações ao app de preview conhecido e à exceção do webhook. O valor ficou em memória da sessão local e foi liberado ao encerrar o controlador.

Foi criado o app `2660a7f3-4257-454b-b517-8c1bddb68510`, `Vapt Stripe Test webhook - stage11-inert`, com destino público `stage11-inert-vapt-api-parallel.autoistloko.workers.dev/webhooks/stripe` e uma política bypass `b9fd09d1-a8ed-4739-9a94-5e98c54f96ed`. O app original `b319b0a7-bba1-4fbb-b068-7c1cdc8707cd` e sua política Allow foram comparados integralmente antes/depois e preservados. O destino público de Access cobre seus subcaminhos; o wrapper admite sem bearer apenas o POST no caminho exato, e o handler exige a assinatura Stripe.

Oito verificações remotas passaram: raiz/health e a URL imutável do deployment continuaram retornando 302 para Access; GET/OPTIONS do webhook e POST em subcaminho retornaram 401 do wrapper; POST sem assinatura ou com assinatura inválida retornaram 401 `invalid_webhook_signature` do handler. O endpoint Stripe Test foi habilitado após esses testes. A leitura independente confirmou os seis eventos e o endereço de preview, e encontrou exatamente um endpoint na nova conta Test. A validação assinada e o ciclo de pagamento foram concluídos na continuação registrada abaixo.

### Preferência fiscal e cobertura do Stripe Tax

O usuário informou que pretende usar Stripe Tax e já recolhe impostos, indicando Distrito Federal, Brasil. As consultas `GetTaxSettings` e `GetTaxRegistrations` do conector retornaram `INVALID_ARGUMENT`. A leitura da conta confirmou país BR. A cobertura oficial consultada em 23/11/2026 omite o Brasil para sede da empresa e localização do cliente, portanto a configuração fiscal automática brasileira permanece pendente de solução compatível. As assinaturas Test continuam usando os preços existentes. A escolha entre preços com impostos incluídos e preços antes dos impostos ainda não foi respondida. [Países suportados pelo Stripe Tax](https://docs.stripe.com/tax/supported-countries)

## Checkout, pagamento Test e reconciliação no Neon — 23/11/2026

O CLI Neon existente estava autenticado. O preflight versionado de preview confirmou identidade/schema/grants, compute limitado ao valor esperado e zero outbox, claims ativos e operações de catálogo antes do ensaio. O login temporário de Cloudflare Access foi concluído pelo usuário com Approve. O executável portátil oficial de `cloudflared` ficou na pasta temporária ignorada do projeto. O CLI mantém sua sessão nativa de Access conforme a duração de uma hora do app.

O controlador temporário foi preparado para o Preview e a branch Neon fixos. A primeira inicialização parou em health401 depois de renovar o bearer de operação; a segunda também parou nessa conferência. A retomada conseguiu health200. Durante a primeira tentativa de login, o controlador usou por engano o widget Turnstile de produção contra a chave de teste existente no preview, resultando em403. A fixture dessa tentativa foi removida com readback zero antes da retomada. O controlador foi corrigido para usar `XXXX.DUMMY.TOKEN.XXXX`, conforme os operadores de preview já versionados e a documentação Cloudflare, sem alterar a configuração Turnstile do Worker. [Comportamento oficial dos tokens de teste](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)

O deployment final do Preview é `643156fb-5be6-48e3-be3c-a0187c372d05`, número42. Os deployments39–42 são renovações do bearer de operação que preservam o código do webhook, os demais bindings e CPU1000. A conta sintética de owner foi preparada diretamente no banco; o login com senha, a criação do Customer/Checkout, a leitura da assinatura e a criação do Portal foram executados pelos endpoints normais do Vapt. Esse ensaio não certifica signup/onboarding ou navegação completa do frontend de preview.

| Recurso de Test | Identificador |
| --- | --- |
| Organização | `7afa1e9a-0736-4ec4-838f-4c468762fdf6` |
| Owner sintético | `0a734601-b5fb-4829-a737-c9ec8f6ee1c8` |
| Customer | `cus_VgUVodjoyFn4rg` |
| Checkout | `cs_test_a08rzrIxyuu4YKdwog0HvFtlfddnpcvnVKVpf5ilhvKcco9vIF36Phs9pQ` |
| Subscription | `sub_1Uf7XZH4hY0s7wXrRvaJHQL7` |
| Invoice | `in_1Uf7XXH4hY0s7wXryYkhYKjC` |

O usuário concluiu o Checkout com cartão de teste. Readbacks independentes da Stripe confirmaram `livemode=false`, Checkout `complete/paid`, invoice `paid` com total e `amount_paid=19700` BRL, uma unidade do preço Pro mensal correto e Subscription `active`. No Neon, a assinatura passou de Starter/trialing para Pro/active, com Customer/Subscription associados e Checkout pendente limpo. A leitura autenticada do endpoint de assinatura confirmou o estado, e a criação do Portal retornou URL validada em `billing.stripe.com`. O Portal foi gerado, mas sua interface não foi exercitada neste ensaio.

| Evento assinado gerado pela Stripe | Resultado no Neon | Tentativas |
| --- | --- | ---: |
| `invoice.paid` — `evt_1Uf7XaH4hY0s7wXrkfLGafy3` | processed, Pro/active | 1 |
| `checkout.session.completed` — `evt_1Uf7XaH4hY0s7wXr1F0BKRa6` | processed, associação conciliada | 1 |
| `customer.subscription.deleted` — `evt_1Uf7ZIH4hY0s7wXrNeT6DOaV` | processed, Pro/cancelled | 1 |

A Subscription sintética foi cancelada por API com `invoice_now=false` e `prorate=false`, após validar seu modo Test, Customer e metadados da organização/owner próprios. O webhook refletiu o cancelamento no Neon. GET independente dos três eventos mostrou `pending_webhooks=0` e `livemode=false`, além do estado processado observado no banco. Esse resultado comprova assinatura real do provedor e conciliação canônica; não é prova remota de replay, falha de pagamento, renovação ou Stripe Live.

O logout normal retornou sucesso. Uma tentativa de exclusão da fixture encontrou os vínculos imutáveis de `organization_billing_resources` e fez rollback da limpeza SQL. Em seguida, a fixture foi aposentada com uma transação restrita aos UUIDs, nome, email sintético e três recursos Stripe exatos: removeu suas credenciais, desativou a associação de owner, desmarcou a verificação do email e removeu os dois intents de email de billing. Readback independente confirmou zero sessões após logout, zero credenciais, zero membros ativos e zero outbox. Permaneceram a identidade/organização desativadas, três vínculos imutáveis e três eventos processados como histórico do teste. Customer, invoice e Subscription cancelada também permanecem no histórico Stripe Test.

O controlador local foi encerrado após esse readback, liberando as credenciais mantidas em memória. As URLs temporárias de teste foram encerradas. A configuração do webhook permanece habilitada para a nova conta Test exclusivamente no Preview; a conexão Stripe Live de produção e a configuração fiscal brasileira continuam pendentes.

## Preços para os próximos períodos

Após a decisão do usuário de usar totais finais com impostos incluídos, os três preços mensais e os nove preços futuros desta conta Test receberam `tax_behavior=inclusive`. Listagem independente confirmou os 12 preços, preservando IDs, valores, moeda, recorrência e estados: três mensais ativos e nove futuros inativos. Nenhuma configuração de cálculo/recolhimento fiscal foi habilitada. Os três preços mensais da conta Live receberam a mesma definição; [registro da alteração](infra-migration-stripe-live-readiness.md).

O usuário definiu descontos de 10% no trimestral, 15% no semestral e 20% no anual sobre o total das mensalidades equivalentes. Os nove preços recorrentes estão inativos no Stripe Test. A leitura de conferência encontrou exatamente três preços ativos, todos mensais, e confirmou os mesmos preços mensais como padrões dos produtos e opções do Customer Portal.

| Plano | Período | Desconto | Total por período | Price ID de Test | Lookup key |
| --- | --- | ---: | ---: | --- | --- |
| Starter | Trimestral | 10% | R$ 261,90 | `price_1UcFkSH4hY0s7wXrJNlkFgeC` | `vapt_starter_quarterly_brl` |
| Starter | Semestral | 15% | R$ 494,70 | `price_1UcFkiH4hY0s7wXrYkRgjrZR` | `vapt_starter_semiannual_brl` |
| Starter | Anual | 20% | R$ 931,20 | `price_1UcFkrH4hY0s7wXr6CfJGaIN` | `vapt_starter_annual_brl` |
| Pro | Trimestral | 10% | R$ 531,90 | `price_1UcFkmH4hY0s7wXrpcGnFt6U` | `vapt_pro_quarterly_brl` |
| Pro | Semestral | 15% | R$ 1.004,70 | `price_1UcFkuH4hY0s7wXrPjnscJKt` | `vapt_pro_semiannual_brl` |
| Pro | Anual | 20% | R$ 1.891,20 | `price_1UcFkyH4hY0s7wXrPmrrXk9n` | `vapt_pro_annual_brl` |
| Business | Trimestral | 10% | R$ 936,90 | `price_1UcFkqH4hY0s7wXrKohEIsOI` | `vapt_business_quarterly_brl` |
| Business | Semestral | 15% | R$ 1.769,70 | `price_1UcFkyH4hY0s7wXr3U2CyK71` | `vapt_business_semiannual_brl` |
| Business | Anual | 20% | R$ 3.331,20 | `price_1UcFl2H4hY0s7wXrDN5Pv1QS` | `vapt_business_annual_brl` |

Para disponibilizar os períodos no Vapt, o Checkout precisa escolher o preço por plano e periodicidade, e o webhook precisa reconhecer todos os preços como variantes dos três planos. Após a validação em Test, habilitar os preços e adicionar ao Customer Portal os períodos que poderão ser trocados. Uma publicação em Live exige os preços da conta Live.
