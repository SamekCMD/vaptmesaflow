# API production: preparação para retirar manutenção — 27/10/2026

## Resultado desta rodada

Preparação local e readback GET-only concluídos. **A API não foi aberta, nenhum Worker publicado e nenhuma flag/fila/cron alterada.** Não se repetiu SQL, backup, ensaio de restauração ou build dos pacotes. A aplicação não foi modificada.

Workerd local carregou diretamente o módulo canônico congelado `realtime-entry.js`,4754027bytes, SHA256`7205822d6931cef363c3730c0f9ecd553a671857a79cdff678203e0c7cec8f94`, sem o wrapper de manutenção. Usou variáveis sintéticas, limites nativos locais e as duas classes SQLite, sem credenciais ou bindings remotos. **12controles passaram**:

| Controle | Resultado |
| --- | --- |
| GET e HEAD `/health` |200; GET`status:ok`, HEAD vazio |
| GET `/auth/me`, `/account/bootstrap`, `/restaurants/me`, `/billing/stripe/subscription`, sem Cookie |401`unauthorized` em cada rota |
| Catálogo público por slug e socket de catálogo, flags false |404`not_found` |
| Socket realtime sem origem autorizada |403`forbidden` |
| Rota inexistente |404`not_found` |
| Preflight do frontend autorizado |204, origem/credenciais/headers de catálogo e idempotência corretos |
| GET `/auth/me` com origem do frontend, sem Cookie |401 e CORS correto |

Nenhum caso enviou POST, criou conta/pedido, disparou email, acessou pagamento ou recebeu Set-Cookie. Zero chamadas HTTP outbound; runtime encerrado. Isso **não** comprova valores dos secrets remotos, conexão Hyperdrive, login positivo, operações de tenant autenticadas, ativação do catálogo, entrega de provedores, CPU faturada ou teto financeiro. A conexão de banco local é apenas um endereço sintético sem servidor; não foi usada como prova de PostgreSQL.

## Estado remoto novamente conferido

Readback independente às01:24:52SP, exit0/ok=true/remoteWrites0:

- API deployment`b877793d-73c9-4754-bab5-a6a951c5c0c4`, versão`4089ee21-2eec-4a5f-8031-f515d5cff5c5`; mantém503/no-store/Retry-After60, CPU1000,8secrets por metadados e bindings/rate limits/ingress esperados.
- Billing deployment`e9db2125-fec9-4871-9854-d7532f54dc19`, versão`b156056a-c5b5-4f14-94c3-65bfd6097fd6`; cron vazio, fila pausada, consumer/DLQ preservados, backlog aproximado0.
- Frontend deployment`80be8dff-3cba-490e-b631-515d628cc7f9`, versão`adca3965-b132-4837-96ba-2e647b08d1c4`;91assets e85headers de cache corretos, sem servir `_headers` como arquivo de controle.
- Catálogo reader/writer false, bucket de snapshots privado, namespace`1e226bebcddc47079def5ed60beb73df` e realtime`d3ad7a4008c64124b765f934986956da` preservados. Módulos API/billing conferidos por hashes.

Fonte runtime não mudou: F/src`abf974816819797ba8ef88ec1edd215e4c3580a0`; A/src`b5914e9323b74215442c2afc5e0f356f2f904c8c`. Não reexecutar publicadores consumidos para conferir esses dados.

## Próximo gate: liberação restrita da API, ainda sujeito à autorização

O desenho usa o Worker/domínio já existentes: publicação **content-only** do mesmo módulo canônico, main`realtime-entry.js`, retirando a resposta fixa503. Mantém configurações, secrets, CPU1000, rates, Hyperdrive, R2, namespaces, origens e rotas. Não cria URL/bearer/Access, recurso ou plano; não habilita catálogo nem retoma billing.

Isso **reabre os endpoints normais da API na internet**, inclusive autenticação e funções já existentes; não é um canário privado. O primeiro conjunto de verificações do operador será somente GET/HEAD/OPTIONS sem Cookie, equivalente aos controles locais acima. Não deve chamar `/health/ready`, catálogo legado que lê SQL, signup, Checkout, webhook, envio de email ou fixture só para comprovar a retirada da manutenção. Login positivo/CRUD/catálogo/billing seguem gates próprios.

Antes de executar: implementar/testar um operador restrito de tentativa única, com journal próprio ainda não criado, versões/configuração/fonte fixadas e diagnóstico seguro por etapa. Conferir novamente o estado remoto e a prontidão SQL necessária sem reaplicar migrations. Após upload, verificar bytes/configuração/versão antes dos controles HTTP. Não usar alias genérico bloqueado ou upload avulso para contornar o gate.

Se houver divergência ou resposta de escrita perdida, não repetir/renomear journal nem retornar à versão owner-only. Reconciliar por leitura. A opção segura de contenção é **o wrapper503 sobre o mesmo módulo tenant já publicado**, sem rollback de schema ou perda de classes; qualquer escrita de contenção precisa estar explicitamente incluída no escopo autorizado. Não restaurar cron/consumer como efeito colateral de retirar manutenção.

## Evidências e limites de conclusão

Workspace `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan`:

- `production-api-canonical-admission-proof-2026-10-27T04-24-14-198Z.json`, SHA256`0550997820647dc87043cb71f9c05f5db98b41364084fb0e73f21e837d3984b1`:12controles,0HTTPoutbound, runtime encerrado.
- `production-frontend-cache-fix-independent-2026-10-27T04-24-52-111Z.json`, SHA256`a954d24673f3818d96bb228747b11d133ea5bc5419e69c873dae9b0b558f8812`: readback remoto novo, sem mutações.

Nenhum controlador remoto de abertura foi executado ou journal consumido nesta rodada. Não houve nova suíte completa da aplicação porque seu código não mudou; os383frontend/70guardas da correção anterior permanecem evidência histórica, não testes novos. Etapa13/T5/T9/T10 continuam abertos; esta prova não conclui a migração nem autoriza abertura de tráfego, retomada de billing, ativação do catálogo, push/main ou retirada de legado.
