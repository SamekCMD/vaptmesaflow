# Etapa 13 — recuperação do protocolo SQL da outbox production

## Resultado observado — 08/10/2026

Quatro cenários aprovados no PostgreSQL de production, usando `buildOutboxRepository` e `dispatchDue` do pacote atual, sem modificar suas consultas ou o runtime. Este ensaio não enviou mensagens Cloudflare, emails Resend ou eventos Stripe. Complementa o gate anterior de quatro emails Delivered; não o repete nem certifica replay dos transportes externos.

Pre/readback pós preservaram API `94fffd63-f759-43c3-9f6a-0387e14e8c73`, frontend `916951fb-b0a8-43a2-ab7a-ba4923064425`, billing Worker `1f578bc6-586a-46ca-b180-0301057b2cc8`, CPU1000, bindings/secret names/flags, Cron billing1min, Queue/consumer/DLQ e ausência de URLs públicas do billing. Outbox global estava vazia antes e ficou vazia depois. Sem deploy, alteração de secret, schema, grants, main, DNS, Stripe Live, assinatura ou cobrança nova.

## Escopo e contenção

Owner `d77d0330-1ff5-4cb0-baa1-708f91eb1944`, restaurante `1271a335-c6cb-48a5-ac13-69f502d7e99b`, tag `stage13-outbox-recovery-20261008-d77d0330`, sink sintético `delivered+stage13-outbox-recovery-20261008-d77d0330@resend.dev`. Apenas metadados user/restaurante, sem credential/account/session. Uma linha de outbox por cenário, UUIDs próprios, marker de fixture no payload e IDs explicitamente sintéticos `stage13_sql_recovery_<uuid>`/`synthetic_sql_<uuid>`; nenhuma linha de provider_event foi fabricada.

Conexão direta Neon production capturada em memória, com `pg` existente/role `neondb_owner`/pool2 e consultas originais importadas com `tsx` já instalado. Isso não é uma nova prova de ACL da role billing, HTTP Neon ou runtime Cloudflare; o gate anterior de entrega cobriu esses caminhos em uso.

Linhas agendadas uma hora à frente do relógio real; operador tem deadline15min e guard que exige pelo menos30min à frente do Cron. Os relógios futuros explícitos dos métodos permitem testar5min/15min/24h sem esperar essas durações ou mudar o relógio do servidor/Cron. Operações globais reserve/reap usam transação com lock curto SHARE ROW EXCLUSIVE, lock_timeout local1s e checagem de ownership no mesmo lock; abortariam ao encontrar qualquer linha ativa/dead_letter alheia. Nenhum lock foi mantido durante chamadas ao provedor ou espera. Globals são serializados por esse guard: não alegar concorrência do dispatcher global. As duas claims concorrentes por UUID não usam esse lock global.

## Cenários observados

| Caso | Resultado com SQL real |
| --- | --- |
| Claims concorrentes, retry e fencing | Duas claims do mesmo UUID produziram uma única lease/tentativa1. Claim antecipada em pending_retry retornou null sem incrementar attempts; reserva seguinte permitiu tentativa2. Snapshot permaneceu congelado mesmo após oferecer nome/plano diferentes. markSent e scheduleRetry da lease1 retornaram false. Após sent sintético, outra claim retornou null. |
| Falha de publicação e reserva perdida | Sender em memória lançou falha controlada; dispatcher retornou reserved1/published0/deferred1 e adiou60s. Antes do prazo, nenhum body capturado. Depois, o mesmo UUID/correlation foi capturado uma vez; dentro da reserva5min não repetiu; após expirar, republicou o mesmo ID. attempt_count permaneceu0. Não foi simulada indisponibilidade real da Queue. |
| Lease expirada e limite de tentativas | Reap aos14min não recuperou; aos16min produziu pending_retry/delivery_lease_expired e preservou snapshot. Nova lease2 recusou write da lease1. Métodos reais levaram attempts até8 e dead_letter/send_attempt_limit; não houve nona claim ou nova reserva. |
| Resultado incerto após24h | Processing com snapshot inicial, observado aos25h sintéticos, virou dead_letter/uncertain_result_window_expired, attempts1 e mesmo snapshot. Nova claim retornou null, sem chamada ou reenvio ao provedor. |

UUIDs de outbox, na ordem dos casos: `fa7e3133-2f19-4219-bf72-e1a503b6e7a1`, `c8ae7e24-cd49-42dc-b013-d4b2d87289c3`, `f60f4912-02dd-4dbe-b1b0-0a1aff69754c`, `c1504621-a90f-4ac0-bf50-d4e98e6d8859`. Cada linha foi removida por seus IDs/marker depois do caso. O primeiro usou o marcador de saída `synthetic-sql-no-provider-message`: **sent nesse ensaio não significa Resend aceitou ou entregou um email**. Não confundir dead_letter SQL com uma mensagem na DLQ Cloudflare.

## Limpeza, verificação e decisões

Cleanup transacional conferiu ownership do user/restaurante e todos os IDs/markers antes de excluir. Zero em cinco tabelas/escopos próprios (user/account/session/restaurants/outbox), zero outbox global, pool encerrado e operador exit0. Readback billing independente confirmou mesma configuração e outboxGroups[]/activeOrDeadLetter0. Histórico externo, filas/DLQ e dados alheios não foram apagados; não houve purge, replay ou resend manual.

Guards do operador: três falhas reais RED→GREEN para ownership, rejeição de linhas alheias e fence temporal; suite relacionada14/14 e sintaxe aprovadas. Billing local45pass/2integration skip/0fail e TypeScript exit0; os dois testes integration preview não foram redirecionados para production. Casos acima usam SQL real, não respostas de banco simuladas. CI dos heads anteriores API8bbb88a/frontend7a9fd80 passou nos runs push/PR; novos registros exigem seus próprios checks.

Decisões: usar intents sintéticos e relógio explícito para o protocolo de recuperação, distinguindo-o da origem financeira/entrega já provadas; usar lock curto nos métodos globais para impedir race entre checagem de escopo e escrita. Custo se essas condições forem inadequadas: gate fica sem certificação ou falha fechado por contenção1s; não autoriza ampliação de escopo, retry cego ou afirmar resiliência dos provedores externos.

Etapa13 continua aberta: replay/out-of-order de webhook real, retry/DLQ/recuperação do transporte Cloudflare em production, mutações Portal, imagens públicas deliberadas, realtime production, observabilidade/capacidade e estabilidade antes do cutover. Reenvio após resultado ambíguo precisa reconciliação com o Resend, não simples mudança de status SQL.
