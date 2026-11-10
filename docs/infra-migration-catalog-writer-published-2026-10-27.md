# Catálogo writer-only publicado — 27/10/2026

A janela pareada autorizada terminou com sucesso: **API reaberta, writer ligado, reader desligado e frontend com recibos/imagensR2 publicado**. Nenhuma migration ou fixture foi executada. Este é o estado atual, substituindo os pins anteriores de API/frontend nos relatórios de preparação.

## Estado confirmado pelo controlador

| Componente | Deployment | Versão100% |
| --- | --- | --- |
| API `vapt-api-production` | `21ec8188-f269-4a1c-915b-52b9ac4cee2d` | `d98d72dc-64a9-4ec9-bec1-fd9510f8bf55` |
| Frontend `vapt-web` | `d25fdb5e-2a0d-4b18-a093-93c8dd2e1cdf` | `a85e1f8a-a626-460b-b861-9dd16a39fb72` |
| Billing, preservado | `e9db2125-fec9-4871-9854-d7532f54dc19` | `b156056a-c5b5-4f14-94c3-65bfd6097fd6` |

- API: `PUBLIC_CATALOG_WRITER_ENABLED=true`, `PUBLIC_CATALOG_READER_ENABLED=false`, health200, sem wrapper de manutenção no módulo publicado.
- Frontend: writer/recibos true, imagensR2, eventos/reader false. A leitura pública ainda segue o caminho legado; esta passagem não comprova eliminação de consultas/polling nas visitas.
- Código API permanece exatamente `realtime-entry.js`, SHA256 `7205822d6931cef363c3730c0f9ecd553a671857a79cdff678203e0c7cec8f94`. O código de billing também foi comparado e preservado.
- CPU1000ms, seis rate limits, oito secrets por nomes/tipos, Hyperdrive de produção, buckets separados, dois namespaces SQLite e tag de migrations existentes preservados por comparação completa dos estados protegidos.
- Bucket privado de catálogo sem r2.dev/custom domains; imagens e seus recursos anteriores não foram recriados ou alterados.
- Billing segue com entrega da fila habilitada e Cron `*/30 * * * *`. Fonte, bindings, consumidor, produtor, retenção e DLQ preservados. Isso não confirma execução natural/entrega; a [observação separada](infra-migration-billing-natural-observation-2026-10-27.md) permanece pendente.

## Autorização e execução única

O usuário respondeu **“Sim, executar essa janela pareada”** à pergunta específica que descrevia manutenção HTTP, publicação do frontend, abertura writer-only, preservação de billing/schema/DNS/main/planos e parada em manutenção em caso de falha. Não houve autorização inferida do sucesso do inspect ou dos testes.

Foi executado o mesmo controlador revisado, SHA256 `ae62bd22d35c87b81ce7b73acd30c24a7c7ef1cd259f215a0496a410ab2a2da4`, uma única vez. Antes da primeira escrita, novo preflight confirmou fontes/pacote, versões/recursos/privacidade e duas sessões PostgreSQL READ ONLY com TLS1.3. Integridade e grants passaram, compute permaneceu0,25–0,25CU/quota216000s; contagens naquele snapshot:0 restaurantes/0 operações de catálogo. Nenhum dado foi apagado para produzir essas contagens.

| Fase durável | Horário UTC |
| --- | --- |
| Manutenção: tentativa |20:04:21.056|
| Manutenção: confirmada |20:04:48.362|
| Frontend: tentativa |20:04:48.364|
| Frontend: confirmado |20:05:45.397|
| Writer: tentativa |20:06:08.981|
| Writer: confirmado |20:06:39.063|

Os horários são do journal, não medição exata do tempo de indisponibilidade. A API só foi reaberta após a conferência do frontend e outra leitura do par em manutenção. O deployment temporário de manutenção foi `be0ed779-1bb7-49c2-a0b0-22e56f90aa44` / `9a1bdbe5-4b44-4c6e-b292-1bed97b265bc`; já não é o deployment ativo.

O resultado foi exit0, `ok=true`, três fases confirmadas e `uncertain=false`. Houve **sete escritas de controle**, todas previstas: um PUT de manutenção, uma sessão de assets, três remessas de assets, um PUT do frontend e um PUT completo da API writer-only. Foram enviados82 assets; os demais8 já estavam disponíveis. O provedor aceitou o caminho bulk suportado, sem retry ou protocolo improvisado.

Os90 assets públicos foram relidos/comparados;85 receberam os cache headers immutable esperados. `_headers` foi incorporado à configuração privada e tanto ele quanto `candidate-proof.json` não foram servidos como arquivos públicos. Nenhum build/canário/teste de email encerrado foi repetido para esta janela.

## Provas e consumo do journal

Workspace: `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan`.

- Resultado `production-catalog-writer-v1-publish-2026-10-27T20-03-46.803Z.json`, SHA256 `a24e8206df0c6f331f153a95a7f1285001176824d209065e78eadd0c34e5ebb8`. O timestamp do nome é o início do processo, não a conclusão.
- Marcador `production-catalog-writer-v1-start.json`, SHA256 `5395500fdfb96059f7a64424eb80c0862d636f91a0e52b96d8dd04eb8533a144`, e suas seis fases: **consumidos, nunca executar novamente/renomear/remover para permitir replay**.
- [Preparação, testes e revisão](infra-migration-catalog-writer-controller-2026-10-27.md):195/195 operadores,383/383 aplicação e correção do único achado importante de protocolo antes da autorização.

A confirmação independente GET-only passou, exit0, em processo separado iniciado às20:08:04.265UTC: zero escritas/SQL, novas versões100%, writertrue/readerfalse, health200, CPU1000, bindings críticos, privacidade do catálogo, código canônico API/billing, fila/Cron ativos e index/arquivos privados conferidos. Não importa nem executa o controlador de publicação e não repete SQL ou a leitura dos90 assets. Artefato `production-catalog-writer-independent-2026-10-27T20-08-04.265Z.json`; verificador `production-catalog-writer-independent-readonly.mjs`, ambos no workspace próprio.

SHA256 da confirmação independente: `a26483792ac9c3e7b9fd17682b7a81e5460c62afc5a3fbcd336243948bf7e7cc`; do verificador: `477eebb17008379293a204384710c165992e0a743cd383889097d4a96943c097`.

## Próximo gate

Falta validar mutações reais sintéticas pelo writer ativo e seu cliente: onboarding, CRUD/variações, campos públicos/privados, recibos/retry/recuperação, imagens e quota/referências, além das condições de bootstrap/reader. O preflight não realizou essas operações e mantém `runtimeWriterCoverageProven=false` e `workerCredentialVerified=false` para a prova específica do valor instalado no Hyperdrive. Não ativar reader/eventos nem prometer economia/CPU/teto financeiro a partir desta publicação.

Não usar os antigos checkers de API/frontend que esperam os pins anteriores ou flagsfalse como diagnóstico atual ou autorização de rollback. Os journals de schema, admissão, billing e canários encerrados continuam preservados. Total formal do subplano7/10; tarefas5/9/10 e Etapa13 abertas. Main, push, merge, DNS, planos pagos e StripeLive não foram alterados.
