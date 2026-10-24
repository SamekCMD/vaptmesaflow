# Bootstrap e preparação de produção — 24/10/2026

**Preview não tem carga inicial para executar:** leitura real confirmou zero restaurantes, itens e journal/revisions. Não foi criado restaurante de teste apenas para preencher essa etapa. Produção também está sem os dados agregados conferidos, mas ainda não tem as tabelas canônicas necessárias; não foi migrada ou publicada.

## Bootstrap: o que foi preparado

O CLI existente já exige restaurante explícito, sessão vigente e operationId preservado. Acrescentado no worktree API um transporte privado em memória, limitado ao preview e a **um GET de preflight + um POST de rebuild**, sem replay, polling, renovação de credenciais, arquivo/env/argv de secrets ou bypass de Access. Não é mudança na aplicação publicada.

20 testes novos:18 RED→GREEN na composição com o cliente real e proteções de URL/alvo/headers/ordem/sessão/operação/credenciais, mais dois testes HTTP reais em127.0.0.1 para leitura do body e cancelamento. Suítes finais **318/318 operadores,704/704 API**, zero falhas/skips; TypeScript, syntax e diff-check exit0. O teste HTTP local não é certificação de um apply remoto. Workerd/canários/migrations já encerrados não foram repetidos.

## Fotografias READ ONLY reais

Mesmo projeto `dawn-morning-27332079`, conexões diretas com `pg` existente, role `neondb_owner`, database `vapt`. Credencial obtida pela API GET através do CLI já instalado/autenticado, somente em RAM; sem `.env`, checkout/criação de branch, instalação/update de skill, role ou recurso. Transações REPEATABLE READ READ ONLY, timeout limitado, ROLLBACK e encerramento explícito. Nenhum DDL/DML/seed ou ativação.

| Ambiente / instante São Paulo | Branch / endpoint | Contagens |
| --- | --- | --- |
| Preview,24/10 às14:26 | `br-rough-dew-b6ydeygb` / `ep-hidden-bird-b673zocn` | restaurantes0, concluídos0, itens0, journal0, revisions0 |
| Production,24/10 às14:28 | `br-odd-term-b6j2n9ms` / `ep-holy-wildflower-b6vtv1dd` | restaurantes0, itens0, usuários0, sessões0, billingOutbox0, paymentOutbox0 |

Produção retornou ausentes os seis marcadores `organizations`, `organization_members`, `organization_subscriptions`, `account_preferences`, `catalog_publication_operations` e `catalog_publication_revisions`. É diagnóstico de existência e contagens selecionadas, **não fingerprint integral de schema/ACL, drain contínuo ou demonstração de que todos os dados/efeitos possíveis estão vazios**. Não reaplicar009–012 no preview. Produção precisa do seu gate pareado de schema/grants/código/consumidor/frontend antes de permitir as novas jornadas.

Nos dois endpoints, metadados atuais preservam0,25→0,25CU e quota conjunta216000segundos ponderados; nenhum ajuste de plano/cota foi feito. Esta quota não é teto global de fatura. A consulta pode consumir o compute já contratado; não foi prometido custo zero.

## Diagnóstico TLS e correção do verificador

As duas primeiras tentativas somente-leitura do preview interromperam antes de declarar sucesso: o verificador exigia `pg_stat_ssl.ssl=true`. A segunda acrescentou apenas etapa/código/identidade sanitizados e revelou database/role corretos, read_only=on, mas ssl=false. Os relatórios de falha foram preservados, sem tentativa de bootstrap ou retry de escrita.

O `pg` instalado cria um TLSSocket com SNI do host e mantém `rejectUnauthorized:true`. A verificação foi corrigida para o trecho realmente acessado pelo cliente: **encrypted=true, authorized=true, TLSv1.3**, nos dois ambientes. Não foi desativada a validação de certificado ou alterado o servidor. A hipótese de que o valor SQL descreve o trecho interno após o proxy, não o transporte do cliente, é compatível com a [arquitetura do proxy Neon](https://github.com/neondatabase/neon/blob/main/proxy/README.md) e foi tratada como interpretação, não prova de como todos os links internos estão configurados. A prova do trecho cliente é o socket autenticado, segundo a [documentação Node24.13 de TLS](https://nodejs.org/download/release/v24.13.0/docs/api/tls.html#tlssocketauthorized); a [política Neon exige TLS e suporta verify-full](https://neon.com/docs/security/security-overview).

Não registrar mensagens SQL/CLI cruas, certificados privados, URLs com senha ou tokens para diagnosticar esse caso. Nenhum serviço, schema, credencial, regra de rede ou configuração TLS remota foi alterado.

## Decisão e próximos gates

Bootstrap preview **sem carga nesta fotografia**, não “apply aprovado/executado”. Se novos restaurantes surgirem, é necessário enumerar/autenticar alvos explicitamente e voltar ao gate adequado; nenhuma autorização de publicação ou retry é inferida daqui. Produção sem restaurantes também não precisa de preservação de UUIDs ou seed para justificar bootstrap, mas continua sem schema canônico.

Próxima fronteira útil: backup protegido/restauração local e preparação de promoção pareada de produção, com controle de admissões/drain, SQL/grants versionados e API/B/F compatíveis. As versões antigas não podem ser confundidas com o candidato tenant. Schema/deploy/flags/main/DNS/desligamento de servidor não foram autorizados nem executados por esta consulta; não inventar aprovação automática a partir de contagenszero.

Os [canários de publicação e leitura](infra-migration-catalog-reader-canary-2026-10-24.md) continuam encerrados; Preview36/flagsfalse/CPU1000 é o último estado Cloudflare verificado, sem nova consulta Cloudflare nesta passagem. Coverage dos writers de domínio/imagem ativos e readiness/ativação de produção permanecem próprias; catálogo formal7/10/Etapa13 abertos.

Artefatos no scratch próprio do plano: verificador preview, seus resultados inicial/diagnóstico/verificado e verificador/resultado production. SHA256 preview verificado `c9f3260883f768a3ef3fbefa99c3d1b47dd3b6160b201b608056015fedbe1b76`; production `a01157cac8697954812ee8080a788635c6d7d915a740014047cb864c5693f5e2`. Resultados contêm só metadados e agregados, não dados de clientes/credenciais.
