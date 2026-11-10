# Login e isolamento de unidades em production — verificado em 27/10/2026

O teste remoto passou: **67 verificações**, com cinco usuários sintéticos, duas organizações e três unidades. Os cinco logins usaram Better Auth e desafios Turnstile reais. A limpeza dos dados sintéticos foi confirmada em uma leitura posterior ao COMMIT; nenhum resíduo dos IDs do manifesto permaneceu.

## O que foi comprovado

- Sessão positiva dos papéis owner, admin, manager e staff, incluindo um segundo owner de outra organização.
- Bootstrap com organizações, capacidades e unidades corretas, sem campos privados de billing no DTO operacional.
- Leitura das unidades autorizadas e negativas403 para leitura, bootstrap e preferência envolvendo outra organização.
- Limites Business25/Pro1, contagem e permissão de criar unidades conforme o papel, sem realmente criar uma unidade via aplicação.
- Seleção persistente da própria unidade e bootstrap com unidade explícita.
- Negativa403 para staff alterar configurações do restaurante.
- Logout dos cinco usuários e rejeição401 dos respectivos cookies anteriores.

Os usuários verificados e suas credenciais aleatórias foram semeados diretamente como fixtures marcadas. Este teste **não** comprova signup, verificação por email, todo CRUD permitido, pedidos, uploads, pagamentos ou entrega de provedores. As assinaturas Business/Pro eram registros sintéticos locais ao banco, sem objetos Stripe.

## Execução e limpeza

Após o usuário retomar a validação e iniciar a página local, o preflight somente-leitura de14:02:50SP confirmou API aberta, deployments esperados, configurações e controles preservados. O controlador também exigiu quota Neon216000s e endpoint de production fixo0,25CU antes de obter a conexão direta com TLS verificado.

O operador executou uma única tentativa, sem retry automático. Os desafios foram concluídos pelo usuário; não houve dummy token de preview, Access/bearer, senha ou cookie no chat/Git/recibos. Houve espaçamento entre as requisições e prazo máximo de20min.

A limpeza validou marcadores, ownership e conjunto exato de relações sob locks antes de remover somente as fixtures. O pool foi liberado antes da leitura independente de resíduos, que retornou zero para os IDs envolvidos. Isso **não** afirma que o banco inteiro esteja vazio nem autoriza apagar outros dados.

O processo49533 terminou com exit0. Às14:08:56SP, outra conferência validou o recibo e comprovou que o listener local60906 estava encerrado (`ECONNREFUSED`). O marcador consumido deve ser preservado; não reexecutar ou renomear o controlador para repetir a tentativa.

## Estado preservado

O preflight confirmou API deployment`e2d1a9fb-c015-4876-8063-101017383280`, versão`baa2eff4-d3a8-4b96-978f-ae3e6c644319`; billing`e9db2125-fec9-4871-9854-d7532f54dc19`/`b156056a-c5b5-4f14-94c3-65bfd6097fd6`; frontend`80be8dff-3cba-490e-b631-515d628cc7f9`/`adca3965-b132-4837-96ba-2e647b08d1c4`, todos100%.

Nenhum deploy, alteração de schema/grants, recurso, secret, DNS, plano pago, push ou merge foi realizado nesta execução. Nenhum email ou pagamento foi disparado. Billing permanece com fila pausada/cron vazio e catálogo reader/writer desativados; este controlador não os altera. Não houve uma nova leitura de todo o control plane após o smoke: as versões/configurações acima são o preflight efetivo, não um postflight inventado.

## Evidências

No workspace ignorado do plano `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan`:

| Artefato | SHA256 |
| --- | --- |
| `production-tenant-session-smoke-v1-2026-10-27T16-55-09.456Z.json` | `2c3a954b703826cd46e412dff2d21646632e13b720e9555b0bb29b256b669af7` |
| `production-tenant-session-smoke-v1-start.json` | `b2ddce0617fc439339b004a3f5f5b99b53c2f0098893070f15441b56e5d2654b` |
| `production-tenant-session-smoke-v1-controller.mjs` | `f813d3b95e2599288515d3e1f5341941b4d90bf71d0d435611ac039f7be6427a` |
| `production-api-admission-independent-2026-10-27T17-02-50-614Z.json` | `a2b2c42dc508984aa531d54c7e2bcf5bde9872f36f8db38f0d8bcbdd45433ec3` |

O timestamp16:55:09Z no nome/at do recibo é o início do controlador, não o fim dos testes. A preparação e seus testes locais estão documentados separadamente em `infra-migration-production-tenant-smoke-preparation-2026-10-27.md`, commits API`f96cb01`/frontend`cbe3d59`; não foram repetidos como se fossem testes novos desta execução.

Este gate positivo de sessão/isolamento está concluído. Etapa13 e os contratos completos T5/T9/T10 continuam abertos. Próximos gates: retomada controlada do billing e ativação/recuperação do catálogo, com seus próprios testes; depois estabilidade, evidências finais e integração canônica na main. Não há garantia de teto global de fatura.
