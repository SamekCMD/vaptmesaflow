# Preparação da promoção coordenada — 25/10/2026

## Escopo desta passagem

GETs de controle e preparação local; nenhuma manutenção ativada, fila pausada, cron alterado, SQL remoto ou publicação. Backup/restore e ensaio009–012 aprovados em24/10 não serão repetidos. Etapa13 e catálogo7/10 continuam abertos.

Conferência em25/10 às16:20 São Paulo: API production914f79f0/deployment68828632, web e77339dd/deployment24d1b0fc e Bproduction1f578bc6/deploymentda2a4249 permanecem nos IDs registrados. API CPU1000ms, workers.dev/preview desativados, nenhum cron; web workers.dev desligado/preview ligado. Billing privado, cron30min, fila production69f033ad5eb6424c99b41d1baa7ff3ad/consumer8fb8e9ad983442aaab49079154d3d799, DLQad6e9115d01f4c63a43a557f18c0a3a9. Fila e DLQ retornaram0mensagens/0bytes **aproximados**, não prova de ausência de mensagens em voo. Retenção86400s, batch10/retries3/delay60 preservados.

Zona5b3de26f4df6a0968d5646267e34f843 ativa no Free Website. GET do ruleset WAF retornou403 de autorização; isso não significa ruleset vazio, sem vagas ou indisponibilidade no plano. Rotas Worker clássicas retornaram lista vazia; os dois custom domains continuam nas APIs próprias. Nenhuma tentativa de obter novas permissões/token ou contratar WAF/Zero Trust.

## Decisão técnica local

As flags reader/writer do catálogo não são manutenção da API. O B atual também não tem flag de pausa: cron e entrega de fila são controles separados. Alternativas consideradas: regra WAF temporária depende de leitura/permissão não disponível e responde403 padrão; novo Worker de manutenção acrescenta recurso/troca de rota desnecessários; **wrapper de entrada no Worker API existente** permite503/no-store/Retry-After sem consultar banco nem trocar classes ou bindings.

Minha escolha de implementação, dentro da preparação aprovada: criar somente um **montador offline** de multipart content-only em A. Preserva os módulos originais byte a byte e reexporta seus named exports; substitui apenas o default fetch por503. Não tem credencial, HTTP, CLI, deploy ou caminho apply. Não acrescenta migrations, namespaces, recursos, secrets, limites ou alterações de rota. A futura ativação é mudança temporária de disponibilidade, exige gate explícito e um operador próprio de tentativa única com baseline fixada; este montador não concede essa autoridade.

### Tarefa local única — implementável e verificável

- [x] A criado `scripts/production-maintenance-artifact.test.mjs`: resposta503 para métodos/rotas de auth, pedidos, webhooks e sockets; sem leitura de body/headers/env/context; named exports preservados por identidade; módulo original inalterado; imports válidos; colisões/traversal/entrypoint ausente/bytes ou tipos inválidos recusados; metadata content-only sem bindings ou migrations.
- [x] RED26/26 por função ausente, depois A criado `scripts/production-maintenance-artifact.mjs`, interface `createProductionMaintenanceArtifact({entrypoint, modules: [{name,type,bytes:Buffer}]})` → `{mainModule, modules, metadata}`. Limites: até16módulos originais + um wrapper,8MiB totais incluindo wrapper; nomes relativos ASCII sem traversal; wrapper fixo `__vapt_production_maintenance__.mjs`; somente cópias de bytes de entrada e export/import do entrypoint validado.
- [x] GREEN26/26; suíte completa de operadores A344/344, API704/704, compilação0, sem skips/falhas. Workerd local validou o conteúdo publicado recebido só em RAM. Sem fonte remota salva ou valores de bindings fornecidos; nenhuma chamada à aplicação de produção.
- [x] Evidências e limitações registradas; checkpoint local da implementação e deste documento novo, sem push/main. Os avisos acrescentados aos dois documentos existentes ficam fora do commit por precaução do controle automático com alterações prévias. Aliases genéricos de deploy continuam bloqueados. Sem revisão repetida do plano inteiro.

### Prova local com a fonte publicada

GETs de conteúdo/control plane em25/10 às16:26 São Paulo, versão914f79f0/deployment68828632 fixada antes/depois. Entry point real `realtime-entry.js`,4603774bytes, SHA256 `3ade3b1dce5ca021239d1f81f6ed77283be7d9b4a470e10d52cfc85cc062fc1e`. Fonte recebida apenas em RAM, não regravada no scratch/Git. Wrapper228bytes, SHA256 `f4c53e3380f8dcbaf74e347731b142ee3ac54ce5c3c542aa255b8460067f0f32`.

Miniflare/workerd local, mesma compatibility_date/nodejs_compat, aceitou `RestaurantRealtime` pelo named export reexportado, com armazenamento descartável local. Oito requisições reais ao runtime local: health, signup, pedido, webhook Stripe, webhook Mercado Pago, socket, OPTIONS e HEAD. Todas503/no-store/Retry-After60/sem Set-Cookie; HEAD vazio.0chamadas outbound, nenhum binding/credencial de banco ou provedor remoto, runtime encerrado. O teste de identidade de classe usa módulo sintético local; a prova workerd usa os bytes reais publicados, não simula estado remoto dos DOs.

Não é prova de CPU faturada, preservação de storage remoto durante um deploy, propagação global, drain ou ativação. A pausa deve começar com baseline atual conferida, e requisições existentes podem continuar. Sem header CORS de liberação, uma aba do frontend pode mostrar erro de rede durante essa manutenção; não há resposta2xx para um webhook ainda não aceito.

O montador é uma biblioteca sem CLI/autenticação/HTTP/apply. **O operador remoto da janela ainda precisa ser preparado com tentativa única, marcador exclusivo, pins de versão/hash, readback de configuração e manejo de estado incerto; não chamar o endpoint de upload diretamente como substituto desse operador.** Pausa de queue/cron, drain, migrations e promoção tenant também não foram executados ou liberados pelo teste local.

## Ordem do gate futuro — ainda não executada

1. Fixar bytes/SHAs pareados e controles atuais; conferir também o caminho de rollback compatível. API A74008f7/srcb5914e9323b74215442c2afc5e0f356f2f904c8c; F57039e4/srcabf974816819797ba8ef88ec1edd215e4c3580a0; Btree4651c7276b6f373ef9b8df93e4c7774b4298c36a. São checkpoints de fonte, não hashes dos bundles nem CI novo.
2. Gate próprio de manutenção: content-only da API existente com os módulos originais e wrapper; verificar503/no-store, CPU/bindings/DO/rotas/segredos intactos e nenhuma nova entrada pública. Isso não cancela requisições, sockets, alarmes ou comandos já aceitos.
3. Pausar somente entrega da fila production preservando settings, consumer, DLQ e mensagens; retirar temporariamente somente o cron do Bproduction. Não purgar, apagar consumers, confirmar mensagens nem desativar preview. Registrar os valores anteriores para restauração exata.
4. Tratar propagação e trabalho em voo como gates reais, não dormir alguns segundos e declarar drain: pausa da fila não cancela entregas em processamento; cron pode levar até15min para propagar e invocações cron/fila têm até15min de wall time. Readbacks/time window e consultas agregadas sob locks devem concordar; HTTP pode ter duração diferente, exigindo prova própria. Divergência, credencial indisponível ou efeito aceito sem executor compatível interrompe o gate antes de DDL.
5. Revalidar Neon/capacidade/role/schema e dados atuais contra o backup, com snapshot/controlos exatos. Estado novo não é apagado para igualar a fotografia; interromper para reconciliar. Só após autorização aplicar atomicamente009–012 e grants próprios, já ensaiados, e ler novamente pela role limitada.
6. Promover API tenant + B canônico + frontend pareado sob manutenção, inicialmente reader/writerfalse, sem novos recursos por inferência. A configuração candidata adiciona PUBLIC_CATALOG_BUCKET/COORDINATOR que não constam nos bindings atuais de production: conferir recursos/autorização do delta antes de publicar; não executar o dry-run como se fosse deploy.
7. Testes controlados/compatibilidade/cookies/CORS e recuperação; restaurar cron e entrega com consumidor compatível antes da liberação geral. Nova URL/bypass ou bearer persistente não é consequência automática do modo manutenção. Catálogo mantém seus gates próprios.
8. Antes de SQL pode-se retornar ao código antigo com seus recursos intactos; depois de schema tenant/dados multi-tenant, **não reabrir versão owner-only**. Manter manutenção e corrigir a versão compatível; nenhuma restauração destrutiva ou replay automático do backup.

Fontes oficiais: [content-only substitui fonte sem tocar configuração](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/), [pausa não cancela mensagens em voo](https://developers.cloudflare.com/queues/configuration/pause-purge/), [propagação do cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [limites de duração por tipo de invocação](https://developers.cloudflare.com/workers/platform/limits/), [WAF Free e ações](https://developers.cloudflare.com/waf/custom-rules/). Esses limites não são prova de drain ou teto de fatura.
