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

Reader público e eventos permanecem desligados no último estado confirmado; a leitura pública ainda usa o caminho legado. Bootstrap não precisa criar restaurante artificial para preencher uma lista vazia. Subplano formal **7/10**, tarefas5/9/10 e Etapa13 continuam abertos; revisão/integração de branches e main seguem separadas. Sem promessa de zero consultas ou teto global de fatura.
