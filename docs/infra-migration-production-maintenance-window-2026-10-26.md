# Operador restrito da manutenção de produção — 26/10/2026

## Resultado desta passagem

Operador implementado e testado localmente em A, mais inspeção real **somente GET** aprovada. **Não foi executado fechamento da janela:** produção continua sem manutenção; fila/cron não foram pausados, nenhum schema ou código remoto mudou. Nenhum push, merge, contratação, novo recurso ou repetição do backup/canários.

Arquivos novos da API: `scripts/production-maintenance-window.mjs` e `scripts/production-maintenance-window.test.mjs`. Reutilizam o montador de228bytes aprovado em25/10. O módulo não possui CLI, autenticação ou transporte de rede padrão; os aliases genéricos de deploy permanecem bloqueados.

## Contrato e limites

`runProductionMaintenanceWindow(['inspect'|'close'], ports)` aceita apenas um comando, sem alvo/configuração/URL fornecidos por argumento. Exige transporte de controle explícito; fechar exige também transporte público separado e journal durável. Não recebe senha/token por argumento ou env.

`inspect` verifica as versões fixadas da API, web e Bproduction, CPU1000, secrets pelos nomes/tipos, Hyperdrive/R2/DO/rates, ingress, cron, domínios, produtor/consumer/settings e backlog aproximado zero da fila/DLQ. Lê e valida em RAM o bundle original (entrypoint, tipo, tamanho4603774bytes e hash3ade3b1d…). Depois reconfirma versões/configuração antes de retornar. Não cria marcador, não chama a aplicação nem autoriza mutations.

`close`, **somente após autorização própria da janela**, segue:

1. Cria marcador exclusivo e sincronizado em disco antes dos GETs; marcador existente bloqueia outra execução antes de acessar o provedor.
2. Executa o preflight e registra duravelmente a tentativa **antes** de cada uma das três mutations.
3. PUT content-only na API, mantendo os módulos originais e classes, seguido de readback exato de conteúdo/configuração/versão e GET anônimo de health503/no-store/Retry-After60.
4. PATCH apenas `delivery_paused:true` na fila production69f033ad5eb6424c99b41d1baa7ff3ad; confere preservação de retention86400, producer, consumer8fb8e9ad983442aaab49079154d3d799, retries, batch e DLQ.
5. PUT de lista vazia somente no cron do Bproduction; reconfirma todos os controles e preserva as versões de web/B. Confirmação de configuração **não significa propagação global**.

Os únicos destinos de escrita são API production/content, fila production e Bproduction/schedules. Não há purge, ack, DELETE, criação de recurso, consulta SQL, upload tenant, liberação de tráfego, resume ou rollback. O cron esperado para posterior restauração é `*/30 * * * *`; este operador não faz essa restauração.

No recibo: estado `false` = não tentado, `null` = tentativa sem confirmação, `true` = confirmação por readback/probe nesta execução. Qualquer falha após uma mutation gera estado parcial/incerto, sem repetir ou desfazer ações. O journal preserva tentativa e confirmação por fase; um arquivo parcial após crash também bloqueia replay, pois não se exige parse bem-sucedido para reconhecer sua existência.

O marcador não é autorização de segurança nem controle contra outro administrador: previne repetição acidental desta operação. Comparações antes/depois não são CAS global. Não realizar deploy/edição concorrente no dashboard ou automações durante a janela; divergência exige diagnóstico somente-leitura, não nova tentativa automática.

**Sempre retorna drainVerified=false e migrationReady=false**, inclusive após fechar os três controles. Não cancela HTTP/WS/DO/alarmes ou mensagens já em voo. Cron pode levar até15min para propagar; cron/fila têm seu limite de invocação, diferente de HTTP. Espera/readbacks e prova própria de drain precedem qualquer DDL. Não usar “fila0” ou elapsed time isolado como autorização de migration.

## Evidências novas

- 35 testes iniciais falharam por funções ausentes e depois passaram. Dois testes adicionais reproduziram corrupção do wrapper/colisão de multipart antes da correção; dois reproduziram falta de cancelamento de respostas rejeitadas. Mais uma caracterização do adapter recusou bundle de tamanho correto/hash errado.
- Final: **40/40 novos**, suíte completa de operadores **384/384**, API **704/704**, zero falhas/skips; compilação, syntax e diff-check exit0. Journal real de arquivos comprovou exclusividade entre instâncias, fsync, nenhuma sobrescrita e rejeição de fase não prevista.
- Os testes de fechamento usam respostas de provedor e preparação de fonte controladas: **não fecharam produção**. A injeção `prepareSource` é uma dependência confiável para testes, não um argumento de operador ou prova de hash de fonte real.
- Integração real às **14:18 de São Paulo**, `2026-10-26T17:18:23.107Z`:31GETs pelo próprio caminho `inspect`, transporte que recusa qualquer outro método/origem, adapter padrão e hash real aprovados. Não houve journal, chamadas à aplicação ou SQL; source/token apenas em RAM e referências descartadas ao encerrar.
- SHA256 do resultado da inspeção: `07b4c905141d681e8f711deb5f2ca993812ae635c774455dbb63bf67450dae46`.

Prova do wrapper em workerd local com a fonte real publicada continua a de25/10; não foi repetida, nem convertida em prova de CPU faturada/estado remoto de DO. O banco e os limites do Neon não foram consultados ou alterados nesta passagem.

## Lançador preparado, não executado

Scratch próprio: `production-window-close-controller-2026-10-26.mjs`. Sem argumentos; fixa os bytes do módulo do operador, origens, caminhos, métodos e bodies. Usa apenas a autenticação já existente do Wrangler em RAM; separa OAuth do controle e probe público sem cookie/header de autenticação. Não cria token ou arquivo de credenciais. Syntax-check aprovado; **o caminho de lançamento real não foi executado**.

Marcador fixo futuro: `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/production-maintenance-window-v1-start.json`. Ausente ao encerrar esta preparação. Não criar/renomear/apagar marcador para simular autorização ou contornar uma tentativa incerta; não rodar o lançador antes da autorização explícita de indisponibilidade.

## Próxima fronteira

Autorização específica para **fechar temporariamente a API com503 e pausar apenas fila/cron de billing production**, sem migrations ou publicação tenant nessa execução. Depois: provar drain e revalidar schema/capacidade, aplicar SQL/grants somente no gate próprio e promover API/B/frontend compatíveis sob controle. Não reabrir código owner-only depois de dados/schema tenant por um rollback automático.

Backup/restauração e ensaio local009–012 estão concluídos em24/10; não repetir. Catálogo formal7/10 e Etapa13 permanecem abertos. Preservados os dois avisos documentais sem commit de25/10 e as alterações financeiras/main-plan/referências do usuário.

Referências: [preparação de25/10](infra-migration-production-promotion-preparation-2026-10-25.md), [PATCH parcial da fila](https://developers.cloudflare.com/api/resources/queues/methods/edit/), [PUT de schedules](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/schedules/methods/update/), [mensagens em voo durante pausa](https://developers.cloudflare.com/queues/configuration/pause-purge/), [propagação de Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
