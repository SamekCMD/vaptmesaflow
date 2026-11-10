# Catálogo — preparação da prova de onboarding canônico, 05/11/2026

**Operador local preparado; onboarding remoto não executado.** O próximo teste precisa começar com uma identidade sintética sem organização/restaurante, e não com o restaurante completo usado nos testes de imagens. O onboarding legado `/onboarding` permanece aposentado; não foi recriado nenhum caminho de produto.

## Escopo implementado

API: `scripts/catalog-onboarding-probe.mjs` e seu teste. A função importável exige origem production fixa, ator/tag sintéticos, duas chaves de operação distintas, sessão em memória, transporte e preflight externos obrigatórios. Não tem CLI, fetch padrão, credencial R2, login, SQL, seed, cleanup, deploy ou alteração de flags. O controlador externo ainda precisa registrar a intenção e comprovar a identidade isolada antes de chamá-la.

O roteiro é limitado a doze requests: bootstrap vazio → criação de draft → replay deliberado da criação confirmada → leitura → gravação da etapa/canais/mesas → releitura → bootstrap ainda em onboarding → finalização pelo writer/protocolo1 → uma consulta de status → replay deliberado da finalização pronta → leitura do restaurante completo → bootstrap no dashboard. Os replays verificam deduplicação com a mesma chave e corpo; não são retries de respostas perdidas.

Uma resposta de finalização pendente permite uma espera limitada e uma única consulta de status. Se ainda não estiver pronta, o operador interrompe com o recibo preservado; nunca chama `/retry`, troca chave, inicia polling ou avança para a próxima escrita. Divergência de ator, seleção, organização, draft ou versão também interrompe. Versões int64 continuam strings, inclusive acima de 2^53. Falhas após possível mutação preservam `uncertain:true` e os IDs conhecidos para reconciliação, sem limpeza cega.

Prazos: cinco minutos globais; quinze segundos por request incluindo consumo do corpo; 64 KiB por resposta; pacing padrão de 3,3 segundos. Cancelamento interrompe também preflight, pacing, transporte, corpo e espera pendente não cooperativos. Resultados expõem apenas contagens, IDs e recibos seguros, sem cookie, DTO privado ou diagnóstico do provedor.

## Verificação realizada

- Baseline da API: **704/704** antes da implementação. A primeira tentativa foi impedida pelo sandbox (`spawn EPERM`), não por falha de teste; execução local com permissão para processos passou.
- TDD do novo operador: **36 falhas por export ausente → 36/36**. Nove casos adicionais elevaram a cobertura a 45; dois recibos impossíveis foram observados falhando e corrigidos: `accepted` marcado como committed e `projected` marcado como não committed. Resultado focal final **45/45**.
- Suíte completa de operadores: **729/729**, exit0, sem falhas, skips ou cancelamentos.
- Suíte completa da API: **704/704**, exit0, sem falhas, skips ou cancelamentos. Permanece o aviso experimental preexistente do SQLite do Node.
- Sintaxe dos dois arquivos e diff verificados. Fontes runtime da API inalteradas: árvore `src` SHA `b5914e9323b74215442c2afc5e0f356f2f904c8c`.

Transporte HTTP controlado nesses testes não é integração cloud. As transações PostgreSQL/onboarding já existentes são evidência de checkpoints anteriores; não foram repetidas nem declaradas como prova nova. Não houve alteração de aplicação, schema, dependências, recursos remotos ou dados reais, nem criação de chave temporária ou nova execução dos testes de imagem.

## Gates seguintes

Antes de uma execução real, preparar fixture somente de identidade, readback independente de draft/finalização/trial/journal/projeção e aposentadoria/cleanup específicos para a organização criada pelo próprio onboarding. Não reutilizar o seed de restaurante completo nem os controladores consumidos de imagens. A presença humana e a autorização operacional da nova janela devem estar resolvidas antes de iniciar qualquer prazo curto.

O roteiro atual não certifica retomada no navegador, unicidade do trial por leitura SQL, conteúdo R2 remoto, ausência pública do draft, quota de imagens ou recuperação de uma operação realmente pendente. Esses aceites não viram verdes por um transporte sintético. Não provocar indisponibilidade em produção para fabricar uma pendência.

## Fixture e aposentadoria ensaiadas em PostgreSQL real

Checkpoint local seguinte, ainda em05/11: criado `scripts/catalog-onboarding-fixtures.mjs`, com testes em `catalog-onboarding-fixtures.pg-integration.mjs`. O selector já existente `scripts/local-tenant-pg.mjs --only=catalog-writer` passou a incluir esses testes, sempre no workspace deste plano. Nenhuma migration, dependência ou fonte runtime foi alterada; nenhum projeto/branch Neon foi criado ou consultado.

A fixture exige URL owner production/TLS e manifesto marcado com identidade, conta e duas operationIds pré-alocadas. O seed grava **somente** Better Auth user/account, com senha aleatória/hash real; não cria sessão, organização, plano ou restaurante. O manifesto seguro não contém senha/hash. O controlador futuro continua responsável por guardar intenção antes do seed, manter a senha somente em memória e realizar login humano normal.

O ensaio compôs o operador HTTP de doze requests com as rotas Hono e serviços/applier PostgreSQL reais. Assim, draft, organização, membership, preferência, trial e journal nasceram pelo caminho canônico, não por seed de restaurante completo. A fronteira de autenticação foi controlada com sessão sintética real no PostgreSQL; persistência do coordenador e R2 foram adaptadores controlados. Isso não é integração remota, teste workerd/SQLite nem login Turnstile real.

`inspectOnboarding` usa repeatable-read READ ONLY para reconciliar a propriedade exata, os dois intents/fingerprints, preferência, uma sessão ativa, trial de três dias no mesmo instante da conclusão, DTO público SQL completo, snapshot/journal e revisão única. Não lê ou escreve R2. Esse ensaio acrescenta prova **local** de trial/readback; não substitui a prova remota que a seção anterior mantinha aberta.

`retireOnboarding` exige recibo pronto/replays confirmados, logout401 e zero sessões. Repete guards sob locks de organização/restaurante/identidade; efeitos inesperados impedem a primeira escrita. Confere três objetos conhecidos contra SQL e aplica somente dois CAS: tombstone do slug e fence do snapshot. Preserva o manifesto válido para trabalho tardio do coordenador. Só depois dos readbacks retira journal/revisão, dois intents, preferência e a organização/restaurante exatos. Nova transação confere resíduo zero. A identidade é removida separadamente, após comprovar ausência de sessão, domínio e conta OAuth adicional. Nunca apaga item/pedido/imagem nem limpa respostas incertas por cascata.

Respostas perdidas de seed, CAS ou COMMIT ficam explicitamente incertas; não há retry, troca de IDs ou limpeza cega. A tentativa de aposentadoria fica consumida no driver mesmo em falha. Um futuro controlador deve drenar requests e fornecer transporte R2 concreto que respeite os sinais/deadlines; a fixture não autoriza iniciar uma janela remota.

### Evidência desta passagem

- RED inicial: **82 casos anteriores passaram e17 novos falharam por export ausente**. A confirmação isolada do export também falhou antes de acessar banco.
- Primeira implementação:98/99. O único erro foi na preparação do caso de billing: uma referência Stripe sintética sem a associação exigida pelo schema011. Corrigida somente a fixture, sem remover constraint ou mudar schema.
- Casos adicionais:108/109. O guard de assinatura ligada a outra organização parava após dois fences R2, embora revertesse SQL. Caso reproduzido e correção mínima: conferir todo o conjunto de assinaturas que referencia a identidade **antes** de R2.
- Resultado final: **109/109 PostgreSQL**, incluindo27 casos novos; **729/729 operadores** e **704/704 API**, todos exit0, sem falhas/skips/cancelamentos. O aviso experimental preexistente do SQLite do Node permanece na API.
- Confirmados: preservação de outro usuário/organização/restaurante e objeto R2 decoy; recusa de sessão viva, membership/intent/assinatura extra, item, trial alterado, CNPJ/dados SQL alterados, revisão/journal divergentes, billing, recibo estrangeiro e objeto ausente; perdas de CAS/COMMIT sem retry ou cleanup cego; limpeza de identidade sem domínio e recusa de OAuth extra.
- Sintaxe/diff verificados; quatro clusters locais encerrados, todos com `postmaster.pid` ausente. Fontes `src` continuam nos hashes API `b5914e9323b74215442c2afc5e0f356f2f904c8c` e frontend `abf974816819797ba8ef88ec1edd215e4c3580a0`.

Logs no workspace do plano: `onboarding-fixture-{pg-red,pg-green,guards-red,pg-final,final-operators,final-api}-2026-11-05.log`. Não foi iniciado processo remoto, login real, prazo de emissão ou chave R2. Controladores/recibos consumidos de imagens não foram editados nem repetidos.

Próximo: compor o controlador limitado de onboarding com esta fixture, readback R2 e gates atuais; revisar o workflow antes de qualquer janela real. Recuperação de operação realmente pendente e reader/eventos continuam separados. Não marcar tarefas5/9/10 completas por este ensaio.

Reader público e eventos permanecem desligados no último estado confirmado; a leitura pública ainda usa o caminho legado. Bootstrap não precisa criar restaurante artificial para preencher uma lista vazia. Subplano formal **7/10**, tarefas5/9/10 e Etapa13 continuam abertos; revisão/integração de branches e main seguem separadas. Sem promessa de zero consultas ou teto global de fatura.

## Composição do novo gate e controlador

Preparado `scripts/catalog-onboarding-gate.mjs` e testes, sem alterar runtime. O gate usa a fixture somente de identidade, login Better Auth normal protegido, o probe canônico de doze requests, readback SQL ativo, logout/401, aposentadoria exata e limpeza de identidade. Manifesto e resultado aceitos têm formato fechado; campos privados inesperados não entram no journal/recibo. Senha, desafio, cookie e chaves ficam em memória e são descartados. Falha de journal não suprime logout ou revogação, mas impede sucesso. Seed e mutadores são drenados mesmo no cancelamento, sem encerrar o pool enquanto a transação ainda trabalha.

Há dois perfis novos, aditivos: coletor write-only de duas chaves S3 nomeado para onboarding e store restrito a um restaurante/slug/revisão. O perfil novo de revogação registra `{revoked,attempted,status}`; apenas403 confirma a prova assinada.401,404,200 e falha de transporte continuam sem confirmação. Contratos históricos não foram relaxados, controladores consumidos não foram reexecutados e recibos antigos não foram retocados. A revogação humana anterior permanece separada da prova assinada que o recibo antigo não certificou.

O novo controlador one-shot está no workspace local do plano, `production-catalog-onboarding-v1-controller.mjs`. `check` é exclusivamente offline; `run` exige terminal interativo, marcador exclusivo ainda ausente, autoridade operacional específica e humano presente. Confere dezesseis fontes fixadas, evidência anterior imutável, runtime sem alterações e preflights atuais de deploy/flags/CPU/TLS/banco antes de mutar. Registra IDs antes do seed. A sequência é desafio humano → confirmação de emissão → coletor privado → confirmação ativa de início. Não há adoção de chave existente, recover, retry automático ou troca de alvo. Token futuro: `vapt-catalog-production-onboarding-2026-11-05`, somente Object Read & Write no catálogo production, validade provider24h, uso local30min/trabalho20min e revogação ao encerrar.

### Revisão única e passagem de correção

Uma revisão fresh-context, somente leitura, do workflow completo encontrou dois Important: efeitos SQL relacionados não contados antes do primeiro fence e espera potencialmente infinita por conexão PostgreSQL sem resposta. Nenhum Critical confirmado. Não foi uma revisão global de merge, e não houve outra rodada de revisor.

Correção SQL: o guard agora inclui push subscriptions, OAuth de pagamento, eventos de pagamento/webhook, feedback e eventos de billing pela referência de restaurante também. Os mesmos efeitos entram no resíduo final. Casos PostgreSQL exigem zero fences/deletes e preservação integral de cada registro inesperado. O primeiro RED mostrou cinco falhas de guard e um erro na preparação do caso feedback; o restaurante estrangeiro desse caso precisava estar completo para criar o pedido. Corrigido somente o preparo do teste; um novo RED confirmou a falha de guard de feedback, sem alterar schema ou remover constraint.

Correção de transporte: cada query do operador tem prazo local de15s além dos limites de conexão10s, statement8s e lock2s. Expiração ou erro de transporte remove o cliente com destruição do socket ativo; queries posteriores/rollback nesse cliente falham localmente e não há reconexão automática. COMMIT sem confirmação permanece incerto. Assim o gate pode chegar à revogação independente e persistir o resultado, sem abandonar um mutador numa conexão ainda utilizável. O cliente é do `pg` já instalado, sem dependência nova.

Minor adiado: resposta `projected` seguida de `committed` na mesma versão pode substituir o recibo mais forte antes de parar em pending. Não libera nova escrita nem limpeza; permanece uma limitação explícita de preservação de evidência para ajuste posterior. Não foi incluído na passagem de correção dos Important.

### Verificação desta composição

- Gate16/16; perfis coletor/S3 35/35; controlador offline10/10. TDD observado antes das respectivas implementações; três regressões adicionais impediram manifesto/readbacks de vazarem campos inesperados.
- Transporte5/5, cobrindo BEGIN, INSERT, COMMIT, ROLLBACK e limpeza travados. Os quatro casos iniciais falharam por ausência do prazo local antes da correção. O teste de limpeza compõe o driver real com o gate e confirma que a revogação é alcançada.
- Suítes finais completas: operadores **757/757**, API **704/704**, exit0, sem falhas/skips/cancelamentos. Permanecem seis avisos experimentais preexistentes do SQLite do Node na API.
- PostgreSQL final **116/116**, exit0, sem falhas/skips/cancelamentos. Inclui seis casos adicionais de efeitos inesperados e um cliente `pg` real com resposta TCP de COMMIT interrompida: a conexão foi destruída dentro do limite, o seed realmente committed permaneceu no banco como incerto, sem ROLLBACK/retry/cleanup cego. A primeira montagem desse ensaio apontava o proxy para si mesmo e falhou antes da identidade; corrigido somente o teste, reexecutada a suíte completa. Quatro clusters desta composição encerrados, todos com `postmaster.pid` ausente. Isso é prova loopback local, não integração Neon.

Fontes runtime continuam inalteradas. O controlador novo fixa a fixture corrigida SHA `cac655264e5c246cd00ec54aae790a93eec15f81ebafa9f0ec3d30535fe696c2`; seu próprio SHA é `fde34b5b10484692507fdbb2fc59321efc774243fb9c4a723b7c117ff0395e81`. O check offline final passou com16 fontes, `startAvailable:true`, zero chamadas remotas/listeners. Sintaxe e diff conferidos. Logs finais: `onboarding-window-final-{operators,api,controller}-2026-11-05.log`, `onboarding-review-pg-final-2026-11-05.log` e regressões RED/GREEN no workspace do plano.

Ainda não houve janela onboarding remota, nova chave, login real, deploy, flags, billing, schema, DNS, main ou push. O próximo gate continua exigindo disponibilidade humana e autorização específica antes de qualquer prazo curto. Nenhum resultado local fecha recuperação realmente pendente, reader/eventos, integração de branches ou a migração inteira.

## Execução remota de06/11 — prova funcional passou, janela encerrada

O usuário retomou a janela adiada, preparou o formulário restrito sem emitir a chave e concluiu o Turnstile antes da emissão. As verificações atuais Cloudflare/Neon passaram sem alteração de configuração: deployments/fontes esperados, catálogo privado, CPU1000ms, writer ligado/reader desligado, limites de compute já existentes, integridade/grants e duas sessões TLS1.3 READ ONLY. O controlador revisado foi executado uma única vez, sem alterações de fonte durante a janela.

O fluxo real criou apenas a identidade por fixture; organização, restaurante e trial nasceram pelos endpoints canônicos. Passaram os doze requests do probe, incluindo criação/leitura/gravação do draft, seleção de conta, finalização e replays deliberados confirmados das mesmas duas operações. A publicação chegou a `ready`, versão string `16`. O readback SQL verificou os dois intents, propriedade, trial de três dias, journal/revisão e snapshot correspondente. O login usou o desafio humano normal, sem bypass de autenticação.

Logout/401 confirmado, aposentadoria SQL/R2 e limpeza de identidade passaram: zero journal/revisão/intents após a retirada; dois CAS de proteção no slug/snapshot, preservando o manifesto previsto. Estado de fixture `uncertain:false`, `cleaned:true`, `sessionRevoked:true`. Foram quatro requests de autenticação. Não houve email, pagamento, schema, deploy, flags, billing, DNS, main ou push.

O resultado global permaneceu **`ok:false`**: quando a confirmação humana de revogação chegou, o controlador já estava encerrado e não aceitou `confirm-revoked`. Portanto o recibo original continua com `credentialUiRevoked:false` e `credentialRevoked:false`, sem readback assinado nem status HTTP registrado. O usuário confirmou que excluiu somente `vapt-catalog-production-onboarding-2026-11-05` e verificou sua ausência. Essa confirmação posterior foi registrada separadamente, sem modificar o recibo original, inventar403 ou criar outra chave para repetir a prova.

Recibo imutável: `production-catalog-onboarding-v1-2026-11-06T18-26-37.422Z.json`, SHA `f7d9e44d339b0285c98914b8bc0feb445323e92cdb915a64ebd1e890dd289e56`. Complemento: `onboarding-window-result-reconciliation-2026-11-06.json`, no workspace do plano. Processo encerrado; portas53301 e57876 confirmadas fechadas, chaves em memória descartadas. Não há ação humana de cleanup pendente nesta janela. A ausência do readback assinado continua uma limitação explícita da evidência, não um motivo para repetir onboarding ou emitir chave nova.

Esta execução não certifica retomada visual do onboarding no navegador, ausência pública do draft ou recuperação de operação realmente pendente; tampouco ativa reader/eventos. A prova funcional canônica e do trial remoto avançou, mas o subplano formal7/10, tarefas5/9/10 e Etapa13 continuam abertos pelos demais aceites. Nenhuma suíte foi repetida por esta atualização somente documental;757/704/116 acima permanecem o checkpoint local anterior.
