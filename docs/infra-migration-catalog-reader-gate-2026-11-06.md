# Gate local de ativação/rollback do reader — 06/11/2026

## Entrega

Implementado `scripts/catalog-reader-publication.mjs`, com testes em `scripts/catalog-reader-publication.test.mjs`. É uma biblioteca de operação **offline**, sem CLI, transporte padrão, credenciais ou publicação autônoma. Não foi executada contra provedores.

O contrato segue a skill de execução de planos/TDD e o desenho já aprovado. Os operadores anteriores de writer não foram modificados nem desbloqueados.

| Direção explícita | Estado inicial obrigatório | Estado final esperado da API |
| --- | --- | --- |
| `activate` | writer=true, reader=false | writer=true, reader=true |
| `rollback` | writer=true, reader=true | writer=true, reader=false |

As duas direções têm a sequência serial manutenção HTTP → frontend compatível → API final. Cada publicação exige registro exclusivo de tentativa, confirmação por callback de verificação e registro de confirmação. Antes de reabrir a API, há uma nova conferência do par. Não há retry, resume, rollback automático, desligamento do writer, alteração de schema ou remoção de namespace.

O rollback requer o artefato frontend writer-only compatível, não um frontend anterior ao protocolo. A volta à leitura legada pode trazer de volta SQL/polling; não é a configuração final de economia.

## Proteções verificadas

- Metadados exigem direção e estado inicial exatos, preservando writer=true, CPU1000ms, rates, secrets por tipo, Hyperdrive, os dois buckets e namespaces existentes.
- O validador de recursos já existente é reutilizado sobre uma **cópia privada** com flags inertes, somente depois de conferir as flags reais esperadas. Essa normalização não altera a entrada, não chama o provedor e não relaxa a função antiga de writer.
- Snapshots completos de controle só podem diferir pelo novo deployment 100% do Worker da fase e, na última fase, pela flag reader esperada. Drift em billing, fila, privacidade, migração, namespaces, domínios, writer ou CPU é recusado.
- Journal em arquivo criado exclusivamente, associado à direção, com fases ordenadas. Um caminho consumido não pode ser reaproveitado por outra execução/direção.
- Erros retornam resumo fixo, sem detalhes privados. Após tentativa de publicação sem confirmação durável, o resultado permanece incerto, sem nova publicação automática. Falha no último registro também não vira sucesso.
- `inspect` não usa journal/publicação. Argumentos inválidos e portas incompletas/incompatíveis são recusados antes de iniciar a operação.

## Evidência fresca

Antes da implementação, 74 testes novos falharam por export ausente (`reader gate missing`). Após implementação, a rodada focada teve duas falhas: a construção da expectativa do teste alterava o próprio snapshot de referência. Corrigida somente essa montagem com clone independente; a rodada focada passou 121/121, incluindo os guardas antigos.

Acrescentados dois testes compostos, um por direção: metadata real, journal real em arquivo, uploader existente e verificação real de snapshots; apenas a fronteira de provedor é simulada. Confirmam que os assets não são publicados duas vezes após replay, que o writer permanece ligado e que billing não muda.

Verificação final:

- **277/277 testes de todos os operadores da raiz** aprovados, incluindo 76 do gate novo; zero falhas/skips/cancelamentos.
- **383/383 testes frontend**, em 74 arquivos, aprovados. Avisos React Router future flags já observados; não são erros de teste.
- Sintaxe dos dois módulos e diff check aprovados.
- Árvores `src` preservadas: frontend `abf974816819797ba8ef88ec1edd215e4c3580a0`; API `b5914e9323b74215442c2afc5e0f356f2f904c8c`.

Logs no workspace ignorado do plano: `catalog-reader-gate-{red,green,green-final,whole-operators,whole-frontend}-2026-11-06.log`. O candidato frontend da [preparação anterior](infra-migration-catalog-reader-preparation-2026-11-06.md) não foi reconstruído ou modificado. Não foram repetidas provas remotas de onboarding/imagens/recuperação.

## O que isso ainda não autoriza nem prova

Os callbacks de readiness/database/publicação/verificação são fornecidos pelo controlador. Seu retorno sem erro **não é prova independente** de cobertura real de writers, privacidade, bytes remotos, redução SQL ou custo. O relatório mantém `runtimeWriterCoverageProven=false`. O comparador de snapshots não verifica código/assets: o controlador precisa verificar seus bytes separadamente e construir o snapshot a partir de readbacks reais, não de declarações.

Próximo trabalho é conectar essas peças a um controlador e transporte restritos, com artefatos fixados, baseline viva, prazos/cancelamento, conferência independente e autorização operacional da janela. A revisão do workflow completo continua necessária antes da publicação; esta preparação não declara revisão final nem readiness remota.

Nenhuma chamada Cloudflare/Neon, chave, recurso, plano pago, login, upload remoto, schema, deploy, flag, billing, DNS, push ou main neste checkpoint. Quatro documentos previamente alterados e referências do usuário foram preservados. A API permaneceu limpa no commit `8fc9de0b4a42082ed696c6da367434c0137899aa`. T5/T9/T10 e Etapa13 continuam abertas; subplano formal 7/10, sem promessa de teto financeiro global.
