# Migração — reconciliação das branches locais

Snapshot18/10/2026, **sem fetch, checkout, merge, cherry-pick, push ou alterações nas outras branches/worktrees**. Não é revisão funcional concluída nem aprovação de main/deploy. Complementa o [procedimento de integração](infra-migration-branch-integration.md).

## Bases examinadas

| Repositório | Candidata examinada | Main local | Divergência main…candidata |
| --- | --- | --- | --- |
| `SamekCMD/vaptmesaflow` | `codex/infra-foundation` / `6b53574` | `9b576c1` | 0 commits exclusivos da main;161 exclusivos da candidata |
| `SamekCMD/vapt-api` | `codex/infra-foundation` / `ab24eb0` | `cebaed4` | 0 commits exclusivos da main;153 exclusivos da candidata |

Essas contagens são anteriores aos commits desta documentação. Só descrevem refs locais; não provam estado remoto/CI, ausência de conflitos futuros ou que funcionalidades de branches divergentes já estejam preservadas.

## Trabalho já presente por ancestralidade

- Frontend: `codex/billing-email-queue`, `codex/billing-email-queue-projects`, `codex/multitenant-onboarding`, `codex/payment-settings-transition`, `codex/payment-status-return`, `feat/payment-providers-v2`.
- API: `codex/cors-vercel-previews`, `codex/mercado-pago-oauth-stage8`, `codex/mp-checkout-diagnostics`, `codex/payment-effects-stage7`, `codex/payment-oauth-preview-return`, `feat/payment-providers-v2`.

Não importar esses históricos de novo. Presença em Git não substitui reteste dos comportamentos finais. Isso também não autoriza investigar DNS/infra legados.

## Equivalência de patches — não duplicar trabalho

`git log --left-right --cherry-mark --no-merges` confirmou os pares abaixo com `=`; `git cherry` e `--cherry-pick` não encontraram patch exclusivo adicional nessas branches.

| Repositório / branch antiga | Patch antigo | Patch equivalente na candidata | Assunto |
| --- | --- | --- | --- |
| Frontend `codex/payment-effects-stage7-db` | `a427867` | `1abe083` | Processamento seguro de efeitos |
| API `codex/mercado-pago-oauth-stage8-workspace` | `4e3db74` | `ab78cb5` | Conexão OAuth segura |
| API `codex/payment-effects-stage7-work` | `16db546` | `b929be8` | Reprocessamento idempotente |

Decisão de preparação: não repetir cherry-pick ou execução SQL desses patches só porque o SHA/branch é diferente. Equivalência do patch não certifica o ambiente ou que mudanças posteriores preservaram o comportamento.

## Famílias divergentes — contagens sobrepostas

| Repositório / branch | Tip | Commits sem equivalência de patch na comparação | Tratamento pendente |
| --- | --- | ---: | --- |
| Frontend `codex/multitenant-v2` | `4299d94` | 30 | Conferir seleção de restaurante, organização, papéis, onboarding e limites |
| Frontend `codex/e2e-regression-cleanup` | `8e02d4d` | 37 | Contém a anterior; conferir correções/regressões sem restaurar Supabase |
| Frontend `codex/infrastructure-recovery` | `c9fcc17` | 40 | Contém as duas anteriores; recuperação antiga não deve substituir Neon/Better Auth/R2 |
| API `codex/jwks-auth-transition` | `8b13337` | 2 | JWT/JWKS Supabase não substitui as sessões Better Auth atuais |
| API `codex/membership-authorization` | `d378780` | 5 | Contém a anterior; separar intenção de autorização por membership da autenticação antiga |
| API `codex/infrastructure-recovery` | `25d7642` | 6 | Contém as duas anteriores; comparar requisitos/limpeza de runtime, não aplicar wholesale |

Cadeias confirmadas por `merge-base --is-ancestor`: frontend `multitenant-v2 → e2e-regression-cleanup → infrastructure-recovery`; API `jwks-auth-transition → membership-authorization → infrastructure-recovery`. **Não somar30+37+40 nem2+5+6** como trabalhos independentes. Foram usados commits sem merge em `log --right-only --cherry-pick HEAD…branch`; número de commits não é quantidade de funcionalidades ausentes.

## Diferença funcional concreta — requisito existente a restaurar

O commit frontend `4299d94` introduz `RestaurantSwitcher`, adição/seleção de restaurantes e entitlement por organização/papel/plano. A branch usa Supabase/RPC para essa autorização. Na API, `72bb04e` introduz autorização por membership. Não basta copiar esses arquivos para a arquitetura atual.

Na candidata examinada, `infra/neon/004_business_constraints.sql` cria `restaurants_owner_id_unique` e documenta **um restaurante por dono**. O frontend usa `GET /restaurants/me`; `findOwnedRestaurant` da API busca `owner_id` com `limit1` e o verificador de acesso compara owner diretamente. O seletor/entitlement da branch antiga não está presente no código atual examinado. A menção a organizations/roles no plano original não prova que a transição de todos esses comportamentos tenha sido concluída.

**Requisito existente confirmado pelo usuário em18/10:** preservar múltiplos restaurantes e permissões de equipe. Não é uma nova decisão de produto nem um adiamento aprovado. Em `4299d94`, Starter e Pro permitem1 restaurante e Business até25; a API `72bb04e` define papéis owner/admin/manager/staff e capacidades por operação. O pedido para não preservar UUIDs/contas de teste não autorizou reduzir essas funcionalidades.

A restauração exige port para Neon+Better Auth e reconciliação das operações, não reintrodução de JWT/Supabase nem remoção isolada do índice. **Ainda não implementada nesta candidata.** A [auditoria funcional de18/10](infra-migration-functional-parity-audit-2026-10-18.md) registra também outras lacunas encontradas, separando comportamento existente, requisito ainda incompleto e substituição intencional de infraestrutura.

## Alterações locais fora dos tips — preservar

Leitura de `git status --porcelain` nos worktrees existentes em D: encontrou, além do checkout atual:

| Repositório / branch | Entradas tracked alteradas | Entradas untracked |
| --- | ---: | ---: |
| Frontend `codex/e2e-regression-cleanup` | 2 | 2 |
| API `codex/membership-authorization` | 5 | 7 |
| API `codex/payment-effects-stage7` | 0 | 2 |

Conteúdo não classificado nem modificado; estes arquivos não estão representados somente pelos SHAs acima e precisam ser preservados/reconciliados antes de integração/limpeza. A candidata frontend conserva os dois documentos financeiros alterados e `docs/implementation-references/` anteriores. Outros worktrees D: examinados estavam limpos. Há registros antigos de worktrees em C:, inclusive registros prunable; não foram abertos, movidos, apagados ou podados. Nenhum worktree novo foi criado fora de D:.

Próximo passo: restaurar os requisitos confirmados por integração seletiva compatível com a arquitetura atual, completar a matriz de comportamento/testes e validá-la antes de main. A [capacidade Neon](infra-migration-capacity-readback-2026-10-18.md) continua um gate separado para SQL/bootstrap remotos; nenhuma alteração paga ou tentativa SQL foi usada para destravar esta análise.
