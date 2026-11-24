# Stripe Live — preparação da conta Vapt

## Atualização consolidada — 24/11/2026

Checkpoints abaixo conservam seu estado histórico. Integrações API#2/frontend#5 concluídas; ver o [estado atual](infra-migration-closure-status-2026-11-24.md).

Entrega Live real comprovada sem cobrança: o endpoint recebeu temporariamente somente o evento adicional `product.updated`; a atualização necessária do Starter gerou `evt_1UfBrhH4hY0s7wXrZWai0MGV`. A lista original dos seis eventos foi restaurada e conferida com endpoint habilitado. Leitura SQL independente em transação somente leitura confirmou `type=product.updated`, `status=ignored`, tentativa1, produto Starter correto, organização nula e zero outbox para o evento. `pending_webhooks=0` foi corroborado pelo recibo no Neon. Isso comprova entrega/assinatura/API/banco, não assinatura Live paga. Nenhum Customer, Checkout, invoice, pagamento ou email foi criado neste ensaio.

Após confirmação do titular, os seis produtos Test/Live receberam `tax_code=txcd_10103001`, default_price mensal e metadata do ambiente/plano corretos. Todos os15preços inclusivos foram conferidos sem mudar valores/intervalos/flags. Titular pessoa física no DF, sem inscrição nem orientação: [roteiro fiscal](infra-migration-fiscal-pessoa-fisica-df.md). Cálculo automático e registros tributários não foram ativados. Última conta: cadastro enviado, nenhum campo atualmente devido, seis verificações pendentes e recebimentos/saques desabilitados.

API produção agora versão42 por acréscimo do diagnóstico privado, preservando os bindings Stripe da41. Billing versão7; manifesto no fechamento. Preview permanece Stripe Test/Neon preview.

Conferência em 23/11/2026, horário de Brasília. Esta preparação continua a [validação Stripe Test no Preview](infra-migration-stripe-test-new-account.md).

## Conexão instalada e webhook habilitado — 24/11/2026

O titular entregou a chave restrita Live e o segredo do webhook pelo formulário local e informou “Configuração Live instalada e conferida”. O operador leu os três preços e o Portal com a chave fornecida, validou modo Live/valores/recorrência/preços inclusivos e instalou os sete bindings Stripe juntos. A versão41 `cdf86ce5-452f-4506-bbbc-563f59950d61` foi publicada100% no deployment `526c5d32-8a61-4536-bbb1-1eec72db2a0c` do Worker `vapt-api-production`.

O operador comparou o código antes/depois, os demais bindings e cinco controles de outros Workers/Preview. O readback independente posterior comparou os recursos/limites da versão41 com a versão40 e confirmou apenas os sete bindings Stripe alterados, secrets como `secret_text`, CPU1000 e o deployment ativo correto. Também conferiu o Preview `stage11-inert` ainda em Stripe Test, preço Pro da nova conta Test e Hyperdrive de preview; produção conserva Hyperdrive/buckets/DOs/limites próprios e reader/writer/realtime ligados.

| Ambiente | Stripe | Neon | Estado da conexão |
| --- | --- | --- | --- |
| Preview `stage11-inert` | Conta Vapt Test | `preview` | Pagamento Test, conciliação e cancelamento comprovados no ensaio anterior |
| API `vapt-api-production` | Conta Vapt Live | `production` | Credenciais/IDs instalados; webhook habilitado; pagamento Live não realizado |

Após a instalação, health200, webhook sem assinatura401 `invalid_webhook_signature` e corpo `{}` com assinatura local válida400 `invalid_webhook_event` passaram. O schema rejeita esse corpo antes de claim/SQL. Um segundo ensaio independente após habilitar o webhook confirmou health200 e rejeição401 de assinatura ausente. Não foram criados Customer, Checkout, Subscription, invoice, cobrança ou evento sintético no banco nesta conexão.

O endpoint Live `we_1Uf8B7H4hY0s7wXrwnT2E84c` foi habilitado por API somente após essas conferências. GET independente confirmou `status=enabled`, `livemode=true`, endereço `https://api.vapt.app.br/webhooks/stripe`, API `2026-08-26.dahlia` e os seis eventos tratados. Não houve entrega real assinada pela Stripe Live neste checkpoint; o probe local comprova instalação/uso do segredo fornecido, não sua associação ao endpoint no provedor.

O formulário privado foi encerrado após confirmar o resultado, liberando a credencial Cloudflare em memória. Os valores Stripe não foram impressos nem gravados em arquivos e ficam como secrets na Cloudflare. A última leitura de conta ainda retorna cadastro enviado, nenhum campo atualmente devido e seis verificações pendentes, com recebimentos/saques desabilitados. Isso é um gate externo à conexão técnica; não declarar pagamentos Live liberados enquanto a Stripe não liberar a conta.

### Perfil versionado para as próximas publicações

O perfil e a admissão de webhook Test foram registrados no commit API `1a391f4` e no [PR#2](https://github.com/SamekCMD/vapt-api/pull/2), com teste e dry-run Live incluídos no workflow de CI. Após atualizar a base às mains já integradas em10/11, passaram712 testes API,32 runtime Workers,66 guards/operador e o build TypeScript. Revisão independente do delta não encontrou achados acionáveis. A integração deste PR e o CI remoto continuam gates separados da conexão remota já realizada.

No repositório API, `wrangler.worker-stripe-live-production.jsonc` representa a configuração atual: três preços Live/Portal acima, `STRIPE_ENVIRONMENT=live`, reader/writer/realtime ligados e os mesmos recursos/limites. Os perfis anteriores de produção continuam como checkpoints históricos de preparação/rollback, com seus guards próprios; não usá-los como configuração da produção atual.

`npm run verify:production-live` valida esse perfil e `npm run build:worker-production-live` executa o guard seguido de Wrangler dry-run. Não foi adicionado comando de deploy nem removido bloqueio dos operadores antigos. Onze testes novos de rejeição de drift passaram; a execução conjunta com regressões de catálogo, operador e realtime somou66/66. O dry-run terminou exit0, bundle4642,83KiB/gzip797,05KiB, sem nova publicação. O README da API foi atualizado com o perfil atual e a separação Test/Live.

Os registros anteriores de “credenciais ainda não entregues”, “webhook desativado” e “Worker inalterado” abaixo são históricos dos checkpoints preparatórios. Permanecem pendentes a liberação cadastral da Stripe, prova de entrega real Live, tratamento fiscal brasileiro e os demais gates globais de integração/estabilidade. Categoria fiscal não confirmada continua sem alteração, e `automatic_tax` permanece desativado.

## Operador de conexão preparado — 24/11/2026

Readback Cloudflare confirmou API de produção na versão40 `25bf7ff3-5148-439b-9d6c-6d7007ad1cbd`, CPU1000, Hyperdrive de produção e reader/writer/realtime ligados. Os bindings Stripe ainda apontam para a conta Test anterior. O readback Stripe Live continua com cadastro enviado, nenhum campo atualmente devido e verificação pendente (`charges_enabled=false`, `payouts_enabled=false`).

Foi preparado operador local temporário em `.superpowers/stripe-live-connect/`, ignorado pelo Git, para receber a chave restrita Live e o segredo do webhook. O operador valida os três preços, Portal e baseline da API; cria uma versão com PATCH conjunto dos sete bindings; confere o resultado antes de publicar100%; e compara código, demais bindings e cinco controles de outros Workers/Preview antes/depois. Não publica configurações locais antigas de catálogo. Em erro após tentativa de escrita, interrompe sem retry ou rollback automático e exige readback.

Sete testes locais passaram, incluindo rejeição de chave Test, preço de outro modo, drift de flags/limites, falha de rede após PATCH e falha de admissão da assinatura. O formulário foi verificado quanto à sintaxe do script, CSP/nonce, política de origem, CSRF, Host e rejeição de campos vazios antes de escrita. Esses testes usaram adaptadores sintéticos/campos vazios, sem instalação remota. A instância usada nos testes foi substituída por uma página limpa.

Após instalar, os probes previstos são health200, webhook sem assinatura401 e corpo `{}` com assinatura local válida400 `invalid_webhook_event`. O corpo inválido é rejeitado pelo schema antes de claim/SQL; esse teste confirma apenas que o segredo entregue foi instalado e usado pelo handler. Não prova que o valor é o segredo do endpoint Stripe escolhido, nem substitui uma entrega assinada pelo provedor. Webhook permanece desativado até instalação e conferência. Credenciais reais ainda não foram entregues e nenhuma alteração do Worker foi feita neste checkpoint.

Ruling: a categoria fiscal SaaS ainda não confirmada não impede preparar o transporte de credenciais e os bindings. Não modificar a categoria, ativar cálculo fiscal ou declarar recolhimento brasileiro configurado. Os preços inclusivos já foram definidos pelo usuário. A ativação comercial continua condicionada aos gates próprios e à liberação da conta Stripe; este operador não cria recursos de cobrança.

## Preços finais com impostos incluídos — decisão aplicada

O usuário definiu explicitamente que R$97, R$197 e R$347 são os totais finais com impostos incluídos. Os três preços Live listados abaixo foram alterados de `unspecified` para `tax_behavior=inclusive`, mantendo os mesmos IDs, valores BRL, recorrência mensal e estado ativo. GETs independentes dos três preços confirmaram o resultado.

A mesma decisão foi aplicada aos 12 preços existentes da conta Vapt em modo Test: três mensais ativos e nove variantes futuras inativas. Uma nova listagem completa, comparada ao inventário anterior, confirmou `inclusive` nos 12, com valores, moeda, recorrência e estados ativo/inativo preservados. Os descontos trimestral de 10%, semestral de 15% e anual de 20% continuam iguais. Nenhum preço foi criado ou ativado nesta alteração.

Essa definição determina que eventuais tributos aplicáveis componham os valores anunciados; ela não configura cálculo nem recolhimento brasileiro. Nenhuma alíquota, registro fiscal ou `automatic_tax` foi habilitado. A categoria candidata `txcd_10103001` ainda não foi confirmada pelo usuário e não foi aplicada. Os parágrafos seguintes que descrevem `unspecified` ou ausência de resposta sobre inclusão são históricos anteriores a esta decisão. A conexão de credenciais Live ao Worker continua pendente.

## Atualização após ativação e cópia pelo titular

O usuário concluiu o cadastro e usou a opção do Dashboard para copiar produtos/billing para produção. O readback Live posterior confirmou `details_submitted=true` e `currently_due=[]`. A Stripe ainda retorna `charges_enabled=false`, `payouts_enabled=false` e `disabled_reason=requirements.pending_verification`, com verificação cadastral/documental em andamento. Isso substitui o estado anterior de cadastro não enviado; não pedir ao titular que repita a ativação por causa deste checkpoint.

A cópia gerou exatamente os três produtos abaixo e seus três preços mensais ativos, todos `livemode=true`, BRL e quantidade licenciada por assinatura. Nenhum preço trimestral, semestral ou anual foi encontrado em Live. Nenhum produto ou preço adicional foi criado pelo operador.

| Plano | Produto Live copiado | Preço Live mensal | Valor |
| --- | --- | --- | ---: |
| Starter | `prod_VL23xqPaemn63m` | `price_1Uf88EH4hY0s7wXrnPGXecAB` | R$97 |
| Pro | `prod_VL23dFAv9gdNcp` | `price_1Uf88DH4hY0s7wXrkun2uQvf` | R$197 |
| Business | `prod_VL230OpEVdXFEs` | `price_1Uf88DH4hY0s7wXrY2m0aa7U` | R$347 |

Os produtos copiados preservaram `vapt_environment=preview`, `vapt_plan_type` correto, `default_price=null` e `tax_code=null`; os preços têm `tax_behavior=unspecified`. Corrigir a identificação/defaults durante o ajuste final do catálogo. A definição fiscal apresentada anteriormente continua sem resposta; não tratar a cópia como escolha de categoria ou de comportamento tributário.

Portal e webhooks não vieram na cópia. Após confirmar listas vazias, foram preparados:

- Portal Live `bpc_1Uf8AEH4hY0s7wXrsYf89Gma`, “Vapt Live”, com os três produtos/preços mensais, quantidade não ajustável, troca de preço com `create_prorations`, cancelamento `at_period_end` sem prorrata, histórico de faturas e atualização de meio de pagamento. Retorno para `https://vapt.app.br/dashboard/subscription`; atualização de dados pessoais e página pública de login desativadas.
- Webhook Live `we_1Uf8B7H4hY0s7wXrwnT2E84c`, “Vapt Billing Live - Production”, para `https://api.vapt.app.br/webhooks/stripe`, API `2026-08-26.dahlia`, com os seis eventos tratados. A API de criação o gera habilitado; ele foi imediatamente desativado pela operação seguinte e o GET independente confirmou `status=disabled`. O segredo retornado pela criação não foi impresso nem gravado em arquivo; sua entrega privada pelo titular ainda é necessária.

Readbacks independentes confirmaram modo/estado/retorno/funcionalidades do Portal e endereço/versão/eventos/estado desativado do webhook. Nenhum Customer, Checkout, Subscription, invoice ou pagamento Live foi criado. O Worker e os secrets de produção continuam inalterados; a instalação dos sete bindings Stripe permanece pendente de definições do catálogo e credenciais Live.

## Primeira conferência — histórico anterior à ativação

A conta escolhida é `acct_1UKK1yH4hY0s7wXr`, Vapt, país BR. As consultas abaixo usaram explicitamente `livemode=true`. O modo Test da mesma conta permanece ligado ao Preview `stage11-inert` e ao Neon `preview`.

| Consulta Live | Resultado |
| --- | --- |
| Conta | `charges_enabled=false`, `payouts_enabled=false`, `details_submitted=false` |
| Requisitos | `requirements.past_due`; cadastro empresarial, representante, banco e aceite de termos pendentes |
| Produtos | 0; paginação concluída |
| Preços | 0; paginação concluída |
| Configurações de Portal | 0; paginação concluída |
| Webhooks | 0; paginação concluída |

Nenhum recurso Live foi criado nesta conferência. Dados de identidade, banco e aceite de termos devem ser preenchidos pelo titular diretamente no [Dashboard da conta](https://dashboard.stripe.com/acct_1UKK1yH4hY0s7wXr). Não coletar esses dados pelo chat ou inventar respostas para o onboarding.

## Definições pendentes para o catálogo

Os planos mensais já decididos são Starter R$97, Pro R$197 e Business R$347. Cada plano terá seu próprio Product e Price recorrente em BRL. O catálogo Test e seus nove preços futuros permanecem separados dos recursos Live.

A pesquisa oficial `SearchTaxCodes` retornou `txcd_10103001`, “Software as a service (SaaS) - business use”, para software em nuvem sem download destinado a empresas. A categoria foi apresentada ao usuário para confirmação e continua pendente. A escolha de total final com impostos incluídos foi respondida e aplicada aos preços Live/Test conforme o checkpoint acima. [Catálogo de códigos fiscais Stripe](https://docs.stripe.com/tax/tax-codes)

O usuário informou Distrito Federal, Brasil e intenção de recolher impostos. A cobertura do Stripe Tax consultada anteriormente não contempla o Brasil; essa categoria de produto não resolve cálculo ou recolhimento brasileiro. Não habilitar `automatic_tax`, cadastrar jurisdições diferentes ou criar alíquotas sem uma solução compatível e instrução aplicável. [Cobertura do Stripe Tax](https://docs.stripe.com/tax/supported-countries)

## Sequência de conexão preparada

Após a cópia, reutilizar os produtos/preços acima e o Portal/webhook já preparados. As criações dos itens 2–4 abaixo descrevem a sequência original e não devem ser repetidas. Conferir recursos e completar apenas o que faltar.

1. Receber as definições do catálogo e consultar novamente produtos/preços existentes antes de criar. Após falha ou resposta inconclusiva, conferir a existência antes de repetir uma criação.
2. Criar três produtos e três preços mensais Live com os valores decididos. Conferir modo, moeda, valor, recorrência, categoria e comportamento fiscal retornados. Preços futuros permanecem fora da oferta inicial.
3. Criar o Portal Live com os três preços mensais, quantidade fixa, histórico de faturas, atualização de meio de pagamento, troca de plano com a política de prorrata já usada em Test e cancelamento ao fim do período. Conferir os recursos por leitura independente.
4. Preparar o webhook de produção em `https://api.vapt.app.br/webhooks/stripe`, usando a versão `2026-08-26.dahlia` fixada na implementação atual e os seis eventos já tratados e validados em Test. Manter a entrega desativada até instalar e conferir o segredo correspondente. Não assinar eventos adicionais que a implementação ainda não trata.
5. Receber privadamente uma chave restrita `rk_live_` da conta Vapt e o segredo de assinatura `whsec_`. Reutilizar o padrão corrigido de formulário local com origem/CSRF/CSP, progresso e resultado visíveis. Manter valores somente em memória e como secrets Cloudflare. Validar acesso aos três preços e ao Portal antes da instalação.
6. Fazer readback do Worker `vapt-api-production` e preservar versão de código, flags efetivas, Hyperdrive de produção, buckets, namespaces, limites e demais bindings. Instalar conjuntamente `STRIPE_ENVIRONMENT=live`, os três Price IDs, o Portal ID e os dois secrets. A configuração local de catálogo ainda contém defaults históricos de flags; não publicá-la cegamente para trocar credenciais.
7. Conferir os sete bindings Stripe, o destino Neon production e a ausência de alterações no Preview. Habilitar o webhook somente após a instalação e verificar rejeição de assinatura ausente/inválida. Confirmar novamente o estado de ativação da conta antes de liberar cobrança real. Nenhuma cobrança real está autorizada por este ensaio de preparação.

Eventos de assinatura atualmente tratados: `checkout.session.completed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` e `customer.subscription.deleted`. A validação de Test comprovou pagamento, conciliação e cancelamento; renovação, falha de pagamento e tratamento de disputas/reembolsos/fraude ainda exigem cobertura própria antes de declarar billing de produção integralmente validado.

## Alcance do primeiro checkpoint

Esta continuação conferiu a conta, inventário e categoria candidata e preparou a sequência acima. Não alterou Worker, secrets, schema, flags, DNS, planos pagos, branches ou main. A instalação Live permanece pendente do cadastro do titular, das definições do catálogo e das credenciais Live. A revisão fiscal brasileira continua pendente separadamente.
