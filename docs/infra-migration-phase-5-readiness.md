# Fase 5 — Gate de acesso a dados antes do Better Auth

Data da reavaliação: 26/09/2026.

## Resultado

**Gate de dados autenticados: GREEN.**

As Tasks 1–9 do cutover de negócio moveram onboarding, restaurante, cardápio,
cozinha, caixa, overview, feedback, solicitação de conta, push subscriptions e
estado local de billing para rotas da API apoiadas em PostgreSQL/Neon. O browser
não envia mais access token Supabase para essas operações e nenhuma delas depende
de `auth.uid()` ou RLS Supabase.

```text
GREEN: no authenticated frontend operation depends on a Supabase access token or auth.uid().
The Better Auth frontend cutover may proceed with Tasks 6–9.
```

O `AuthContext` e duas ações de conta em `SettingsPage` ainda usam
`supabase.auth` exclusivamente como implementação temporária de identidade. Eles
não transportam operações de negócio e serão substituídos pelas Tasks 6 e 7 do
plano Better Auth. Não existe ponte JWT Supabase/Better Auth.

## Evidência por superfície

| Surface | Estado após o cutover | Transporte atual |
|---|---|---|
| `src/pages/onboarding/OnboardingPage.tsx` | GREEN | `POST /onboarding` com cookie |
| `src/pages/dashboard/AppearancePage.tsx` | GREEN | `GET/PATCH /restaurants/me` |
| `src/pages/dashboard/SettingsPage.tsx` — restaurante | GREEN | `GET/PATCH /restaurants/me` |
| `src/pages/dashboard/SettingsPage.tsx` — nome/senha | identidade pendente | `supabase.auth` até Better Auth Task 7 |
| `src/pages/dashboard/MenuManagement.tsx` | GREEN | CRUD autenticado de menu + R2 |
| `src/pages/dashboard/KitchenMonitor.tsx` | GREEN | fila/status autenticados da API |
| `src/pages/dashboard/CashierPage.tsx` | GREEN | sessões/caixa autenticados da API |
| `src/components/cashier/TableSessionModal.tsx` | GREEN | close/transfer transacionais da API |
| `src/pages/dashboard/Overview.tsx` | GREEN | snapshot owner-scoped da API |
| `src/components/menu/FloatingActions.tsx` | GREEN | rota pública limitada por order token |
| `src/lib/order-feedback.ts` | GREEN | rota pública limitada por order token |
| `src/lib/push-notifications.ts` | GREEN | sessão Better Auth + owner derivado no servidor |
| `src/lib/n8n-client.ts` | GREEN | cookies via `vaptApiRequest`; sem bearer Supabase |
| `src/contexts/AuthContext.tsx` | identidade pendente | substituição prevista na Better Auth Task 6 |

## Contratos que fecharam o gate

| Route | Auth | Garantia principal |
|---|---|---|
| `POST /onboarding` | cookie | cria restaurante e primeiro item atomicamente |
| `GET/PATCH /restaurants/me` | cookie | owner sempre derivado da sessão |
| `/restaurants/me/menu-items*` | cookie | CRUD de item/variação owner-scoped |
| `/restaurants/me/kitchen/orders*` | cookie | fila e máquina de estados owner-scoped |
| `/restaurants/me/table-sessions*` | cookie | leitura, close e transfer transacionais |
| `GET /restaurants/me/overview` | cookie | período calculado uma vez no servidor |
| `GET /public/restaurants/:slug/catalog` | public | DTO público sem campos internos |
| `POST /public/table-sessions/:sessionId/request-check` | order token | sessão limitada ao pedido validado |
| `PUT /public/orders/:orderId/feedback` | order token | identidade do pedido/restaurante derivada no servidor |
| `POST /ingest/push-subscription` | cookie | restaurante derivado do owner; upsert por endpoint |
| `POST /billing/stripe/checkout` | cookie | plano limitado a enum; preço e e-mail resolvidos no servidor; resultado persistido owner-scoped |
| `POST /billing/stripe/subscription/change` | cookie | preço resolvido no servidor e plano retornado deve coincidir com o solicitado |
| `GET /billing/stripe/subscription` | cookie | leitura owner-scoped diretamente do Neon, sem round-trip pelo n8n |

Todos os contratos frontend/API autenticados usam camelCase. A rota legada de
compatibilidade `POST /ingest/order-feedback` ainda aceita os campos snake_case
do antigo chamador n8n, mas delega ao mesmo serviço público autenticado por token.
Valores `numeric`/`bigint` são
serializados como strings e timestamps como ISO 8601. Identificadores de owner,
credenciais e segredos não fazem parte dos DTOs públicos.

## Inventário final

O inventário direto inicial continha 10 arquivos com Supabase em operações de
negócio. Após o cutover, a busca nas superfícies protegidas retorna somente:

```text
src/contexts/AuthContext.tsx
src/pages/dashboard/SettingsPage.tsx
```

As ocorrências restantes são de identidade, não de tabelas/RPCs/PostgREST. Não
há `Authorization: Bearer`, leitura de `access_token` nem chamada de
`fetchOwnedRestaurant` com token nas operações de negócio.

Na API, o inventário runtime para `createSupabaseAdminClient`, `SupabaseClient` e
`@supabase/supabase-js` retorna zero quando o script offline
`src/scripts/migrate-menu-images-to-r2.ts` é excluído. O pacote permanece apenas
para esse script recuperável e sem execução automática.

## Evidência de testes

Estado verificado na Task 9/10:

- API completa: 334/334 testes;
- frontend completo: 98/98 testes;
- builds da API e frontend: PASS;
- typecheck frontend: PASS;
- testes locais usam runtime/repositórios injetados; nenhum smoke conecta ao Neon;
- `git diff --check`: PASS;
- nenhuma ação foi executada em n8n, DNS, Coolify, Hetzner, Vercel ou Easypanel.

## Próxima etapa autorizada

Retomar `docs/superpowers/plans/2026-09-25-better-auth-migration.md` na Task 6,
seguida pelas Tasks 7 e 8. A Task 9 remota continua separada: primeiro validar a
migration versionada de identidade em `preview`, depois aplicar o mesmo SQL em
`production`; nenhuma conta, UUID, senha ou sessão de teste será preservada.

Este GREEN é exclusivamente o gate de transporte/autorização para o cutover do
frontend ao Better Auth; não é um selo de prontidão de billing para produção.
Antes de habilitar cobrança real ainda é obrigatório fechar e homologar, em uma
etapa própria, a reconciliação direta de eventos Stripe no Neon e a propagação
efetiva de uma chave de idempotência até a chamada Stripe. Não há clientes nem
assinaturas reais durante esta migração local.
