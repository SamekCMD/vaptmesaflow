# Backup e restauração de produção — 24/10/2026

Backup real concluído entre **15:32:58 e15:33:20 de São Paulo** (`18:32:58.834Z`–`18:33:20.788Z`). Exportação somente-leitura de produção; restauração exclusivamente em PostgreSQL local descartável. Nenhuma migration/grant remota, publicação, flag, DNS, push ou merge.

## Alvo e proteção

Projeto existente `dawn-morning-27332079`, branch production `br-odd-term-b6j2n9ms`, endpoint direto `ep-holy-wildflower-b6vtv1dd`, database `vapt`, role `neondb_owner`. GETs do CLI instalado confirmaram quota216000segundos ponderados e endpoint fixo0,25→0,25CU. Nenhum recurso ou plano novo; a operação usa o compute contratado, não significa custo zero ou teto global de fatura.

Cliente `pg` com certificado validado (`rejectUnauthorized:true`, socket encrypted/authorized, TLSv1.3), startup `default_transaction_read_only=on` e transação REPEATABLE READ READ ONLY. `pg_dump18.6` contra servidor18.6, conexão direta `sslmode=verify-full` com CA instalada. Snapshot exportado mantido aberto durante o dump, depois ROLLBACK e conexão encerrada.

Credencial obtida por GET do CLI apenas em RAM. Senhas remota e local entregues aos utilitários por **named pipes de uma conexão**, sem valor em argv, variável de ambiente de segredo, `.env` ou arquivo de credenciais. O ambiente do filho recebe somente o caminho não secreto `PGPASSFILE`. O mecanismo foi comprovado primeiro em PostgreSQL local com autenticação SCRAM; não foi enfraquecida a autenticação para fazê-lo passar. O [formato e seleção do passfile são documentados pelo PostgreSQL](https://www.postgresql.org/docs/18/libpq-pgpass.html); o uso do pipe foi verificado com os executáveis18.6 instalados, não presumido como garantia para qualquer plataforma.

Pasta específica criada e ACL conferida **antes do dump**: somente usuário atual e SYSTEM, sem herança externa. Conferência posterior de2444 entradas, incluindo os dois clusters locais e o arquivo, encontrou0 ACLs fora desses titulares. Isso é controle de acesso local, **não afirmação de criptografia, cópia externa ou recuperação após perda deste computador**.

## Arquivo e prova de restauração

Arquivo ignorado pelo Git:

`D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/production-backup-2026-10-24/production-before-009-012.dump`

- Custom format, assinatura `PGDMP`, **108972bytes**.
- SHA256: `59b9980259e3ad7c0b810e69711b3a577f2da0134e6f9119fe4a10881333fa3b`.
- `pg_restore18.6 --single-transaction --exit-on-error`, sem suprimir owners ou ACLs.
- Roles globais necessárias recriadas **só localmente** como placeholders NOLOGIN, sem privilégios administrativos: `cloud_admin`, `neon_superuser`, `neondb_owner`, `vapt_api_production`. Nenhuma senha ou atributo administrativo remoto copiado.
- Origem e restauração: **20tabelas de aplicação/Auth, todas0linhas**;282colunas,273constraints,67índices,12rotinas não pertencentes a extensão,20relações/ACLs,9triggers,2schemas/ACLs e2entradas de default privileges;0policies e0enums.
- Hash do vetor canônico conferido nos dois lados: `64ef36fbc2ce6cc263aa9596e9b67a2cf4136fdb16b850c428bc648800a7e096`. Inclui definições, owners, ACLs, defaults, triggers e configurações RLS das relações listadas. É um vetor mais amplo que o de22/10: **não comparar os hashes de algoritmos diferentes para alegar drift ou ausência dele**.
- Novo verificador local independente releu resultados/dump, comparou hashes e contagens e confirmou ausência de `postmaster.pid` e shutdown nos logs dos **dois** clusters deste gate. Ambos encerrados; diretórios e logs protegidos preservados, não serviços Windows.
- SHA256 do resultado: `9b3cc25bc2d0d34b2fe53f4210bed635150764b2eeca91ff221a2cfe00816f34`.

## Ensaio local dos oito SQLs — aprovado

Às15:37:54–15:38:02 São Paulo, **sem nova exportação, CLI cloud ou conexão remota**, o mesmo dump foi restaurado em um terceiro cluster local. O fingerprint da baseline coincidiu antes de qualquer alteração.009→grant009→010→grant010→011→grant011→012→grant012 foram ensaiados com os arquivos próprios de **production**, sem substituir role de preview.

Bytes/hashes fixados antes do ensaio. Uma transação externa, locks ACCESS EXCLUSIVE nas20tabelas, lock_timeout5s, statement_timeout15s e execução como `neondb_owner`. Somente os delimitadores externos únicos BEGIN/COMMIT foram removidos em memória; os arquivos versionados não foram editados. Commit **só local** confirmado.

| Arquivo | SHA256 |
| --- | --- |
|009_public_catalog_publication.sql|41a2621225454202616664e24c822c32707f5f0f72b15193dd66057202bc0591|
|009_worker_production_catalog_grants.sql|f9f55bf6de7d1c1dc7e6f258f05f3c8fcd7f500e823630d7a0ed8990632d1356|
|010_tenant_foundation.sql|db86e7a78f28d2d98c1e60480361ee79d2071a0d36b2a458e959def4a869e1ed|
|010_worker_production_tenant_grants.sql|02cfcbd52cd2a9b42df29a6627194b75279c79fb1b3262d328d0902e35781533|
|011_organization_billing.sql|c35edf2ae47642c3e4c22bb8b1999822dbbc503f00652a17bdcf3ed7d618547e|
|011_worker_production_billing_grants.sql|e85ac79968c04393fce12e6a55d3a6d3558f712aa92de7ccf529b1c3c2cced0c|
|012_tenant_onboarding.sql|bcf7ac85ad26d10b906a4495132386bfb78bd3ab3d1c7324a0150e3db52f9e2f|
|012_worker_production_onboarding_grants.sql|92fcb99111d8c4654557db8f000d32eb767a8a3029c8ecb57baf7ccedc6392a7|

Readback local:30tabelas/0linhas,356colunas,397constraints,91índices,23rotinas não pertencentes a extensão,31relações/ACLs e19triggers; vetor `b28390b5839143e11b99d9c82b427fc44f3b11aaadd237f8f8731cd0a32294fe`. Verificações versionadas tenant/billing passaram; quatro rotinas estreitas têm SECURITY DEFINER/search_path fixo/EXECUTE permitido à role de aplicação e negado a PUBLIC.

Permissões exercitadas por `SET LOCAL ROLE vapt_api_production` no cluster:5leituras permitidas;9operações negadas42501 (DDL, membership, entitlement, reassociação, INSERT direto de restaurante, UPDATE do journal, reset da sequência, contato de billing e TRUNCATE), mais onboarding sem sessão negadoP0401. Savepoints e ROLLBACK; fingerprint/contagens finais sem mudança causada pelos testes. Placeholder local NOLOGIN/nonadmin/sem memberships: **não é autenticação pela credencial de produção nem prova dos atributos atuais da role remota**. O verificador legado de ACL pré-tenant não foi aplicado como se descrevesse os grants novos.

Terceiro cluster encerrado. Backup original e resultado do export preservados sem alteração. Verificador independente local conferiu novamente os oito hashes versionados, todos os resultados, os três shutdowns e o hash do dump, exit0; SHA256 do resultado do ensaio `d1a2400615ccb8f0b560dd1816bd62b4d40b9fc1f32731c59c6ca9dd6d96d988`. A primeira execução desse verificador adicional usou um nível a mais no caminho relativo dos SQLs e parouENOENT, sem tocar bancos; corrigido para a raiz absoluta explícita e executado novamente com sucesso. Este ensaio não certifica runtime publicado, workload/CPU ou compatibilidade dos clientes/consumidores antigos.

## Diagnóstico local, limites e continuação

Primeira checagem interrompeu **antes de conectar ao Neon**: o PowerShell filho não carregou `Microsoft.PowerShell.Security` para `Get-Acl`. Uma reprodução isolada confirmou o erro. A mesma validação foi refeita pela API .NET `DirectoryInfo.GetAccessControl`, sem alterar ACL/regras; reprodução e ensaio local passaram. Relatório inicial preservado como falha, não sobrescrito. A exportação remota teve **uma tentativa**, com marcador exclusivo preservado; não repetir para produzir nova evidência.

Esta prova cobre o dump lógico e os objetos/contagens enumerados nesse snapshot, não R2, Durable Objects, credenciais globais, PITR histórico, todos os efeitos de provedores ou um drain contínuo de produção. O banco não foi migrado. Zero linhas nesse instante não autoriza aplicar SQL com escritores ativos depois.

Próximo passo seguro: preparar o gate pareado de admissões/drain, schema e versões API/B/F. **Não aplicar009–012 isoladamente enquanto clientes/consumidores antigos podem continuar escrevendo.** Aplicação remota e publicação continuam separadas; não repetir export, ensaio já aprovado, SQL do preview, canários fechados ou alterar main automaticamente. Catálogo formal7/10 e Etapa13 continuam abertos; a Etapa16 integral não é encerrada por um único backup local.
