# Publicação pareada do writer — preparação local em 27/10/2026

Foram implementadas e testadas as primitivas da passagem **API em manutenção → frontend com recibos → API writer-only**. Não houve publicação, ativação de flag ou alteração de banco/provedor nesta preparação. O reader público continua desligado; o billing já retomado não faz parte desta troca.

## Ordem e falhas

`scripts/catalog-writer-publication.mjs` não tem CLI, credencial, transporte padrão ou SQL. Seu controlador futuro deverá fornecer preflight de artefatos/recursos, leitura de readiness do banco, reconferência da admissão aberta e readbacks independentes de cada etapa.

1. Reclamar journal exclusivo antes do preflight de publicação. `inspect` não cria journal nem escreve remotamente.
2. Conferir código/configuração congelados, recursos e banco por leitura; revalidar o estado imediatamente antes da janela.
3. Fechar a admissão HTTP com o wrapper 503 congelado sobre o mesmo módulo canônico. Preservar os exports/classes e os trabalhos duráveis; não voltar ao backend owner-only.
4. Publicar e verificar o frontend writer-only já compilado, com recibos e imagens R2, mantendo events false.
5. Reconfirmar o par enquanto a API permanece em manutenção; só então publicar o mesmo módulo canônico com writer true/reader false e conferir o resultado.

Cada uma das três etapas possui registro durável de tentativa e confirmação. O journal usa criação exclusiva, fsync e fases ordenadas; não admite replay, fase fora de ordem ou substituição de prova anterior. Erro ou resposta perdida interrompe a sequência: sem retry, rollback, reabertura automática ou avanço à etapa seguinte. Uma janela parcialmente aplicada requer reconciliação por leitura antes de qualquer reparo autorizado.

O sucesso dessa orquestração, quando futuramente executada com um controlador adequado, confirmará a troca de configuração — **não** a cobertura runtime completa dos writers, bootstrap, reader ou teto financeiro.

## Metadados sem reprovisionamento

O helper de writer exige o catálogo já provisionado na tag `catalog-publication-production-sqlite-v1`, ambas as flags false, namespaces exatos de produção, buckets separados, Hyperdrive correto, oito nomes de secrets, seis rate limits, CPU 1000ms, realtime privado e Stripe Test preservados. Rejeita valores de secrets, bindings duplicados, namespace externo, troca de ambiente ou logs/tails ativos.

O payload mantém os bindings não secretos, altera somente a flag do writer e preserva os secrets por tipo. IDs administrativos de namespaces não são enviados como configuração de binding; os nomes das classes existentes continuam os mesmos e os IDs precisam ser conferidos no readback. Não há campo de migrations, nova classe, role, bucket, plano, segredo ou recurso. O helper antigo da primeira implantação não foi ampliado para aceitar esta passagem, e os aliases genéricos continuam bloqueados.

## Assets e configuração privada

`scripts/catalog-frontend-publication.mjs` prepara a sessão de assets com os bytes validados, envia apenas os hashes solicitados e finaliza com o token da última remessa. Valida a lista inteira antes do primeiro upload; recusa hash desconhecido/repetido, bucket vazio, resposta incompleta, traversal, arquivo grande ou falta das regras de cache. Não repete uma requisição incerta nem devolve tokens em relatórios/erros.

`_headers` é removido do manifesto público e incorporado em `assets.config._headers`, com as regras immutable existentes. `candidate-proof.json` é recusado como arquivo de publicação. Os buffers são copiados antes do primeiro await para impedir mudança dos bytes depois da criação do manifesto.

O candidato desta fase tem **91 arquivos de build, dos quais 90 são assets públicos**: `_headers` é configuração privada. O proof foi criado depois e também não é público. Isso não altera a contagem 91 de assets da versão anterior atualmente publicada; são conjuntos distintos.

## Evidências desta continuação

- 37 testes do protocolo/metadados/journal: falha inicial por implementação ausente, depois todos aprovados. Um teste adicional revelou que, após as seis fases, um argumento ausente poderia criar registro extra `undefined`; a validação de tipo/fim de sequência foi corrigida e o teste passou (38 testes deste módulo no total).
- 19 testes do upload: falha inicial por implementação ausente, depois todos aprovados.
- Suíte completa dos operadores root: primeira rodada 174/174; após a correção do journal, 175/175, zero falhas/skips.
- Suíte completa da aplicação: 383/383 em 74 arquivos, primeira rodada 34,20s e rodada final 33,99s após a correção do journal, zero falhas/skips. Não foram refeitos build, integração PostgreSQL, canários ou testes de email já encerrados.
- Verificação offline com os arquivos reais congelados: 91 hashes/tamanhos e proof conferidos; 90 assets transmitidos e comparados **somente em memória**, zero rede. A API conserva SHA256 `7205822d6931cef363c3730c0f9ecd553a671857a79cdff678203e0c7cec8f94`; árvores fonte frontend/API continuam `abf974816819797ba8ef88ec1edd215e4c3580a0` / `b5914e9323b74215442c2afc5e0f356f2f904c8c`.

No workspace próprio `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan`:

- Recibo `catalog-writer-offline-artifacts-2026-10-27T19-39-10.425Z.json`, SHA256 `950d9209e0a0d5f1b076f5098e99efbb8368198c48aa25424b5ccd3f83e1c181`, e verificador `catalog-writer-offline-artifact-verification.mjs`.
- Logs `catalog-writer-publication-red.log`, `catalog-writer-publication-green.log`, `catalog-frontend-publication-red.log`, `catalog-frontend-publication-green.log`, `catalog-writer-all-root-tests.log`, `catalog-writer-full-project-tests.log`, `catalog-journal-end-red.log`, `catalog-journal-end-green.log`, `catalog-writer-final-root-tests.log` e `catalog-writer-final-project-tests.log`.

## Próxima fronteira

Continuação27/10: o [controlador fixo foi composto e passou no inspect real](infra-migration-catalog-writer-controller-2026-10-27.md), com zero escritas. A revisão da janela e sua autorização continuam separadas; a descrição abaixo registra o limite da preparação inicial.

Falta compor e revisar o controlador fixo de transporte/readbacks, com os pins atuais e o billing **ativo**, e executar um novo preflight somente-leitura. Esta biblioteca não deve ser ligada diretamente a um fetch genérico: ela não substitui autorização da janela, verificação de fonte/configuração/privacidade ou os limites de escrita do controlador.

Só depois considerar a passagem autorizada e a prova dos writers/clientes/imagens ativos. Não reaplicar 009–012, repetir o smoke de cinco usuários, refazer backups, recriar recursos ou executar os journals consumidos. Reader e bootstrap permanecem gates separados; rollback do reader não pode remover o tratamento dos recibos nem suspender operações aceitas.

O [candidato frontend](infra-migration-catalog-writer-candidate-2026-10-27.md) permanece local; a [execução natural do billing](infra-migration-billing-natural-observation-2026-10-27.md) ainda não foi comprovada pela telemetria. Total formal do subplano 7/10; tarefas 5/9/10 e Etapa 13 continuam abertas. Main, push, merge, DNS e serviços pagos não foram alterados.
