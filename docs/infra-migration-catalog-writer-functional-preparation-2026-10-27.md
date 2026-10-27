# Prova funcional do writer — preparação em 27/10/2026

O [writer-only publicado](infra-migration-catalog-writer-published-2026-10-27.md) permanece o estado operacional de referência. Nesta continuação não houve chamada aos provedores, seed remoto, publicação ou mudança de flags. Foram preparados o probe HTTP e uma fixture menor para o futuro teste sintético.

## Probe HTTP delimitado

API `scripts/catalog-writer-probe.mjs`, sem CLI, fetch padrão, login, banco, seed ou limpeza. Exige sessão em memória e callback de preflight do controlador. Antes de escrever, confere alvo explícito, nome/slug `catalog-writer-<UUID>` e cardápio vazio; não opera em restaurante comum por fallback `/me`.

Percurso nominal de15 requests: criar item com variações, repetir a mesma chave e conferir item/versão, alterar disponibilidade/variações, patch privado sem revisão pública, patch misto, excluir item, rebuild e uma consulta/retry manual de operação já concluída. Usa seis IDs de operação distintos, header de protocolo e versões decimais sem conversão para Number. O replay é deliberado para verificar idempotência, não retry automático de uma resposta perdida.

No máximo24 requests/5min,15s por request e64KiB por resposta, redirect proibido e espaçamento padrão3,3s. Uma operação pendente permite **uma** consulta de status após5s; se continuar pendente, interrompe sem polling, próxima mutação ou limpeza cega. Relatórios só têm contagens/estágio/recibos seguros; corpo de erro e cookie não são impressos. Estes testes usam HTTP sintético, não provam execução no Worker ativo ou uma aplicação SQL única.

## Fixture de um owner

`createProductionCatalogWriterFixtureDriver` em API `scripts/tenant-preview-fixtures.mjs` reaproveita a conexão direta restrita e o ciclo transacional já existente, mas com **um owner verificado, uma organização Business e um restaurante** de UUIDs aleatórios e marcador próprio. As factories preview/produção de cinco contas conservam seu comportamento e rejeições de ambiente.

O seed é único; resposta COMMIT incerta não admite limpeza automática. A limpeza usa locks, verifica identidades/membership/ownership e mantém as recusas anteriores de efeitos de billing/onboarding/catalog/payment. A nova fixture também recusa sessões abertas, itens, pedidos, mesas e revisões restantes **antes de qualquer DELETE**. Não fornece bypass para apagar journal ou artefatosR2: a aposentadoria/quiescência correspondente precisa de gate próprio antes da limpeza final.

O restaurante começa finalizado apenas para isolar este primeiro probe de CRUD. Isso não é prova de onboarding, múltiplas unidades ou imagens. A restauração de paridade tenant e o smoke de cinco contas já encerrados não foram repetidos como substitutos.

## Verificação local

- 14 testes novos do probe: implementação ausente RED → GREEN, incluindo alvo/versão/replay inválidos, resposta perdida, sessão ausente, cancelamento, status pendente e limite de stream.
- 3 testes novos da factory: export ausente RED → GREEN; regressões anteriores preservadas. Focados25/25.
- Novo modo local `--only=catalog-writer --through=012`: inicialmente recusado antes de abrir servidor; depois implementado no harness existente. Não aceita schema anterior nem URL remota/ambiente implícito.
- PostgreSQL real descartável loopback:4/4, com hash BetterAuth real, constraints/membership e preservação de identidade alheia; limpeza recusada com sessão, item ou revisão remanescente. Só a fronteira de identidade/TLS externa foi substituída para usar o banco local; não é prova de TLS/Neon remoto.
- Toda a suíte de operadores API462/462 e testes da aplicação API704/704, sem falhas/skips. Fontes de runtime e configurações de deployment não mudaram; sem rebuild ou repetição dos canários.

Logs no workspace próprio `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan`: `catalog-writer-probe-red.log`, `catalog-writer-probe-green.log`, `catalog-single-owner-fixture-red.log`, `catalog-writer-preparation-focused-green.log`, `catalog-writer-local-pg-mode-red.log`, `catalog-writer-local-pg.log`, `catalog-writer-api-all-scripts.log`, `catalog-writer-api-unit-tests.log`.

## Ainda não executar remotamente

Faltam o controlador one-shot atual, prova de fechamento das sessões do alvo sintético, aposentadoria R2/journal/revisões segura e a integração com login humano/Turnstile. O bridge antigo é de cinco logins e não será mostrado como se fosse um teste de um único owner. Não reaproveitar o journal consumido nem a limpeza preview do canário8MiB, que pressupõe fechamento global do writer.

Depois desta preparação ainda serão necessárias provas de imagens/quota/referências, onboarding, recuperação de trabalho efetivamente pendente e clientes ativos. Não afirmar que os testes HTTP sintéticos provam esses casos, nem ativar o reader/eventos. Total formal7/10, tarefas5/9/10 e Etapa13 abertas; sem main/push/merge ou garantia financeira.
