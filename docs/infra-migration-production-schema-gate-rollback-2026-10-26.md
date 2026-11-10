# Gate do schema production: rollback confirmado — 26/10/2026

## Estado externo atual

**009–012 e seus grants production NÃO ficaram aplicados.** A tentativa única autorizada iniciou às21:07:30 de São Paulo (`2026-10-27T00:07:30.169Z`); os oito arquivos executaram dentro da transação, mas o verificador interrompeu antes de COMMIT. O operador confirmou ROLLBACK, `migrationsApplied=0`, `statementsExecuted=8`, `committed=false`, `commitUncertain=false`. Não restaurou backup nem fez retry.

Novo processo somente-leitura às21:09:28, snapshot21:09:35, confirmou os20tables da aplicação/Auth todos vazios e o mesmo fingerprint amplo do baseline/backup24/10: `64ef36fbc2ce6cc263aa9596e9b67a2cf4136fdb16b850c428bc648800a7e096`. Nenhum journal/revisions de catálogo, efeitos/leases/transações preparadas, outra conexão ou lock de aplicação. Cota216000segundos e endpoint0,25CU preservados; TLS1.3 validado, transação READ ONLY encerrada com ROLLBACK/conexão fechada.

GET-only independente às21:13:58 confirmou **API503, fila pausada e cron removido**, mesmos deployments/versions de API/web/Bproduction, CPU1000ms, bindings, secrets por metadados, source hashes e ingresso intactos. Backlogs principal/DLQ aproximados0; retenção86400s continua correndo. Não houve publicação tenant, abertura de tráfego, retomada dos consumidores, alteração de DNS/main, push, novo serviço/plano ou credencial.

## O que a tentativa realmente comprovou

Antes da execução dos oito arquivos: manutenção e consumidores fechados, identidade Neon/branch/database/owner/capacidade conferida; hashes de backup/restauração/ensaio e fontes SQL aprovados; lock ACCESS EXCLUSIVE adquirido nas20tabelas, fingerprint/contagens revalidados sob locks, pg_read_all_stats=true, zero outras conexões/efeitos/transações preparadas. A barreira existiu dentro da transação; não foi um certificado global de quiescência HTTP/WS.

Auditoria GET-only anterior sobre os bytes realmente publicados, hash`3ade3b1d…`, confirmou uma classe legacy RestaurantRealtime,17métodos e duas consultas SELECT de validação de grants. Chamadas da classe revisadas: tickets/sockets/SQLite/cleanup, sem executor de comandos de negócio do catálogo. Classe/binding de catálogo ausentes em production. Isso não enumera storage remoto nem afirma que todos os sockets/alarmes estavam vazios.

## Diagnóstico do verificador

A etapa registrada da falha é `integrity_effective_permissions`; o callback original não reteve uma subetapa ou SQLSTATE interno no recibo. Não inventar retrospectivamente uma subetapa ou afirmar que todas as verificações seguintes passaram.

Foi encontrada uma incompatibilidade concreta e suficiente para impedir esse callback: ele usa `SET LOCAL ROLE vapt_api_production` a partir de uma sessão autenticada como`neondb_owner`. Na sessão real READ ONLY, `pg_has_role(current_user,'vapt_api_production','SET')=false`, e a tentativa de SET ROLE retornou **42501**, revertida ao savepoint. Nenhum GRANT de membership, elevação da role, troca/reset de senha ou novo token foi feito.

O ensaio24/10 usou sessão local originalmente superuser e apenas `SET LOCAL ROLE neondb_owner`: isso conserva a autoridade do session_user para outro SET ROLE. Portanto não simulava essa restrição real de autenticação do Neon. Esse foi um limite do ensaio/verificador, não uma justificativa para tornar a aplicação administradora. A [documentação PostgreSQL18](https://www.postgresql.org/docs/18/role-membership.html) distingue membership com opção SET da mera capacidade administrativa.

## Correção local preparada, ainda sem nova aplicação

APIrepo: `scripts/production-tenant-permissions.mjs` verifica permissões efetivas de`vapt_api_production` usando as funções nativas PostgreSQL`has_table_privilege`, `has_column_privilege`, `has_schema_privilege`, `has_sequence_privilege` e`has_function_privilege`. Não usa SET ROLE, GRANT, REVOKE, ALTER ROLE ou credencial administrativa da aplicação. Valores NULL/ausentes não são interpretados como negações válidas.

Exige cinco capacidades de leitura e USAGE do schema; recusa os nove poderes indevidos já definidos; valida role LOGIN sem flags administrativas/memberships e as quatro rotinas SECURITY DEFINER com search_path fixo, EXECUTE da aplicação e sem EXECUTE PUBLIC. O teste de sessão inválida executa a rotina sob owner dentro de savepoint sempre revertido: distingue explicitamente essa prova de autenticar como aplicação. O contrato do operador agora registra `permissionMode=effective_acl`/`allowedReadChecks`, sem chamar esses checks de leituras executadas como app.

Nova conexão autenticada com a role real da aplicação continua uma prova distinta para o gate de promoção. Não remover checks para fazer o gate passar, nem usar metadata como se fosse essa autenticação.

- RED26 por operador ausente→GREEN; regressão de contagem de migrations revertidas RED→GREEN; journal real ausente RED→GREEN:28testes do núcleo.
- Verificador sem troca de role ausente RED21→GREEN21; contrato do núcleo atualizado RED3→GREEN. Total específico49/49.
- Suíte completa final de operadores433/433, API704/704, zero falhas/skips. Compilação TypeScript exit0 nesta preparação; não houve alteração do runtime da API.
- O operador não marca statements revertidos como migrations aplicadas. COMMIT incerto continua sem retry ou alegação de rollback confirmado; falha do recibo após COMMIT não é descrita como rollback.

Prova estreita adicional em PostgreSQL18.6 local, iniciada21:15:53: conexão real autenticada como owner **não-superuser**, sem membership SET na aplicação, reproduziu42501. O verificador corrigido passou nesse contexto e recusou três ampliações deliberadas somente no fixture (UPDATE da coluna de organização, UPDATE de sequência e EXECUTE PUBLIC). Tudo local, sem requisição remota, restauração de backup ou replay de009–012; o servidor foi encerrado, diretório de prova retido. Rotinas sintéticas do fixture verificam apenas ACL/search_path/savepoint/P0401, não repetem nem substituem a prova do código canônico de onboarding. Resultado `production-permission-verifier-local-proof-2026-10-27T00-15-53-406Z.json`, exit0/ok=true/localServerStopped=true.

## Marcador consumido: não repetir

Preservar `production-schema-009-012-v1-start.json` e`.locked_baseline_confirmed.json`. Não existe recibo de commit_attempt/commit_confirmed; o marcador principal impede replay mesmo após rollback confirmado. Não apagar/renomear ou alterar a data para tentar novamente.

O lançador consumido continua com seus pins originais; não foi modificado ou relançado para contornar o bloqueio. Uma nova tentativa exige decisão explícita após este diagnóstico, lançador fixado ao contrato corrigido e journal separado deliberadamente autorizado, mantendo o primeiro como evidência. Não é permissão para reabrir API/consumidores, publicar tenant, integrar main ou restaurar backup.

Recibo da tentativa: `production-schema-controller-2026-10-27T00-07-30-169Z.json`, SHA256`64c7933a439cb1072bc97360d44f706528a7717ea73474bab3c6618cb71bb325`. Confirmação SQL somente-leitura: `production-drain-readonly-2026-10-27T00-09-28-259Z.json`, SHA256`c691ab12dbb0e307a823e68d9a9d895f343b1d58a168e3db0dd1f616cb5a74d4`. Readback Cloudflare: `production-window-independent-2026-10-27T00-13-58-397Z.json`. Artefatos no workspace ignorado deste plano; nenhum contém credenciais.

Core executado foi fixado SHA256`1c2fd8beb3479735d58822b9d968b2f8dffa438a716305cbe082eb78d7882fdc`; lançador executado SHA256`8c610beb28936a1385f33aa56790f52bd9ba6174b3ac8111fd01845b0eaac9a7`. A correção local altera o contrato do core; não confundir seu hash posterior com o executado. Etapa13/catálogo formal7/10 continuam abertos.

Checkpoint API local`d12725a`: somente os quatro arquivos novos do operador/verificador e seus testes; sem push, alteração de runtime ou nova tentativa remota.
