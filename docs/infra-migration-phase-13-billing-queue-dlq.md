# Etapa 13 — transporte real Queue → DLQ production

## Resultado observado — 08/10/2026

Uma única mensagem JSON sintética inválida foi publicada na Queue production existente, alcançou sua DLQ e foi removida por referência individual verificada. Queue, DLQ e outbox ficaram vazias na leitura final. Não houve republicação, replay, email solicitado, pagamento, fixture SQL ou alteração de runtime/configuração. Este gate complementa a recuperação SQL e as quatro entregas reais anteriores; não os repete.

Recursos preservados: billing Worker `vapt-billing-email-production`, versão `1f578bc6-586a-46ca-b180-0301057b2cc8`, Cron1min, dois secrets por nome, ingresso público desligado; Queue `69f033ad5eb6424c99b41d1baa7ff3ad`, DLQ `ad6e9115d01f4c63a43a557f18c0a3a9`, consumer `8fb8e9ad983442aaab49079154d3d799`, batch10/timeout5s/max_retries3/retry_delay60s. Retenção de ambas86400s, DLQ sem consumer. Nenhum consumer/token/binding/secret/assinatura novo.

## Evidência e contenção

Antes: `peek` de ambas0, backlog aproximado0 e outbox global0; versão/configuração conferidas independentemente. Autenticação Wrangler existente somente em memória; nenhuma credencial, corpo externo ou referência opaca foi gravada no Git/logs. Operador de teste com deadline10min, uma publicação máxima, polls20s e ausência de retry cego após resposta ambígua.

Body próprio: version0, outboxId `d4622cd7-822e-4cdb-bf8b-e2e091afc4f5`, correlationId `37f92af5-4b5d-42f5-9466-b730609f2907`, fixtureTag `stage13-queue-dlq-20261008-d4622cd7`. O contrato atual rejeita esse body antes de claim SQL ou envio Resend. Não contém destinatário, restaurante ou dado financeiro; nenhuma outbox foi inserida.

Publicação única registrada em `2026-10-08T22:23:33.198Z`. DLQ retornou o mesmo corpo exato, ID `dc6763b20bf0f75828be83d7a0923ac5`, timestamp `2026-10-08T22:26:41.942Z`, attempts0; primary `peek`0. Intervalo de aproximadamente188.744s é compatível com os três retries configurados, mas não substitui trace por tentativa. **Certificamos chegada do body próprio à DLQ sob a configuração existente; não um contador observado de quatro tentativas na primary.** DLQ é uma fila independente, e seu contador0 não deve ser tratado como o histórico da primary.

## Ajuste do verificador e limpeza

O primeiro operador falhou fechado: aplicou ao `peek` a suposição base64 do transporte HTTP pull e esperou que a DLQ mantivesse attempts4. Não apagou a mensagem e não a republicou. Diagnóstico somente leitura confirmou JSON textual próprio, timestamp válido, ID/ref presentes e attempts0. Teste de regressão falhou RED e passou GREEN após aceitar JSON textual mantendo comparação exata de quatro campos, UUIDs/tag/version/data/ID/ref e alvo allowlisted. Nenhum código do produto precisou de correção.

A continuação validou **a mesma mensagem**, sem nova publicação. Uma referência obtida por `peek` fresco, ligada ao ID observado e body exato, foi enviada a `messages/purge`; nenhuma operação queue-wide `/purge`, pull/lease, replay ou consumidor novo. Guard exigiu exatamente uma remoção; `peek` pós0 em ambas. Nenhuma mensagem alheia encontrada ou removida. Leituras finais também retornaram backlog aproximado0 em ambas e outboxGroups[]. O backlog logo após a exclusão ainda mostrou1; essa métrica não foi usada como prova de resíduo ou ausência, e convergiu para0 na leitura independente seguinte.

APIs oficiais: [peek sem lease](https://developers.cloudflare.com/api/resources/queues/subresources/messages/methods/peek/), [remoção por refs individuais](https://developers.cloudflare.com/api/resources/queues/subresources/messages/methods/purge/), [DLQ após limite de retry](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/). Purge por ref não é entrega/reprocessamento; não usar este caminho para apagar ou reenviar falhas de clientes.

## Verificação e limites

Três guards locais GREEN após duas falhas iniciais esperadas e uma regressão RED→GREEN; sintaxe aprovada. Billing local47tests/45pass/2integration preview skip/0fail e TypeScript exit0. Testes integration não foram redirecionados para production. Readbacks independentes após o ensaio preservaram API `94fffd63-f759-43c3-9f6a-0387e14e8c73`, frontend `916951fb-b0a8-43a2-ab7a-ba4923064425`, CPU1000, recursos/secret names/flags e billing acima. R2 público e realtime production continuam desligados, Stripe Test, APICron0. Pools e operadores encerrados, sem resíduo sintético.

CI anterior API8bbb88a e frontendb976e19 passou nos quatro runs push/PR; novo commit documental exige checks próprios. Sem deploy/main/DNS/Stripe Live/Zero Trust production/desligamento VPS/nova cobrança contratada. Foram usadas operações mínimas das filas já contratadas, sem promessa de custo absolutamente zero.

Decisões: restringir o gate à mensagem inválida real e corrigir somente o verificador a partir da evidência, sem certificar dedupe por dois UUIDs inexistentes nem apagar fila globalmente. Se ownership/configuração/API divergirem, falhar fechado; não ampliar permissões ou repetir publicação. Etapa13 permanece aberta para replay/out-of-order de webhook real, retry de envio/recuperação de falha de provedor/reconciliação, mutações Portal, imagens públicas deliberadas, realtime production, observabilidade/capacidade e estabilidade antes do cutover.
