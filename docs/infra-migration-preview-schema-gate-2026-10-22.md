# Gate SQL preview — 22/10/2026

## Autorização e limites

Usuário autorizou backup local protegido, restauração em PostgreSQL descartável e, condicionada às provas, aplicação009–012 e grants versionados **somente no preview**. Alvo fixo: projeto`dawn-morning-27332079`, branch`br-rough-dew-b6ydeygb`, endpoint`ep-hidden-bird-b673zocn`, database`vapt`; conexão direta TLS verificada, nunca Hyperdrive/pooler para export/migration. Produção não é alvo de escrita. Não autoriza deploy, flags, bootstrap de catálogo, DNS/main ou recursos novos.

Orçamento aprovado preservado: cota de projeto216000 segundos ponderados/60CU-h por ciclo, endpoints existentes fixos0,25CU, suspensão no default do plano. Não representa teto monetário global. Ensaios seguintes são locais, sem compute/branch extra no Neon.

## Backup e restauração reais

- Arquivo custom-format`preview-before-009-012.dump`,108882bytes, SHA-256`30dd7e30103ca029121943a4ea609de1f999ee6e9c9e3b25acdc452c4f8e0d0a`.
- Pasta ignorada pelo Git:`D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/preview-promotion-2026-10-22`. ACL protegida somente usuário atual e SYSTEM; não foi afirmada criptografia em repouso nem backup externo. Primeira tentativa de Set-Acl bloqueada pelo sandbox, corrigida por execução local restrita antes de gravar qualquer dump.
- `pg_dump18.6` contra servidor18.6, conexão direta `verify-full` com CA instalada; senha somente em ambiente do processo-filho, sem argv, arquivo de credenciais ou saída. Snapshot exportado de transação REPEATABLE READ READ ONLY mantida durante export; ROLLBACK/conexões encerradas depois. Nenhuma escrita remota no backup.
- Snapshot:20tabelas de aplicação/Auth, todas0linhas. Fingerprint de282colunas/273constraints/67índices/12rotinas não pertencentes a extensão e suas ACLs/20ACLs de tabelas:SHA-256`9caa903f4fadab80052b4351eaf231e645c480f18cad47b00ceef3c493e65be6`.
- Restore local real sem suprimir owners/ACLs, em transação única com exit-on-error. Mesmos fingerprint e contagens; sete verificações versionadas da baseline/ACL passaram. Não é recuperação de produção, PITR histórico, R2/DO ou efeito Stripe/Resend.
- Primeiro restore local falhou por roles internas ausentes. O dump não inclui criação de roles globais: criados apenas placeholders locais NOLOGIN/nonadmin`cloud_admin`/`neon_superuser`/`neondb_owner`, sem copiar senha/atributos administrativos do Neon. Role de aplicação local limitada. Não descartar ACLs para forçar um PASS. Instâncias locais encerradas ao final de cada tentativa.

## Falha encontrada no ensaio e correção mínima

O backup real não contém o índice opcional`restaurants_owner_id_unique` da004. A010 ainda não implantada fazia DROP incondicional e falhou42704; a transação inteira da010 foi revertida localmente. Nenhuma migration remota havia sido tentada.

Regressão persistente em A`src/modules/tenancy/schema.pg-integration.ts`: baseline sem índice, backfill preserva owner, novo guard por organização impede segunda unidade Starter. RED1/1 falhou por índice ausente; GREEN1/1 passou após alterar somente a remoção para `DROP INDEX IF EXISTS` na010. O guard de capacidade permanece criado na mesma transação, com preflights de billing/orphans/limites intactos. Não recriar índice legado apenas para removê-lo, nem alterar001–009. A mudança não torna a migration inteira idempotente: não repetir após commit incerto.

Restore do mesmo arquivo e ensaio dos oito SQLs passaram. Ensaio adicional da sequência atômica também passou: locks ACCESS EXCLUSIVE nas20tabelas, limites de lock/statement e uma transação externa para009→grant009→010→grant010→011→grant011→012→grant012. Apenas os delimitadores externos únicos BEGIN/COMMIT de cada arquivo são retirados em memória; corpos SQL e hashes conferidos. Integridade tenant/billing e negação real42501 de INSERT em membership pela role limitada aprovadas.

## Manifesto aplicado no ensaio

| Arquivo | SHA-256 dos bytes locais |
| --- | --- |
|009_public_catalog_publication.sql|41a2621225454202616664e24c822c32707f5f0f72b15193dd66057202bc0591|
|009_worker_preview_catalog_grants.sql|dadf5ad4a19c86ee3aef1490ac3bebe0375f72db66dbbb88e41393e6f6926ea5|
|010_tenant_foundation.sql|db86e7a78f28d2d98c1e60480361ee79d2071a0d36b2a458e959def4a869e1ed|
|010_worker_preview_tenant_grants.sql|323433489b6c0c08e2334c753767f99b02574d17e60b08fcc5135e6a66d74826|
|011_organization_billing.sql|c35edf2ae47642c3e4c22bb8b1999822dbbc503f00652a17bdcf3ed7d618547e|
|011_worker_preview_billing_grants.sql|66f009910287d399b9e9be5363d61d83c380063af76336409d8e279802713e91|
|012_tenant_onboarding.sql|bcf7ac85ad26d10b906a4495132386bfb78bd3ab3d1c7324a0150e3db52f9e2f|
|012_worker_preview_onboarding_grants.sql|92de08f476a3f01519d2521144ff773f2f660d5508346af097ba120831f2cf44|

## Situação deste checkpoint

Backup/restauração e ensaio local aprovados; aplicação remota ainda não realizada neste checkpoint. Suíte completa F383/383 e A701/701/build0 aprovados após a correção; gate PostgreSQL completo93/93/zero skips passou, incluindo a regressão nova e casos anteriores de concorrência, rollback, roles e outbox. Não houve publicação/flag ou escrita em produção. Guard de aplicação deve reconfirmar quota/identidade, Preview inerte writer/readerfalse, schema e dados iguais ao backup sob locks; divergência/timeout aborta, sem retry automático. Catálogo7/10 e Etapa13 permanecem abertos.
