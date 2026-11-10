# Janela do reader — preparação e revisão, 10/11/2026

O executor fixado de ativação e rollback foi montado e verificado localmente. Nenhuma publicação ocorreu. A ativação exige autorização operacional e novas verificações na própria janela.

## Evidência existente

- O readback Cloudflare de 06/11 confirmou API saudável, writer ligado, reader desligado, catálogo privado, billing inalterado e os bytes publicados correspondentes aos artefatos fixados.
- A inspeção Neon READ ONLY de 06/11, recibo `production-catalog-reader-database-2026-11-06T20-59-04.801Z.json` (SHA-256 `bad21e37363e0d64902a350d2a8dda7b77a348923738f25636b508414576e639`), confirmou zero restaurantes, drafts, organizações, intenções de onboarding, journal, revisões e inconsistências nos agregados conferidos. Schema/ACL/login limitado e limites de compute passaram; ambas as sessões TLS foram encerradas. Não há bootstrap para o conjunto vazio observado. Não é prova de estado atual em 10/11, de ausência de intenções em Durable Objects, de conteúdo R2 ou de writers externos.

## Revisão única do fluxo completo

Foram encontradas duas lacunas importantes, sem achado crítico:

1. **Rollback após cadastro ou mutação:** a checagem de vazio valia também para rollback. Agora só a ativação exige as nove contagens zeradas antes da manutenção e antes de reabrir a API. O rollback continua validando integridade, permissões, capacidade e encerramento das sessões, mas permite dados e operações no journal; preserva writer, executor e recursos.
2. **Ativação aplicada sem recibo final:** provas de deployment de cada fase são gravadas exclusivamente e sincronizadas antes da confirmação. Antes do PUT final, é gravada a impressão digital dos controles esperados e o deployment anterior. O modo explícito `reconcile activate` exige journal consumido, tentativa final registrada, frontend confirmado, API nova com writer/reader ligados, bytes canônicos da API e billing, todos os 90 assets e snapshot estável correspondente. Usa somente GETs e grava um recibo separado, sem reescrever o histórico da tentativa. O rollback pode usar esse recibo se a confirmação original faltar ou for inválida. Estado intermediário ou divergente não é liberado: requer reconciliação/decisão separada, sem retry ou rollback automático.

Ruling: escopo de ativação exclusivamente para catálogo vazio, com exclusão operacional de escritas paralelas fora do app. Os zeros SQL não estabelecem ausência global de writers, identidade da credencial do Hyperdrive ou enumeração de intenções do Durable Object. Esses limites continuam explícitos; a janela não interfere no executor existente. Também não certifica economia realizada, CPU de carga máxima, teto de fatura, comportamento ainda não observado no provedor ou conclusão da migração/main.

## Verificação

Em 10/11, testes de regressão reproduziram os dois achados antes da correção. Depois: 19/19 no pacote local (12 da janela e 7 do controlador), incluindo PUT final aplicado com resposta perdida, recibo final ausente, falha ao persistir confirmação, drift recusado e rollback com journal não vazio. Provedores e DB são simulados nesses testes; artefatos, transportes e journals locais são reais.

- 295/295 testes dos operadores da raiz e 383/383 testes frontend (74 arquivos).
- Executor: `production-catalog-reader-v1-window.mjs`, SHA-256 `697ccf5b2237c9de20b9c558f692fed05831c147f700dd7d8e385c3f57cee578`.
- Inspetor DB: `production-catalog-reader-database-inspect.mjs`, SHA-256 `2f052642782db5f48337e198decbe735057c125681d99c05bf809bc22b05fe94`.
- Pacote fixado, recibos e logs `catalog-reader-window-*-2026-11-10.log` no workspace local ignorado do plano. Candidatos e código runtime intactos. Nenhuma alteração de schema, dados, planos, DNS, billing, flags, deploy ou main nesta preparação.

## Próxima operação

Somente após autorização da janela: verificar a baseline e a condição de catálogo vazio novamente, colocar a API em manutenção temporária, publicar o frontend preparado e reabrir a mesma API com reader ligado e writer preservado. Se houver divergência, interromper sem tentar novamente; se a resposta final for incerta, inspecionar antes de decidir qualquer nova escrita. Não autoriza rollout de outros recursos, recriação de fixtures, execução de rollback nem merge.

## Execução autorizada — 10/11/2026

A janela acima foi executada uma única vez. O executor fixado saiu com código 0, confirmando manutenção, frontend e API final, sem tentativa incerta, retry ou rollback. API final com `PUBLIC_CATALOG_READER_ENABLED=true` e `PUBLIC_CATALOG_WRITER_ENABLED=true`; frontend com eventos habilitados.

| Fase | Deployment | Versão a 100% |
| --- | --- | --- |
| Manutenção da API | `94834b16-919f-475b-a2df-9f2242ca1bb5` | `10c87ed2-6526-4f8a-8257-1350b062d02e` |
| Frontend | `85092412-e68e-496d-9c8f-f2882790f40b` | `372e0bb3-7716-41cb-9c71-bb3a03d84dd3` |
| API reaberta | `c2a310e8-e424-43fa-ba36-5c162c4b827a` | `0aadb532-3a6d-4ad0-a8e2-bf4f688df589` |

- O journal registrou a tentativa de manutenção às 01:20:02 e confirmou a API reaberta às 01:22:31 (Brasília). São horários do journal, não uma medição exata de indisponibilidade.
- As duas inspeções Neon somente leitura confirmaram as nove contagens zeradas, antes da manutenção e antes da reabertura; ambas encerraram as duas sessões. Sem bootstrap, fixture ou escrita SQL. Recibos `production-catalog-reader-database-2026-11-10T04-19-11.949Z.json` e `production-catalog-reader-database-2026-11-10T04-21-30.762Z.json`.
- Os 90 assets públicos foram conferidos byte a byte, 85 com cache imutável, arquivos privados não servidos. Upload incremental de 82 assets em 3 lotes. Sete chamadas de escrita no controle Cloudflare, limitadas à janela autorizada.
- Após o executor fechar, três GETs públicos sem sessão confirmaram API `/health` 200, frontend 200 com index idêntico, e `/catalog-state` para slug inexistente retornando `404 not_found` / `Restaurant not found`, `Cache-Control: no-store`, sem cookie. É prova do caminho de leitura para catálogo vazio, não de entrega de eventos com um restaurante real.
- O readback final preservou billing, cron/fila, domínios, recursos, secrets e proteções configuradas. Sem mudança de DNS, plano, schema, dados ou `main`.

Recibo `production-catalog-reader-v1-activate-result.json`, SHA-256 `469256cdd7681eab32851b11fc2384938b36d267866f1cbbd711566811368a4a`, e provas exclusivas de fases no workspace local do plano. A autorização de ativação foi consumida; não repetir a janela. Qualquer rollback continua uma operação explícita e separada.

**Situação:** ativação do reader em produção confirmada. Entrega de eventos com dados reais, economia observada e encerramento da migração/integração com `main` não são certificados por esta janela.

## Primeiro recorte agregado pós-ativação

Uma consulta GraphQL somente leitura às 01:32:43 de Brasília, HTTP 200 sem erros, comparou dois recortes fechados à esquerda de cinco minutos: antes `04:14–04:19 UTC` e depois `04:23–04:28 UTC`. A manutenção ficou fora de ambos. A consulta filtrou as versões exatas da API e os recursos existentes de produção. Não criou tráfego de aplicação, acesso direto ao Neon, novos tokens, logs ou mudança de configuração.

| Fonte | Antes | Depois |
| --- | --- | --- |
| Worker API, versão exata | Sem grupos | 2 invocações, 0 erros de execução, intervalo de amostragem 1, CPU máxima observada 11,272 ms |
| Durable Object do catálogo | Sem grupos | Sem grupos |
| Bucket privado do catálogo | Sem grupos | 1 `GetObject` com classe `userError` |
| Hyperdrive de produção | Sem grupos | Sem grupos |

A leitura R2 sem sucesso é compatível com o GET de verificação para um slug inexistente, que retornou o 404 esperado. Não é atribuição por requisição individual. O status de execução do Worker não é o status HTTP. “Sem grupos” significa ausência de amostras retornadas neste recorte, não contagem certificada de zero operações. Hyperdrive é um agregado por configuração, não um contador de SQL por endpoint e não inclui conexões diretas ao Neon. O recorte não permite inferir economia, fatura, máximo sob carga, alarmes sem trabalho ou entrega de eventos. Referências: [Workers](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/), [R2](https://developers.cloudflare.com/r2/platform/metrics-analytics/) e [Hyperdrive](https://developers.cloudflare.com/hyperdrive/observability/metrics/).

Evidência: `production-catalog-reader-aggregate-2026-11-10.json`, SHA-256 `45a5c4aca8188de23cff1447c394025e76d5038737b2f072880608fa0bacae76`. Operador de diagnóstico de uma execução no workspace do plano, sem agendamento. Esta é uma linha de base pós-ativação, não um teste positivo do cardápio.

Para a prova positiva, observar uma visita e uma alteração autorizadas de um catálogo existente: conferir a revisão inicial, o sinal WebSocket e a revisão após uma única alteração, além de medir ociosidade sem GET recorrente. Atribuição de SQL por fluxo precisa de recorte e contagem controlados; os agregados acima sozinhos não bastam. Se não houver catálogo, manter a lacuna explícita ou usar uma janela sintética separada com escopo e limpeza próprios. Não fabricar um bootstrap nem repetir janelas já encerradas.
