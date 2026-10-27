# Execução natural do billing — observação em 27/10/2026

A fila e o agendamento continuam ativos, nas versões já aprovadas. Nesta observação não houve alteração remota, disparo manual do Cron, mensagem de fila, email ou pagamento sintético, coleta de logs ou nova credencial.

## Método e limite da prova

A introspecção autenticada do GraphQL oficial encontrou o dataset dedicado `workersInvocationsScheduled`. Foram confirmados seus campos de script, cron, horário agendado, horário observado, status e CPU em microssegundos. Isso evita apresentar uma invocação genérica do Worker como prova de Cron. O dataset não informa a versão por evento; os pins de deployment são conferidos antes/depois da consulta, sem inventar esse campo ausente.

O primeiro horário elegível foi19:00UTC/16hSãoPaulo: próximo slot de30min após a confirmação18:40:18UTC e a margem documentada de propagação. O [Cron pode levar até15min para propagar](https://developers.cloudflare.com/workers/configuration/cron-triggers/); essa margem não é uma promessa de latência da telemetria.

O observador `billing-natural-cron-readonly.mjs` valida o journal consumido, script/cron e horários exatos, consulta até100eventos em no máximo2h e confere a versão/configuração do billing ao redor da leitura. Antes do horário ele não autentica nem consulta analytics. Dados ausentes permanecem pendentes; só registros observados com status `success` permitem confirmar execução natural. A entrega por Resend permanece uma prova separada, mesmo com Cron saudável e outbox vazia.

## Leituras desta rodada

| Horário UTC | Resultado |
| --- | --- |
|18:50:36|Aguardando o horário;0consultas analytics |
|19:00:25|Janela19:00–19:00:25 aceita; nenhum evento retornado |
|19:02:02|Janela19:00–19:02:02 aceita; nenhum evento retornado |
|19:05:25|Última leitura da rodada; janela19:00–19:05:25 aceita, nenhum evento retornado |

As leituras não mostraram erro do job, mas **também não comprovaram execução**. Ausência de registro não foi tratada como CPUzero, sucesso nem falha do billing. Não se altera fila/cron ou dispara um job artificial para forçar a confirmação.

O schema foi descoberto seguindo `Query → viewer → account`. Duas consultas iniciais usaram incorretamente `Account` maiúsculo e retornaram tipo ausente, sem efeitos; uma extensão posterior da introspecção interrompeu sem diagnóstico detalhado. Depois da instrumentação restrita a erros públicos de schema, a leitura completa passou. Esses resultados anteriores foram preservados, não transformados em sucesso. [Introspecção oficial](https://developers.cloudflare.com/analytics/graphql-api/features/discovery/introspection/).

## Artefatos

No workspace próprio `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan`:

- Schema confirmado `billing-natural-metrics-schema-2026-10-27T18-48-14.859Z.json`, SHA256`242dd63d253fd2b6d8088fe2a7489c34994729e611dc6f5b6a441a283d4619fe`.
- Observador `billing-natural-cron-readonly.mjs`, SHA256`a590b0563761b492224160216bda990d30a402d6b9b499e517584548ca6abfe0`.
- Primeiro recibo pós-horário `billing-natural-cron-2026-10-27T19-00-25.201Z.json`, SHA256`4b4084b2ead5d93749702d83ed705b2eb29f2b9007d6040fd7f20f2db5cbad64`.
- Recibo posterior `billing-natural-cron-2026-10-27T19-02-02.896Z.json`, SHA256`ec3df02432bfc5d1816d62a1e7365ac74fc2bf0fdb6172bca0b88e4f5bd449cf`.
- Recibo final `billing-natural-cron-2026-10-27T19-05-25.797Z.json`, SHA256`e84cd0ed51427501883cf9f7092c5573441a12d98f85152bb07cf9666a45e4a6`.

A observação é somente-leitura e pode ser retomada depois; **não** repetir o controlador de retomada de billing, que já foi consumido. Não foi criada automação ou monitor recorrente. O catálogo continua desligado; o candidato frontend preparado no intervalo está documentado separadamente e não foi publicado. Etapa13 e os gates de catálogo/estabilidade/integração continuam abertos.
