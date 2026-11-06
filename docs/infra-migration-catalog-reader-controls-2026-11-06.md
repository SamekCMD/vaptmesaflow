# Transporte restrito e preparação do controlador reader — 06/11/2026

## Resultado

O gate local passou a ter um transporte específico (`scripts/catalog-reader-controls.mjs`) para ativação/rollback do reader. O transporte anterior do writer não foi alterado. Preparado também um controlador de artefatos/inspeção com caminhos, hashes e recursos fixados. **Nenhuma publicação ou alteração de flag foi executada.**

### Transporte

- Sem credenciais, autenticação, CLI ou `fetch` padrão; o chamador fornece adapter e sinal global de cancelamento.
- GETs reutilizam a allowlist existente de produção. Não permite administrar recursos, alterar billing, criar chaves, mudar DNS ou atingir o preview.
- Escritas permitidas somente na sequência manutenção → sessão/assets → frontend → API final. Recusa sobreposição de escritas e reuso de fase consumida.
- O PUT final precisa ser exatamente o metadata derivado do estado inicial validado: writer=true, reader na direção pedida, CPU1000ms, recursos/rates/secrets preservados e nenhuma migration.
- Confere nomes/tipos/tamanhos dos módulos, manifesto de até90 assets, exclusão de proof/headers públicos e uploads apenas dos hashes conhecidos, sem duplicação.
- Prazo de60s por requisição de escrita combinado ao sinal externo; resposta JSON limitada a1MiB. Cancelamento também interrompe espera de fetch/body. Após escrita incerta, nenhuma escrita posterior é permitida; GET de diagnóstico permanece disponível enquanto o sinal estiver válido.
- Erros retornam texto fixo sem detalhes de provedor.

O transporte não autentica sozinho a origem dos bytes nem certifica readiness. Seu chamador ainda deve fixar os artefatos e realizar as verificações independentes.

### Controlador de preparação

No workspace ignorado do plano: `production-catalog-reader-v1-controller.mjs`, SHA-256 `dc634c463c3cb4b000290123e3bc06435032a33a0e26735eca37f810b1b1c3e6`.

Somente aceita `artifacts activate`, `artifacts rollback` e `inspect activate`. Qualquer comando de publicação é recusado antes de autenticar. Essa restrição é deliberada: o controlador **não é ainda o executor da janela de publicação**.

Verifica sem reconstruir: manifesto da release, módulos canônico/manutenção/billing, provas e lista exata dos arquivos de cada candidato, hashes dos bytes e árvores `src`/billing sem alterações. A direção activate seleciona o candidato reader-writer; rollback seleciona writer-only, não uma release anterior ao protocolo. As duas variantes têm90 assets públicos.

O modo inspect usa apenas GETs fixos, autenticação existente em memória e prazo global de10min. Compara deployments, configurações, bindings, ingressos, cron, fila, namespaces SQLite, domínios e privacidade R2; confere bytes canônicos da API/billing, saúde/index atuais e repete o snapshot de controle. Não acessa Neon nem usa uma declaração manual como prova de banco ou cobertura de writers.

## Verificação fresca

- Transporte:17 testes RED por export ausente →17 GREEN. Um caso adicional reproduziu cancelamento síncrono seguido de rejeição não consumida (17/18); corrigida a causa, mantendo o consumo da promise mesmo quando o sinal já foi abortado →18/18 GREEN.
- Controlador local:7 RED por export ausente →7/7 GREEN usando os artefatos reais locais já fixados. Recusa adulteração de manifest, módulos e proof e bloqueia comandos de publicação.
- Toda a suíte de operadores da raiz: **295/295** aprovados, zero falhas/skips/cancelamentos.
- Frontend: **383/383**,74 arquivos aprovados; avisos React Router future flags já observados, sem erros.
- Sintaxe e diff check aprovados. Árvores runtime `src` preservadas: frontend `abf974816819797ba8ef88ec1edd215e4c3580a0`; API `b5914e9323b74215442c2afc5e0f356f2f904c8c`.

As sete provas do controlador dependem do pacote operacional local ignorado; não são apresentadas como testes portáveis de CI. Não houve novo build dos candidatos nem repetição das janelas de onboarding/imagens.

## Readbacks reais, sem escrita

A confirmação independente existente passou às20:46UTC. O controlador novo passou no modo inspect às20:54UTC, conferindo novamente a baseline e os bytes:

| Worker | Deployment | Versão100% |
| --- | --- | --- |
| API | `21ec8188-f269-4a1c-915b-52b9ac4cee2d` | `d98d72dc-64a9-4ec9-bec1-fd9510f8bf55` |
| Frontend | `d25fdb5e-2a0d-4b18-a093-93c8dd2e1cdf` | `a85e1f8a-a626-460b-b861-9dd16a39fb72` |
| Billing | `e9db2125-fec9-4871-9854-d7532f54dc19` | `b156056a-c5b5-4f14-94c3-65bfd6097fd6` |

Writer=true, reader=false; APIhealth200; CPU **configurada**1000ms, não uma nova medição de workload. Bucket de catálogo sem r2.dev/domínios públicos; billing com cron*/30 e fila sem pausa. Não foram criadas credenciais nem buscados seus valores para logs/Git.

Recibo novo: `production-catalog-reader-v1-preparation-2026-11-06T20-54-55.878Z.json`, SHA-256 `a1bfeef62a2a729fc07efc9f6129008d0a324e3aac975048b669f124b3837c70`. Confirmação independente: `production-catalog-writer-independent-2026-11-06T20-46-26.090Z.json`. Ambos ficam no workspace ignorado do plano. O resumo conserva `remoteWrites=0`, `databaseChecked=false`, `activationReady=false` e `runtimeWriterCoverageProven=false`.

## Pendências reais

Ainda faltam a conferência atual das projeções/pendências e cobertura dos writers para a janela, a montagem/revisão do executor de publicação e a autorização operacional antes de alterar tráfego/flags. Não repetir canários encerrados nem criar restaurante apenas para bootstrap de um conjunto vazio. O retorno à leitura legada deve preservar writer/executor e admitir explicitamente SQL/polling.

As leituras de controle não garantem estado futuro ou teto financeiro global. Não houve SQL, schema, chave nova, recurso, plano pago, deploy, flag, billing, DNS, push ou main. Os documentos previamente alterados e referências do usuário foram preservados. T5/T9/T10 e Etapa13 continuam abertas; total formal7/10.
