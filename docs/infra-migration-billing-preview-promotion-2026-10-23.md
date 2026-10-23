# Promoção restrita de billing preview —23/10/2026

## Autorização e desenho executável

Usuário respondeu **`sim continuar`** à proposta explícita de publicar somente o consumidor de preview após conferir pendências, preservando filas, cron e segredos, sem produção/frontend/flags. Não reabrir perguntas de arquitetura já decidida nem repetir os gates anteriores. Este documento registra o gate; o resultado remoto, quando houver, deve ficar no início.

Publicador `scripts/billing-preview-publish.mjs`, sem CLI genérico ou argumento de destino. Só aceita `['publish']`; exige baseline deployment`98ec30a6-76b3-4e79-8d2d-aa5a23f739fc`/version`e27200db-8db8-4a44-9876-a2f0df9b899d` a100%. Confere árvore B`4651c7276b6f373ef9b8df93e4c7774b4298c36a`, ausência de alterações locais em B, recompila com Wrangler dry-run e exige SHA256`6998387d92c999c6b036603d2353e960ea8ee214c65dbe75db9b6e0d5b72d587`/407543bytes. Não usa alias de deploy bloqueado.

Uma chamada **PUT `/workers/scripts/vapt-billing-email-preview/content`**, só metadata de entrada `main_module:index.js` e um módulo JS. A [operação oficial](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/content/methods/update/) substitui conteúdo sem tocar configuração/metadata. Isso evita reenviar/recriar secrets, Cron, consumers e rotas. Nenhum PUT/PATCH de schedules/filas/ACL ou POST de mensagem/email é permitido pelo operador. Credencial Cloudflare capturada em RAM pelo Wrangler existente; nenhuma credencial em argumentos/env/logs/novos arquivos.

## Preflight e pós-condições

- Mesmo compatdate2025-12-01/flagsvazias/usage standard/placementvazio, logpushfalse/tailvazio; quatro bindings exatos — ENVIRONMENTpreview, própriaQueue e dois secret_text por nome/tipo. Workers.dev/PreviewURLsfalse, sem custom domain do billing.
- Cron único30min; fila própria `91b43d7250d04cb2b30bb0e08ed1b0dd`, consumer`d9aff17d04bd4262a4f222d8b2c8a57f`, batch10/retries3/retry60s/timeout5s, DLQ`09a1fe7faa4d4bdd8277dd5851b85084`. Sem pausa/purge/replay ou troca de recursos.
- GET [Queue Metrics](https://developers.cloudflare.com/api/resources/queues/methods/get_metrics/): principal0mensagens/0bytes; DLQ1mensagem/28bytes, o teste inválido antigo documentado na Etapa8, preservado. São métricas **best-effort**, não prova atômica de drain. Mudança/pendência bloqueia antes do PUT. Não apagar a DLQ para satisfazer o guard.
- `scripts/billing-preview-database.mjs`: projeto/branch/endpoint/database/role fixos, cota216000s/ambos limites do endpointpreview0,25CU; conexão direta TLS verificado, BEGIN READ ONLY/8s/2s/ROLLBACK/close. Schema de organização/subscription/journal, outbox orgobrigatória/restaurantopcional e SELECT/UPDATE necessários; outbox global/claimsprocessing/journal todos0. Repete a leitura após publicação; não roda migrations/grants/DML.
- A identidade/permissões verificadas são da **conexão direta de preflight `neondb_owner`**, não uma leitura do secret interno do Worker. A procedência do binding existente vem do runbook da Etapa8 e da versão imutável ainda exata;e272: pooled Neon preview instalada e mantida. Conteúdo-only preserva o mesmo binding. Não chamar isso de nova prova runtime do destino/role de DATABASE_URL, nem de role restrita de billing. Nenhuma credencial write-only será recuperada ou substituída para provar esse ponto.
- Controles antes/depois: deployments billingproduction/APIproduction/web/parallel top-level e PreviewAPI31 fixo. Conferência adicional do baseline é o último GET antes do PUT; não há compare-and-swap atômico documentado, portanto concorrência ainda pode produzir resultado incerto.
- Após PUT: nova implantação/versão a100%, mesmos recursos/configuração/controles e métricas; módulo baixado via content/v2, parser multipart e comparação **byte a byte** com o bundle aprovado, sem hash do envelope. Não executar Cron/consumer manualmente nem enviar email de teste.

Erro após início do PUT informa `published:null`/resultado incerto, nunca falso “não publicado”; somente códigos fixos/status/códigos numéricos de provedor. Sem retry/repair/rollback automático. Não voltar a B owner-only depois de outbox por organização. Se preflight falhar, parar sem escrita; se pós-condição falhar, investigar por leitura antes de nova autoridade.

## Evidência antes da publicação

31 testes novos observaram RED→GREEN: destino/malformação negados antes de IO, baseline/artefato/ingresso/cron/secretset/consumer/pendências, TLS/DB/schema/ACL e cleanup de conexão, recheck imediato, resposta perdida/diagnóstico seguro/sem retry, drift pós-write e multipart real. Portas externas são controladas; não são publicação sintética em cloud.

Preflight externo só-leitura já passou: DBpreview schema/ACL/cota/limites e outbox0/claims0/journal0; fila principal0 e DLQ1/28bytes; baseline/ingresso/configuração esperados. A execução final ainda repetirá essas leituras. Verificação final pós-fix: frontend383/383 em74arquivos, operadores49/49, exit0/zero fails/skips. Avisos prévios de React Router/Dialog nos testes de UI, nenhum código de UI alterado. Btestsexit0 (48unitários/3PGskips pela suíte padrão), typecheckexit0; PG real anterior não reexecutado. API/prod runtime não alterados.

Nenhuma publicação remota executada neste checkpoint. Readiness global, frontend/navegador, writers externos, CPU8MiB/bootstrap/recuperação, produção/main e etapas14–19 continuam separados; catálogo7/10/Etapa13 abertos.
