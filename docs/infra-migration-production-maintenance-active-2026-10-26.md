# Manutenção de produção ativa — 26/10/2026

## Janela autorizada e executada

Após autorização explícita do usuário, executado **uma única vez** o controlador fixado e testado. Início às14:28:33 e conclusão às14:30:00 de São Paulo (`2026-10-26T17:28:33.549Z`–`17:30:00.698Z`). Resultado exit0, sem estado incerto, sem repetição ou rollback automático.

**A API está temporariamente indisponível com503; a entrega da fila de billing production está pausada e seu cron foi removido.** Essa manutenção é intencional para preparar a promoção pareada. Não significa migração concluída.

| Controle | Estado confirmado |
| --- | --- |
| API production | deployment `4fe1dde4-18c9-4423-9cb6-23800e164172`, version `29a56753-88c3-4ca1-bb9b-6118a228f195`,100% |
| Resposta anônima health | 503, Cache-Control:no-store, Retry-After:60, sem Set-Cookie |
| Fila production | `69f033ad5eb6424c99b41d1baa7ff3ad`, delivery_paused=true |
| Bproduction cron | lista vazia; cron anterior a preservar: `*/30 * * * *` |
| Código Bproduction | deployment `da2a4249-7fb5-408a-a124-ce5ded1d58af`, version `1f578bc6-586a-46ca-b180-0301057b2cc8`, inalterados |
| Frontend ativo | deployment `24d1b0fc-dda0-4789-a426-4146c9cad04d`, version `e77339dd-59ea-44dd-a790-660076570810`, inalterados |

## Preservação e conferência independente

O upload foi content-only no Worker existente: módulo original `realtime-entry.js`,4603774bytes, SHA256 `3ade3b1dce5ca021239d1f81f6ed77283be7d9b4a470e10d52cfc85cc062fc1e`, mais wrapper de228bytes, SHA256 `f4c53e3380f8dcbaf74e347731b142ee3ac54ce5c3c542aa255b8460067f0f32`. Os bytes originais e os named exports/DO foram preservados; não foi publicado o candidato tenant de A.

O operador reconfirmou configuração completa antes/depois. Um **novo processo somente GET**, iniciado às14:30:20, também confirmou a versão ativa, hashes dos dois módulos,503, CPU configurada1000ms, oito secrets pelos metadados, mesmo Hyperdrive/R2/namespace realtime, seis rates, workers.dev/preview desligados e nenhuma provisão de catálogo em production. Não houve leitura de valores de secrets, logging de credenciais ou fonte remota salva; autenticação/fonte ficaram em RAM.

Preservados consumer `8fb8e9ad983442aaab49079154d3d799`, producer Bproduction, batch10, retries3, delay60, DLQ `ad6e9115d01f4c63a43a557f18c0a3a9` e retention86400segundos. Backlogs principal e DLQ retornaram0 **aproximados** na conferência independente. Nenhum purge, ack, replay, exclusão de consumer ou mensagem. Retenção continua correndo durante pausa; não deixar uma janela indefinida presumindo retenção infinita.

Não foram executados SQL remoto, migrations/grants, seed, bootstrap, ativação de catálogo, publicação dos candidatos tenant de API/B/frontend, mudanças de DNS/main, push/merge, contratação ou aumento de limites. A única publicação foi a entrada temporária de manutenção da API. O operador não consultou o Neon. O estado do banco não deve ser presumido igual ao snapshot de24/10 sem readback próprio.

## Journal e proibição de replay

Marcador fixo existente:

`D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/production-maintenance-window-v1-start.json`

Seis registros de fase preservados, com tentativa e confirmação de API, queue e cron. **Não apagar/renomear o marcador, trocar a data do controlador ou rodar novamente `close`.** A inspeção anterior com pins da API914f79f0 também não serve como verificador do estado novo; usar o readback independente específico desta janela.

Artefatos próprios: `production-window-close-result-2026-10-26T17-28-33-549Z.json` e `production-window-independent-2026-10-26T17-30-20-165Z.json`. Fonte/runtime do operador: A`86833f9`, módulo fixado SHA256 `59aa0dff4dad3c966fcb173e171e94bf7f897eccc5bb1fd06a1c8d60dd985651`. As provas locais40/384/704/type0 foram executadas na preparação anterior de26/10, não repetidas para aparentar outra validação remota.

SHA256 dos resultados: fechamento `b603461c9c198c263f3098e468d5215a4e776a320d55027ac3820a547d48fec6`; confirmação independente `4a183e9671ce08e1673f7f63a90e6e74809688fc31bd7dcfbea7752472949331`.

## Drain continua pendente

`drainVerified=false` e `migrationReady=false`, tanto no recibo quanto no readback independente. Pausar entrega não cancela mensagens em processamento; remover cron não interrompe uma invocação já iniciada. A [propagação do cron pode levar até15min](https://developers.cloudflare.com/workers/configuration/cron-triggers/) e [mensagens em voo podem continuar](https://developers.cloudflare.com/queues/configuration/pause-purge/).

O timestamp de cron confirmado é17:30:00.696Z. Como margem conservadora para cron/fila, considerar propagação e depois a janela máxima da invocação já iniciada: **não usar um instante anterior a18:00:00.696Z/15:00 São Paulo para a avaliação posterior desses consumidores**. Isso é uma restrição temporal de preparação, **não garantia de quiescência**. HTTP/WS/DO e comandos duráveis exigem evidência própria; não reutilizar o grace period de atualização do runtime como se fosse SLA de troca do código.

Próximo gate: conferir propagação/controles e claims/comandos/conexões/schema em leitura protegida, antes de qualquer DDL. Não aplicar009–012 enquanto houver efeitos aceitos sem executor compatível. Backup/restauração e ensaio local de24/10 continuam válidos como artefatos, não autorização para sobrescrever estado novo.

A promoção pareada e a restauração posterior de cron/entrega/tráfego devem usar versões compatíveis com schema e efeitos aceitos. Não voltar automaticamente ao código owner-only depois de dados tenant. Nenhuma retomada automática foi agendada.

Etapa13 e catálogo formal7/10 permanecem abertos. Esta autorização/execução conclui somente o fechamento controlado da janela, não o drain, migrations, promoção ou integração em main.
