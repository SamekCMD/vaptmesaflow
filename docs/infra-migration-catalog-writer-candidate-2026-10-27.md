# Candidato frontend do catálogo — preparação local em 27/10/2026

Foi preparado e compilado um candidato **somente local** para a fase writer/recibos. Nenhuma publicação ou flag remota foi alterada. O billing segue ativo e o catálogo de produção continua desligado.

## Combinação preparada

| Configuração do candidato | Valor |
| --- | --- |
| Cliente de recibos/writer | true |
| Leitura pública por eventos | false |
| Upload de imagens | R2 |
| Realtime privado de pedidos | true, preservado |
| Pagamentos | sandbox, preservado |
| Turnstile / API | habilitado / `https://api.vapt.app.br` |

A inspeção encontrou uma dependência concreta: o build de produção atualmente publicado fixa `VITE_MENU_IMAGE_STORAGE_MODE=disabled`, e `uploadRestaurantImage` exige o modoR2 antes de otimizar/enviar a imagem. Logo, ligar só o writer não habilitaria o fluxo de imagens já implementado. O candidato fixa também esse modo, sem alterar a conversão WebP, os limites100MiB/5MiB/1MiB, a quota de logo/produto ou o backend.

`scripts/catalog-production-build.mjs` reutiliza as opções restritas existentes, mas exige uma fase explícita `writer-only` ou `reader-writer`. A segunda fase possui teste de configuração; **não foi compilada ou publicada nesta rodada**. As opções públicas arbitrárias do ambiente não podem mudar API, segurança ou flags. Os builds/aliases antigos continuam catálogo-off/bloqueados, sem bypass de deploy.

Os artefatos ficam em um diretório exclusivo do workspace do plano, sem esvaziamento automático. O preparador cria marcador exclusivo e recusa sobrescrever o candidato. Não há CLI de publicação, autenticação ou chamada de provedor neste construtor.

## Provas locais

- Quatro testes novos falharam com implementação ausente e depois passaram: duas fases, preservação dos builds antigos e rejeição de fase/VAPID inválidos.
- Suíte completa dos operadores root118/118, sem skips/falhas; aplicação383/383 em74arquivos,35,48s.
- Build Vite14,80s, exit0;91arquivos,85JS. A checagem existente do bundle público passou.
- Outro processo releu todos os arquivos, conferiu tamanhos/hashes e confirmou a árvore fonte `abf974816819797ba8ef88ec1edd215e4c3580a0`. A primeira tentativa desse verificador parou em spawnGitEPERM, antes de validar os arquivos; a correção só moveu o comando Git para o shell permitido, e a conferência completa então passou.

Diretório: `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/catalog-frontend-writer-only-candidate-v1`.

- Manifesto `candidate-proof.json`, SHA256`a0f07712584c190f6a2b265d11f7a99069b4549eb8b1a40d55e3668a064c479a`.
- Hash agregado dos91registros de arquivos: `6d476071c280664efcffbacc86b6f895593e98030ed49cb67dd04abf4cc910fb`.
- O conjunto inclui `_headers`. Em eventual publicação, ele deve continuar **configuração privada dos assets**, não arquivo público; o manifesto/proof também não é asset público.
- Marcador `catalog-frontend-writer-only-candidate-v1-start.json`, preparador `prepare-catalog-frontend-writer-candidate-v1.mjs`, logs `catalog-frontend-writer-candidate-build.log`, `catalog-candidate-root-operators.log` e `catalog-candidate-full-project-tests.log`, todos no workspace próprio.

O candidato não substitui nem sobrescreve a release congelada que já foi publicada. Não refazer o build por simples mudança de HEAD documental; conferir fontes, configuração e bytes antes de um gate autorizado.

## O que continua faltando

Continuação27/10: [primitivas da publicação pareada preparadas e testadas](infra-migration-catalog-writer-publication-preparation-2026-10-27.md), sem rede ou ativação. O upload distingue91 arquivos de build de90 assets públicos; `_headers` vai na configuração e `candidate-proof.json` não é publicado. O controlador fixo e seu preflight remoto ainda precisam ser preparados.

Não publicar o candidato isoladamente contra APIwriterfalse. A passagem exige operador pareado próprio, preflight dos recursos/privacidade/grants, proteção da admissão durante a troca e readback, sem reaplicar SQL, remover namespace ou voltar a código owner-only. O tratamento de recibos precisa estar pronto enquanto houver writer/ações aceitas; rollback do reader não pode desligá-lo.

Os canários24/10 continuam evidência encerrada de publicação8MiB e leitura estruturada, não devem ser repetidos ou renomeados como uma nova autorização. Falta evidência runtime dos writers/clientes ativos, recuperação/bootstrap dos alvos reais quando existirem e ativação controlada. Não criar restaurante apenas para forçar um bootstrap vazio. Nenhum teste remoto novo de imagem, receipt, CPU ou navegador foi executado por este build local.

Etapa13/T5/T9/T10 seguem abertos; este candidato não é autorização de publicação ou garantia financeira. Main, push, merge, DNS, serviços pagos, credenciais, API/billing publicados e flags remotas permaneceram intactos.
