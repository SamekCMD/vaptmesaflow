# Clientes e consumidor ativos — conferência23/10/2026

## Resultado e escopo

Gate somente-leitura,17:31–17:37UTC. **Compatibilidade remota ainda não aprovada.** O smoke da API Preview31 continua aprovado; não foi repetido. Não houve deploy, alteração de flags/cron/filas/segredos, migration, SQL remoto, envio de email, pagamento, DNS, main ou push.

Fonte candidata: F`5e6537761cd5800052a58414e5c7a1034f7ee69b`, A`f2bb2e94965b7a89de33537d6599163b88001d96`. Código de B mudou por último em F`be66c15`; árvore Git de `infra/cloudflare/billing-email-worker`: `4651c7276b6f373ef9b8df93e4c7774b4298c36a`. CI anterior não é CI novo desses HEADs.

## Versões realmente encontradas

| Serviço | Implantação / versão a100% | Evidência e consequência |
| --- | --- | --- |
| Frontend production `vapt-web` |24d1b0fc-dda0-4789-a426-4146c9cad04d / e77339dd-59ea-44dd-a790-660076570810,09/10 | artefato anterior à paridade tenant; não é o frontend candidato |
| Billing preview |98ec30a6-76b3-4e79-8d2d-aa5a23f739fc / e27200db-8db8-4a44-9876-a2f0df9b899d,29/09 | fonte publicada ainda usa join em `public.restaurants`/owner; sem join de organização, `organization_subscriptions` ou contato canônico |
| Billing production |da2a4249-7fb5-408a-a124-ce5ded1d58af / 1f578bc6-586a-46ca-b180-0301057b2cc8,29/09 | mesmo contrato legado; produção ainda no schema anterior, não receber B novo isoladamente |
| API production |68828632-0b50-4c80-b6d1-2c43a6736760 /914f79f0-b679-45a2-a0c0-069acd87aa23,09/10 | sem bindings/flags do catálogo candidato; não confundir com API Preview31 |
| API parallel top-level |29cbfb3b-7a76-448e-a984-aeb80fc5bde9 /ce6f3919-1d9e-4b43-8914-865d7597619c,30/09 | sem bindings; não é a implantação nomeada `stage11-inert` |

Consulta dos custom domains atuais: `vapt.app.br`→`vapt-web`, `api.vapt.app.br`→`vapt-api-production`, ambos environmentproduction. Isso comprova esses vínculos na Cloudflare, **não** ausência de outros writers/clientes diretos Node/Coolify. Nenhuma investigação de Easypanel/Vercel/DNS legado foi reaberta.

Billing em ambos os ambientes mantém `*/30 * * * *`, sem workers.dev/preview URL novos. Fila preview`91b43d7250d04cb2b30bb0e08ed1b0dd`, consumer`d9aff17d04bd4262a4f222d8b2c8a57f`; production`69f033ad5eb6424c99b41d1baa7ff3ad`, consumer`8fb8e9ad983442aaab49079154d3d799`. Batch10/retries3/retry60s/DLQ própria preservados. Bindings por nome/tipo: fila própria, `DATABASE_URL`secret, `RESEND_API_KEY`secret e `ENVIRONMENT`correto. Valores não lidos/impressos; o metadata não comprova o destino/role efetivo dentro de `DATABASE_URL`. A leitura de configuração/consumers não mede backlog, não drena claims e não autoriza purge.

## Frontends públicos, sem sessão

HTML e scripts próprios foram baixados sem executar JavaScript, cookies ou login. Scripts terceiros de consentimento foram ignorados, não requisitados. O primeiro coletor parou ao recusar corretamente uma URL terceira; um coletor específico concluiu os dois entry bundles:

- Production HTTP200: `/assets/index-Bt91v9Le.js`,361086bytes, SHA256`36b9fda5a6c0521ad90a4b77402d812437d98188c92e81b316d160853555fca5`; APIproduction presente.
- Alias `infra-foundation-vapt-web.autoistloko.workers.dev` HTTP200: `/assets/index-DDUZahNs.js`,549802bytes, SHA256`5a30a403f7bc302c737fc1aa2ef1252d966ea70f70d50371ed286903b75b262f`. Nenhuma entrada na listagem de novos Previews do Worker; isso **não** significa alias ausente, pois o GET público funcionou.

Ambos os entry bundles não contêm os marcadores `/account/bootstrap`, `restaurant_selection_required`, `X-Vapt-Catalog-Protocol`, `catalog-operations` ou o host `stage11-inert`. Ausência no entry bundle não certifica todo o app: uma inspeção adicional dos chunks parou no limite explícito de64 módulos; o entry production referencia95 nomes JS distintos. Não ampliar essa varredura em loop nem chamar a inspeção parcial de prova completa. Versão antiga/artefatos identificados e ausência de manifesto pareado/readback de comportamento mantêm frontend **não certificado** para o candidato.

Não embutir bearer de preview em Vite/JavaScript, storage, querystring ou build. O wrapper atual exige Access **e** bearer; publicação de um frontend apontando diretamente para ele, sem desenho de admissão compatível, não certifica um navegador funcional. A próxima validação de frontend precisa manter essa fronteira, não desativá-la para fazer o teste passar.

## Candidato local conferido

B usa `claimed.organization_id`, join em `public.organizations`, contato verificado de `organization_subscriptions.billing_contact_user_id` e snapshot congelado. Isso é necessário para outbox por organização, cujo `restaurant_id` pode ser nulo após011. O join obrigatório do consumidor antigo em restaurante não cobre esse caso; não gerar um email real para demonstrar a incompatibilidade. Não copiar esse B para production antes do schema/grants canônicos.

Verificação focada nesta continuação, exit0:

- F:34/34 em6 arquivos — bootstrap, mutation/owner adapters, recibos, onboarding e smoke UI tenant, HTTP sintético. Avisos React Router de future flags; não prova navegador remoto.
- B:48pass/0fail/3skip — os3 casos PG são cobertos pelo harness real anterior, não reexecutados nem contados como aprovados nesta suíte.
- B TypeScript `tsc --noEmit`:exit0.
- B Wrangler **dry-run**, só configpreview: bundlelocal407543bytes/SHA256`6998387d92c999c6b036603d2353e960ea8ee214c65dbe75db9b6e0d5b72d587`, com os3 marcadores canônicos; nenhuma publicação. Hash do payload HTTP baixado do provedor não é hash canônico de um bundle local e não foi usado como comparação byte a byte.

## Próximo gate proposto — requer autorização de publicação

Atualizar **somente `vapt-billing-email-preview`** para o B canônico, após preflight de identidade/schema/grants, pendências/outbox/claims e estado da fila, com drain controlado se necessário e sem apagar trabalho. Exigir baseline atual acima, preservar cron30min, fila/consumer/DLQ, nomes e valores existentes de secrets, exposição e permissões. Revalidar artefato exato antes da publicação e conferir versão/configuração/fonte após; comparar production/API/frontend antes/depois. Sem envio sintético de email, novo token/role, recurso/plano, schema ou flags nessa publicação. Não executar scripts de deploy genéricos por inferência.

Se a conferência não puder confirmar identidade/pendências ou detectar drift, parar sem publicar/retry automático. Rollback não pode voltar ao consumidor owner-only depois de outbox por organização; preservar snapshots/leases/entregas aceitas e preferir interrupção controlada da entrega a um rollback incompatível, sob autorização específica se necessário.

Frontend/navegador, writers Node/Coolify, CPU8MiB, janela writer com readerfalse, bootstrap/recuperação, produção e integração de main seguem separados. Catálogo7/10 formalmente; Etapa13 aberta. Evidência sanitizada no scratch ignorado deste plano; nenhum segredo persistido nos novos relatórios.
