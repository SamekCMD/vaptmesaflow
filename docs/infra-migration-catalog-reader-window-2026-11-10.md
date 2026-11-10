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
