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
