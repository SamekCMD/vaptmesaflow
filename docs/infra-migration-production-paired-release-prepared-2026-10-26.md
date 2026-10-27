# Publicação pareada: pacotes preparados — 26/10/2026

## Estado deste gate

Preparação local e inventário GET-only concluídos. **Nenhum Worker foi publicado, recurso criado, flag ligada ou consumidor retomado nesta rodada.** O schema production009–012 já confirmado não foi reaplicado. API segue503, fila production pausada e cron de billing vazio.

Release fixada em `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/production-paired-release-v1`. Não refazer os builds apenas porque um commit documental mudou HEAD; validar os source trees, configurações e bytes fixados. Não sobrescrever o pacote ou usar o dist mutável como substituto.

## Fontes e artefatos

| Componente | Fonte fixada | Artefato principal |
| --- | --- | --- |
| API | A`d12725af458730e8a2208822337cff290cc305e9`, src`b5914e9323b74215442c2afc5e0f356f2f904c8c` | `realtime-entry.js`,4754027bytes, SHA256`7205822d6931cef363c3730c0f9ecd553a671857a79cdff678203e0c7cec8f94` |
| Billing | F subtree`4651c7276b6f373ef9b8df93e4c7774b4298c36a` | `index.js`,407543bytes, SHA256`6998387d92c999c6b036603d2353e960ea8ee214c65dbe75db9b6e0d5b72d587` |
| Frontend | F`474373c34e73d5837b1ca78e98e776f3ca6c0fde`, src`abf974816819797ba8ef88ec1edd215e4c3580a0` |92arquivos fixados,84JS; árvore SHA256`eeb9d4f1b0f4cafb692ac2331f2241c41407bdad7ff3211272ab6b1fd97cfcd1` |

API e billing gerados pelo Wrangler **4.138.0 instalado**, com `deploy --dry-run`, configuração explícita e saída isolada. Nenhuma atualização da ferramenta. O comando encerrou antes da publicação/triggers; o template de billing com cron não foi aplicado. Frontend gerado pelo build production-realtime já versionado: ambiente público fixado, realtime existente true e catálogo reader/writer/events false. Build-proof SHA256`380de080796fb5a23dd1d1fe9d90db2394a67b3ce68a3b2255d35f338a902480`.

Manifesto completo vincula nomes/tamanhos/hashes de4arquivos API,3billing e92frontend, incluindo assets e mapas locais. Os mapas/READMEs **não são módulos adicionais a publicar**. Configurações de origem foram copiadas e fixadas separadamente, como templates não executáveis diretamente do diretório da release; elas ainda precisam de adaptação explícita de caminhos e controles no operador autorizado.

- `manifest.json`: SHA256`2b81e2f5e228788e187480728ff4c7de08639356fa85024976471a0883170219`.
- `configuration-manifest.json`: SHA256`87ae63d3203d8da1aa472d8e88c27e4ff9eb674dc2058b632fbb8dc888474727`.
- A verificação offline em novo processo às21:42:20 confirmou todas as árvores/configurações, runtime-proof, recibo SQL já cometido e inventário de recursos. Manifesto é proteção contra troca acidental de artefatos, **não autorização de publicação**.

## API candidata continua em manutenção

Reutilizado o montador offline versionado para acrescentar o wrapper228bytes, SHA256`f4c53e3380f8dcbaf74e347731b142ee3ac54ce5c3c542aa255b8460067f0f32`, sobre os **novos bytes canônicos**, sem modificar seu conteúdo. Main de publicação inicial: `__vapt_production_maintenance__.mjs`; main canônico posterior: `realtime-entry.js`. Reexports preservam RestaurantRealtime e PublicCatalogCoordinator.

Workerd local carregou exatamente os dois módulos fixados e aceitou ambas as classes SQLite. Oito requisições — health, signup, pedido, webhook Stripe, socket catálogo, GET catálogo público, OPTIONS e HEAD — retornaram503/no-store/Retry-After60/sem Set-Cookie;0chamadas outbound, nenhum binding/credencial remoto, runtime encerrado. Não é prova de estado remoto dos DOs, CPU faturada ou ativação do catálogo. CPU configurada permanece1000ms, flags false.

`runtime-proof.json`, SHA256`f97ac2a9453cb1ec87d45f701e845ab5cf7af34a38c6051ad2780e97d6bf122b`.

## Delta de recursos confirmado, sem criação

GET-only às21:32:54, exit0/ok=true, `production-paired-resources-2026-10-27T00-32-54-732Z.json`, SHA256`4cd83547b7a1ccd0bf9220b672a1d9f35e5075c62b1b3bbb33531e4372dcf6f7`:

- API continua deployment`4fe1dde4`/version`29a56753`, CPU1000, oito secrets apenas por nomes/tipos, sem bindings de catálogo. Health503. Web`24d1b0fc/e77339dd` e Bproduction`da2a4249/1f578bc6` inalterados.
- **Bucket`vapt-catalog-production` já existe e está privado**: managed public=false, zero custom domains. Não precisa recriá-lo nem mexer no bucket de imagens. A API candidata só acrescenta seu binding.
- Inventário completo de namespaces encontrou apenas RestaurantRealtime no Worker production, ID`d3ad7a4008c64124b765f934986956da`, SQLite. **Falta criar o namespace SQLite de PublicCatalogCoordinator**, via migration aditiva da classe na publicação específica, sem recriar/apagar realtime ou copiar namespace de preview.
- Fila`69f033ad5eb6424c99b41d1baa7ff3ad` delivery_paused=true, consumer`8fb8e9ad983442aaab49079154d3d799` preservado, retention86400s, backlog aproximado0. Bcron vazio; seus dois secrets são somente DATABASE_URL e RESEND_API_KEY por metadados.

Não foram lidos valores de secrets, conteúdo de objetos R2 ou fonte remota; autenticação existente somente em RAM. Nenhum SQL remoto, nova credencial, alteração de plano, DNS/main ou aposentadoria de legado. O namespace adicional usa os serviços já contratados e pode gerar consumo; não é contratação de outro plano nem garantia de teto global deUS$20.

## Verificações desta preparação

- Frontend: **383/383**,74arquivos; guardas de build/aliases **18/18**; typecheck app/node exit0.
- Billing: **48passaram,3integrações PostgreSQL não executadas**, zero falhas; typecheck exit0. Casos não executados: preservação de destinatário congelado na migração; contato de billing da organização sem join owner/admin; republicação após expiração da reserva. A suíte comum não recebeu URL de PostgreSQL descartável. Não representar skips como prova nova de banco nem repetir o ensaio completo/backup/providers para esconder a limitação; cobertura PG anterior continua histórica.
- Guardas API/catalog/config/montador: **77/77**, zero skips. Três CLIs falharam inicialmente por restrição de subprocesso no sandbox; a execução permitida passou sem modificar aplicação ou relaxar guardas.
- Dois dry-runs, build frontend e prova workerd aprovados. API704 e integrações anteriores não foram repetidos ou apresentados como testes novos; fonte runtime permaneceu inalterada.
- Um bloqueio local inicial de spawn Git no montador ocorreu antes de qualquer escrita; a montagem offline permitida passou. Não foi uma tentativa de deploy, SQL ou provisionamento.

## Próximo gate, sujeito à autorização própria

Publicar os **três pacotes como um conjunto compatível**, em ordem controlada, sem abrir tráfego:

1. Fixar novamente versões, schema já aplicado, recursos e todos os hashes; criar journal exclusivo da publicação. Não repetir nenhuma migration SQL ou controlador consumido de manutenção/schema.
2. API canônica sob wrapper503, mantendo ingress/rotas/secrets/Hyperdrive/CPU1000/rates/realtime existentes; acrescentar binding do bucket privado e somente a classe/namespace SQLite PublicCatalogCoordinator, com as duas flags false. Reconfirmar fonte/configuração/namespace IDs e503. A migration aditiva precisa de autorização explícita; não contornar o alias bloqueado por uma publicação irrestrita.
3. Billing canônico por **content-only**, preservando exatamente cron vazio, fila pausada, producer/consumer/settings/DLQ e secrets. **Não usar o template como deploy integral:** ele contém `*/30 * * * *` e poderia reativar trabalho cedo demais.
4. Frontend pelos92arquivos fixados, mesmas URLs/rotas e flags de catálogo false; não recompilar com env ambiente nem publicar somente o frontend contra API antiga.
5. Novo processo de readback do conjunto, parando em divergência/estado parcial sem retry, restauração SQL ou rollback owner-only automático. API permanece503, cron vazio e fila pausada até outro gate de validação/liberação.

Essa publicação ainda **não ocorreu**. Também não está autorizada por manifestos/testes locais, nem inclui ativação de catálogo, abertura da API, retomada dos consumidores, integração/push/main, DNS, novos secrets ou serviços pagos. Etapa13/catálogo formal7/10 permanecem abertos. Registros originais, backup e journals SQL v1/v2 continuam preservados.
