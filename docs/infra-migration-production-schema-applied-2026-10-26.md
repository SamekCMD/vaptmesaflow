# Schema de produção009–012 aplicado — 26/10/2026

## Estado vigente

**Produção agora tem o schema009–012 e os quatro grants próprios de production, com COMMIT confirmado e conferência independente aprovada.** Este registro substitui o estado pré-DDL dos relatórios anteriores de26/10. O rollback da tentativa v1 continua verdadeiro como histórico; não é o estado atual do banco.

**A manutenção continua:** API503, entrega da fila pausada e cron de billing vazio. Ainda não foram publicados os candidatos tenant de API/billing/frontend, ativadas flags de catálogo ou liberado tráfego. Não reabrir automaticamente a API owner-only ou o consumidor legado sobre o schema novo.

## Autorização e execução única v2

O usuário respondeu “continuar” ao pedido explícito de uma nova tentativa única das migrations009–012 com o verificador corrigido, mantendo a manutenção. Isso autoriza este gate de banco, não publicação, retomada, main/DNS, recursos adicionais ou contratação.

Lançador próprio `production-schema-effective-acl-v2-controller.mjs`, SHA256`99752fba375935a1490ff240fb7a3785303052bebcf388498cbb723c5c7de2a7`. Ele exige o recibo v1 de rollback confirmado pelo hash, ambos os arquivos do journal v1 e ausência de seus recibos de COMMIT. Preservados sem alteração o controlador e os registros anteriores. Core/verificador API`d12725a`, com os mesmos oito arquivos SQL/hash já ensaiados; não foi concedida membership SET nem ampliada a role para contornar o diagnóstico.

Preflight somente GET às21:22:17 passou. Execução `--apply` iniciada às21:22:44 (`2026-10-27T00:22:44.904Z`), encerrada exit0/ok=true, sem estado incerto. Fases do novo journal:

| Fase | UTC27/10 | São Paulo26/10 |
| --- | --- | --- |
| Marcador exclusivo criado |00:23:02.079 |21:23:02 |
| Baseline sob locks confirmado |00:23:11.644 |21:23:11 |
| COMMIT iniciado |00:23:21.946 |21:23:21 |
| COMMIT confirmado |00:23:21.987 |21:23:21 |
| Último readback de manutenção do controlador |00:23:31.379 |21:23:31 |

Uma transação READ COMMITTED, locks ACCESS EXCLUSIVE nas20tabelas existentes, lock_timeout5s/statement_timeout15s/transaction_timeout120s. Antes de DDL: identidade do projeto/branch/endpoint/database/owner, TLS1.3 autenticado, backup/ensaio/fontes SQL fixados, quota216000segundos, endpoint min=max0,25CU, fingerprint amplo64ef… igual ao backup e20tabelas com0registros, pg_read_all_stats=true, zero outras conexões/efeitos/transações preparadas. A barreira foi transacional, não uma declaração de quiescência global HTTP/WS.

Executados atomicamente:

- `009_public_catalog_publication.sql` e `009_worker_production_catalog_grants.sql`;
- `010_tenant_foundation.sql` e `010_worker_production_tenant_grants.sql`;
- `011_organization_billing.sql` e `011_worker_production_billing_grants.sql`;
- `012_tenant_onboarding.sql` e `012_worker_production_onboarding_grants.sql`.

Antes de COMMIT: verificadores versionados de tenant/billing aprovados, cinco capacidades de leitura e nove negações avaliadas pelas funções nativas de privilégios, role LOGIN sem flags administrativas/memberships, quatro rotinas privilegiadas restritas e sessão inválida P0401 em savepoint revertido. O modo registrado é`effective_acl`: não confundir essa etapa com autenticação como aplicação. Hash/contagens atuais e controles de manutenção foram reconferidos antes de COMMIT. Nenhum retry.

Pós-COMMIT na mesma conexão, mas em nova transação READ ONLY:30tabelas vazias e fingerprint esperado. Depois, conexão encerrada e referências de credenciais descartadas; não houve SQL de seed, efeito de provedor ou bootstrap sintético.

## Confirmação independente em novo processo

Às21:24:26, `production-schema-v2-postflight-readonly.mjs` concluiu exit0/ok=true usando apenas GETs do Neon e transações READ ONLY. Verificou novamente capacidade/identidade e o journal de COMMIT. Conexão owner com session_user e current_user iguais a`neondb_owner`, TLS1.3 validado; schema e verificadores versionados aprovados. Encerrada essa conexão antes de abrir outra com a credencial **já existente** de`vapt_api_production`, recebida por GET do Neon somente em RAM, sem criação ou rotação.

A segunda conexão autenticou realmente como`vapt_api_production`: session_user=current_user, READ ONLY, TLS1.3. Role sem superuser/createdb/createrole/replication/bypassrls e sem memberships. Cinco SELECTs reais em organizations, organization_members, organization_subscriptions, catalog_publication_operations e onboarding_intents retornaram0linhas. SELECT do payload privado de payment_effect_outbox foi negado com42501, em savepoint revertido. Ambas as conexões foram encerradas; nenhuma credencial foi gravada em arquivo/env/Git/log/argumento.

Fingerprint canônico atual: `b28390b5839143e11b99d9c82b427fc44f3b11aaadd237f8f8731cd0a32294fe`, exatamente igual ao ensaio local aprovado. Componentes:356colunas,397constraints,91índices,23rotinas não extensionais,31relações (30tabelas e sequência),19triggers,0policies,0enums,2schemas e2defaultACLs. Todas as30tabelas da aplicação/Auth vazias. Sem criação de contas/restaurantes apenas para forçar bootstrap.

## Cloudflare continua fechada e inalterada

Outro processo GET-only às21:24:25 terminou exit0 e confirmou:

- API production deployment`4fe1dde4-18c9-4423-9cb6-23800e164172`, version`29a56753-88c3-4ca1-bb9b-6118a228f195`,100%; wrapper503/no-store/Retry-After60 e hashes do original/wrapper intactos.
- CPU1000ms, oito secrets por metadados, Hyperdrive/R2/namespace realtime/rates preservados; workers.dev/preview desativados, sem cron API e sem novo binding de catálogo.
- Fila production`69f033ad5eb6424c99b41d1baa7ff3ad` pausada, consumer/settings/producer/DLQ intactos, cron Bproduction vazio. Backlogs principal/DLQ aproximados0; retention86400s segue correndo durante a pausa.
- Web continua deployment`24d1b0fc`/version`e77339dd`; Bproduction deployment`da2a4249`/version`1f578bc6`, ambos legados. Não retomá-los como se já fossem o par canônico.

Nenhuma escrita de controle Cloudflare, deploy, flag, novo recurso/secret/plano, mudança de DNS/main, push/merge ou desligamento de servidor nesta execução. Alias genérico de deploy permanece bloqueado. Os49testes específicos foram executados novamente nesta preparação; as suítes completas433/704 e a prova PostgreSQL não-superuser são evidências da correção anterior, não execuções novas fictícias.

## Registros fixos e próximo gate

Preservar o marcador `production-schema-009-012-effective-acl-v2-start.json` e os três registros locked_baseline_confirmed/commit_attempt/commit_confirmed, além de todos os registros v1. **Nunca repetir009–012, apagar/renomear marcadores, executar o lançador v1/v2 novamente ou restaurar automaticamente o backup24/10 sobre o schema atual.** O diagnóstico antigo que compara produção ao baseline64ef… agora é histórico; uma divergência dele não indica migration faltando.

| Artefato próprio no workspace ignorado | SHA256 |
| --- | --- |
| `production-schema-effective-acl-v2-2026-10-27T00-22-44-904Z.json` |`abb42da0fbc460b413aedb21d1c17fdd275c87e9c7dc86828aaa8dd3d21ec705` |
| `production-schema-v2-postflight-2026-10-27T00-24-26-189Z.json` |`6c1da579f16060d0d256ff91efcbc553ae13f117f5750b6187c3524a2b10b0e1` |
| `production-window-independent-2026-10-27T00-24-25-748Z.json` |`afaad12f3d20a1a8b5be3d1e12e878469eea805c9fb5c3fc7bc77870d70c4313` |

Próximo: preparar/publicar o par compatível API tenant + billing canônico + frontend, inicialmente ainda sob manutenção e com flags de catálogo false. Conferir artefatos e delta de recursos antes do gate próprio: a configuração candidata da API adiciona PUBLIC_CATALOG_BUCKET/COORDINATOR e migration da nova classe, ausentes no Worker atual. O template Bproduction contém cron`*/30 * * * *`; não publicar esse template cegamente e religar cron durante a preparação. A restauração futura deve manter fila pausada/cron vazio até consumidor compatível, testes e decisão de liberação. Não promover frontend isoladamente nem confundir push em main com deploy da API de outro repositório.

Este gate conclui a aplicação e validação do schema production. Não conclui Etapa13, bootstrap/ativação de catálogo, estabilidade/aposentadoria de legado ou integração das branches. Catálogo formal7/10 permanece aberto até seus demais critérios de aceite.
