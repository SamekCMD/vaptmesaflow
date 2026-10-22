# Promoção pareada — readiness22/10/2026

Continuação da Etapa13 e T5/9/10 do catálogo, após o encerramento local do plano de paridade. Este checkpoint prepara o procedimento; não executa promoção, SQL, flags ou merge.

## Atualização após upgrade feito pelo usuário — 22/10

O usuário informou que contratou Launch. GET autenticado do projeto existente `dawn-morning-27332079` confirmou `owner.subscription_type=launch_v3`, com novo período de consumo `2026-10-22T20:31:28Z` → `2026-11-01T00:00:00Z` e contador aproximado `compute_time_seconds=0`. Isso substitui o bloqueio histórico por franquia Free nesta página, mas não comprova conectividade SQL, fatura zerada ou gates de promoção concluídos.

Readback somente-leitura dos dois endpoints esperados: production `ep-holy-wildflower-b6vtv1dd` e preview `ep-hidden-bird-b673zocn`, ambos `idle`, `disabled=false`, mínimo0,25CU e **máximo8CU**. O máximo anterior era2CU; os defaults do projeto também retornam0,25→8CU. `suspend_timeout_seconds=0` foi preservado no retorno, sem interpretar esse valor bruto como suspensão desabilitada. Histórico configurado21600s.

Não há `quota` personalizada no objeto de projeto ou em `settings`; GET do threshold de gastos da organização retornou `spending_limit_cents=null`. Portanto não foi verificado um bloqueio de consumo nem alerta de gastos configurado. [Alertas de gastos](https://neon.com/docs/introduction/spending-notifications) não interrompem uso; [cotas por projeto](https://neon.com/docs/guides/consumption-limits) são limites de métricas, não teto monetário global, e podem suspender os dois ambientes. A ausência de quota não significa quota zero.

O usuário aprovou explicitamente fixar ambos os endpoints em0,25CU e a cota conjunta60CU-h/mês, ciente da suspensão dos dois ambientes ao atingir a cota, e pediu continuação do plano. Aplicados somente `settings.quota.compute_time_seconds=216000` no projeto e mínimo/máximo0,25CU nos dois endpoints existentes. GETs posteriores confirmaram a cota e ambos0,25→0,25CU, `disabled=false` e `suspend_timeout_seconds=0`. O esquema oficial consultado define0 como default do plano, não como suspensão desabilitada. Nenhum alerta ou default de futuros endpoints foi alterado; o default máximo8CU permanece e não autoriza criar outro endpoint. Quota é compartilhada por todas as branches/computes do projeto, não60CU-h para cada ambiente.

Referência de custo, não fatura/teto:60×[US$0,106/CU-h](https://neon.com/pricing)=US$6,36 de compute. Storage/history, eventuais excedentes e outros provedores são separados; métricas/quota não certificam bloqueio monetário instantâneo. MetaUS$10–15/máximoUS$20 permanece. Não contratar serviços adicionais nem confundir o alerta, ainda ausente, com bloqueio de uso.

## Preflight remoto retomado após os controles

Conexões diretas com TLS verificado, projeto/branch/endpoint/database/role fixos e credenciais apenas em memória. Nos dois ambientes, transações `READ ONLY`, deadlines locais e `ROLLBACK`; conexões encerradas em finally. Nenhuma mutation de domínio/schema foi executada.

- Preview e production: conexão SQL aprovada. `restaurants`, `better_auth.user`, `billing_provider_events`, `billing_email_outbox` e `payment_effect_outbox` contaram0; estados de billing/email vazios e owners órfãos0. Não equivale a afirmar que todo o banco está vazio ou que nunca haverá novos writers.
- Sete verificações versionadas passaram em cada ambiente: baseline, routines, integrity, Better Auth, Stripe billing, email delivery e ACL da role própria. Ambas as roles sem atributos administrativos; overrides de banco retornaram `statement_timeout=8s` e `lock_timeout=2s`. Isso não é prova das configurações efetivas via Hyperdrive.
- **Objetos da009 ausentes em ambos:** `public.catalog_publication_operations` não existe. Objetos tenant010–012 pesquisados também ausentes. Portanto não partir da premissa de001–009 já implantadas: preservar001–008, conferir backup/restauração, aplicar009 original e seus grants antes de010–012, primeiro no preview, após autorização própria. Nenhum arquivo histórico foi reescrito.
- Operador restrito `catalog-preview-inert.mjs inspect` retornou exit0, mesma implantação27 `7b51fca2-207e-4e29-948e-159761b362ea`, preparado/CPU configurada1000ms, workload não verificado e `activationReady=false`. Nenhum deploy/flag/namespace modificado.

Usuário aprovou backup protegido, restauração em PostgreSQL local descartável e, condicionada às provas, aplicação009–012 com grants somente de preview. [Backup/restauração, ajuste mínimo da010 e ensaios](infra-migration-preview-schema-gate-2026-10-22.md): arquivo protegido e restore com ACLs idênticas, oito SQLs ensaiados também em transação única/locks; regressão nova RED→GREEN, F383/A701/PG93 sem skips e buildA0. Aplicação remota ainda pendente neste checkpoint. Produção, publicação de código e ativação continuam fora desse gate. Não usar a leitura pontual sem pendências como substituto do controle de admissões/drain antes de futuras migrations.

## Candidatos e CI já conferidos

- F`a4eb545ff6e098ef0c8a7e3552b09d085cb34d40`, [PR#4](https://github.com/SamekCMD/vaptmesaflow/pull/4): [CI push39799968361](https://github.com/SamekCMD/vaptmesaflow/actions/runs/39799968361) e [PR39799976688](https://github.com/SamekCMD/vaptmesaflow/actions/runs/39799976688), completed/success.
- A`7d5604f404cd62b6d18a27d9851172701895faa9`, [PR#1](https://github.com/SamekCMD/vapt-api/pull/1): [CI push39800006430](https://github.com/SamekCMD/vapt-api/actions/runs/39800006430) e [PR39800006431](https://github.com/SamekCMD/vapt-api/actions/runs/39800006431), completed/success.
- São SHAs funcionais/documentais anteriores a este checkpoint; uma atualização documental posterior não é novo comportamento de runtime e exige seu próprio status de CI. Não atribuir os runs acima a outro SHA.
- Código pareado: frontend/migrations/consumidor em F; API/Worker em A. PR frontend#3 já incorporado e #2 Vercel legado encerrados sem merge. Branches/WIPs preservados. Main não integrada por opção2.

## Gates, sem confundir prova local com remota

| Gate | Evidência disponível | O que ainda impede promoção |
| --- | --- | --- |
| Paridade funcional/capabilities | 16 tarefas concluídas; revisão independente com dois Important corrigidos; F383/A701/PG92/workerd30 no checkpoint final22/10 | Não comprova o código, schema ou grants em execução |
| Qualidade/artefatos | Tipos/builds e CI dos SHAs acima aprovados; guards e dry-runs sem publicação | Nenhum artefato novo publicado por este checkpoint |
| Capacidade Neon | Launch confirmado; cota conjunta216000s/60CU-h e dois endpoints0,25→0,25CU aplicados com aprovação/readback; SQL READ ONLY conectou | Não é teto global de fatura; sem novas cargas por inferência |
| Schema/grants tenant | Migrations010–012 e grants ensaiados em PostgreSQL descartável; baseline/ACL antiga aprovados nos dois ambientes remotos, objetos009–012 ausentes | Backup/restauração e aplicação/readback de009→012 em ordem, sob gate e protocolo de drain; arquivos históricos intactos |
| Writers/clientes ativos | Inventário canônico local atualizado; gateways Worker e clientes testados | Confirmar quais versões/processos realmente escrevem, inclusive Node/Coolify; nenhum bypass ativo antes do reader |
| R2/DO e CPU | Recursos privados preparados historicamente; local workerd/SQLite; CPU configurada1000ms e snapshot limitado8MiB | Readback atual de privacidade/bindings, workload/CPU suportado, publicação e rollback compatível; tempo de parede não é CPU |
| Bootstrap e canário | CLI estrito, sessão protegida e UUID explícito; dry-run0writes nos dois ambientes | Capacidade, permissões e writer controlado antes de apply; ready/recuperação e reader canário separados |
| Operação/custos | Workers Paid já ativo; rates/limites existentes, meta pessoalUS$10–15/máximoUS$20 | Estabilidade/consumo real, backup final e dependência zero; limites não são teto global de cobrança |

Os números de testes são evidências datadas já executadas, não novas execuções completas neste checkpoint documental. Logging persistido reprovado continua desligado; esta continuação não reprojeta observabilidade nem cria alertas/automação.

## Conferência local desta continuação

Conferidos os fontes A`src/worker/routes/{account,restaurant,misc}.ts`, `src/worker/catalog/writer.ts` e `scripts/bootstrap-public-catalog.ts`, no HEAD`7d5604f`. O operador usa GET/POST do mesmo restaurante explícito; `/me` não é necessário e a preferência não é autoridade.

Checks offline `node scripts/catalog-operator.mjs check preview` e `check production`: exit0/oktrue, **activationReadyfalse**, gates pendentes explícitos. A lista conservadora do operador não é um leitor do ledger de testes: `postgres-integration`/`final-review` nela não anulam as provas locais já registradas, nem as convertem em provas remotas.

CLI real, sem `--apply`, com UUID sintético `30000000-0000-4000-8000-000000000001` em preview e production: exit0, `targets:1`, `writes:0`, `mode:dry-run`. Por implementação, esse caminho retorna antes de ler sessão ou chamar fetch. Não houve GET de catálogo, bootstrap remoto ou fixture criada.

Testes focados executados nesta continuação: `npm run test:catalog-config`69/69 e `npm run test:catalog-bootstrap`27/27, exit0. Adaptadores de rede/provedor são sintéticos nos testes; o caso nomeado "inert apply" não executa apply remoto. Não foi necessário fabricar RED ou alterar código de runtime para corrigir a documentação humana.

## Ordem futura corrigida — não executar agora

1. Congelar SHAs compatíveis e conferir CI; não juntar branches antigas sem análise de comportamento nem ativar auto-merge.
2. Fechar capacidade e backup/restauração, bloquear admissões incompatíveis e drenar comandos/claims com consumers compatíveis. Não descartar journal, efeitos aceitos, leases ou dados.
3. Aplicar/validar schema e grants canônicos na ordem; preparar API/consumidor e frontend de recibos compatíveis, inicialmente sem reader. Conferir os recursos/configuração reais de cada ambiente.
4. Somente depois dos gates e autorização de janela/canário: disponibilizar writer e cliente compatível sob controle, ainda readerfalse. O rebuild é writer-only; com writerfalse recebe404. Não habilitar reader ou aceitar tráfego irrestrito para fazer esse ensaio.
5. Bootstrap autenticado do alvo explícito com operationId preservado; confirmação manual de publicação/recuperação, privacidade e CPU antes da liberação ampla. Resposta perdida não autoriza outra chave ou retry automático.
6. Reader/frontend canário após snapshots prontos e ausência de bypass. Produção repete os gates com seus IDs/segredos próprios, reutilizando o código, não recriando funcionalidades.
7. Em rollback, manter executor de efeitos aceitos e versão compatível com schema tenant; nunca owner-only depois de dados multi-tenant. Reader desligado não equivale a desfazer um commit.
8. Só após estabilidade/consumo e backup/dependência zero retomar desligamento/cancelamento de Hetzner. Não repetir DNS Vercel nem procurar Easypanel.

Decisão documental: corrigir "bootstrap antes de writer" para refletir a guarda real, sem alterar seu código nem afrouxar gates. Custo se a interpretação estiver errada: o procedimento precisará ser ajustado antes de qualquer ação remota; nenhuma flag foi ligada por esta decisão.

Resultado: preparação local de promoção atualizada; catálogo permanece7/10 formalmente e Etapa13 aberta. Os próximos passos operacionais precisam de capacidade/evidência e autorização do gate, não de outra rodada de testes locais já aprovados.
