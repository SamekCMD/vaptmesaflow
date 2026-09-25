# Neon Business Data Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover todo acesso operacional do Vapt de Supabase PostgREST/RLS para rotas tipadas da `vapt-api` apoiadas no Neon, tornando verde o gate que antecede a ativação do Better Auth no frontend.

**Architecture:** A API mantém um único `pg.Pool` por processo, compartilhado pelo Better Auth e por repositórios PostgreSQL de negócio; ownership sempre deriva de `request.auth.userId`. O frontend usa apenas `fetch` com `credentials: "include"` para dados autenticados e rotas públicas explicitamente limitadas. Não haverá JWT Supabase, modo dual, sincronização entre bancos ou preservação de dados de teste.

**Tech Stack:** Node.js 24, TypeScript 5.8, Fastify 5, Better Auth 1.7.6, `pg` 8.23, Zod 4, React 18, Vitest, Neon PostgreSQL.

**Spec:** `docs/infra-migration-phase-5-readiness.md`, complementado por `docs/infra-migration-plan.md` Fase 4 e `infra/neon/001_business_schema.sql`/`002_business_routines.sql`.

## Global Constraints

- O produto não possui clientes nem dados reais; não migrar usuários, UUIDs, senhas, sessões ou registros de teste.
- Não criar JWT Supabase temporário, bridge de claims, modo dual de autenticação ou dependência de `auth.uid()`.
- Vercel e Easypanel são legado; não executar trabalho de DNS, Hetzner, Coolify ou deploy neste plano.
- Não aplicar migrations remotamente neste plano; Task 9 do plano Better Auth continua responsável por preview primeiro e produção depois.
- `DATABASE_URL` é a única conexão operacional de negócio; `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` podem permanecer apenas no script offline de inventário/cópia R2 até sua aposentadoria.
- Toda rota autenticada deriva tenant e ownership da sessão Better Auth, nunca de `ownerId`, `userId` ou `restaurantId` controlado pelo browser sem verificação.
- Toda operação multi-tabela usa uma transação PostgreSQL e libera o client em `finally`.
- Valores monetários saem como strings decimais; timestamps saem como ISO 8601; nenhum segredo, hash ou payload interno é serializado.
- Escritas públicas exigem o token/escopo público já definido para o recurso ou um identificador opaco equivalente; IDs adivinháveis isolados não autorizam mutação.
- Preservar os contratos públicos de pagamento e R2 existentes enquanto os repositórios mudam de transporte.

## Review Focus

- IDs de outro restaurante devem resultar em `403` ou `404` sem revelar existência nem alterar dados; Tasks 2, 5, 6 e 7 incluem testes cruzados.
- Falha na segunda escrita de onboarding, cardápio ou fechamento de mesa deve reverter a transação inteira; Tasks 4, 5 e 7 incluem rollback explícito.
- Duas atualizações concorrentes de pedido/sessão não podem pular estados nem duplicar efeitos; Tasks 6 e 7 usam `FOR UPDATE` e testes concorrentes.
- `numeric`, `bigint`, `timestamptz`, arrays e `null` devem manter semântica no JSON; Tasks 2, 3 e 8 testam mapeamento de borda.
- Rotas públicas de cardápio, feedback e solicitação de conta devem rejeitar enumeração/mutação fora do token correto; Tasks 3 e 8 testam token incorreto, ausente e recurso fechado.

---

### Task 0: Congelar inventário e contratos do cutover

**Files:**
- Modify: `docs/infra-migration-phase-5-readiness.md`
- Create: API `src/modules/business/contracts.ts`
- Create: frontend `src/lib/business-api.types.ts`

**Interfaces:**
- Produces: DTOs compartilhados por nome e forma, duplicados deliberadamente entre repositórios sem pacote cross-repo.
- Consumes: colunas reais de `infra/neon/001_business_schema.sql`.

- [x] **Step 1: Registrar a matriz exata de endpoints**

Adicionar ao relatório:

```md
| Route | Auth | Purpose |
|---|---|---|
| POST /onboarding | cookie | cria restaurante e primeiro item atomicamente |
| GET /restaurants/me | cookie | resolve o restaurante do proprietário |
| PATCH /restaurants/me | cookie | atualiza perfil, aparência e configuração |
| GET /restaurants/me/menu-items | cookie | lista itens e variações |
| POST /restaurants/me/menu-items | cookie | cria item e variações |
| PATCH /restaurants/me/menu-items/:itemId | cookie | atualiza item e substitui variações |
| DELETE /restaurants/me/menu-items/:itemId | cookie | remove item do proprietário |
| GET /restaurants/me/kitchen/orders | cookie | lista fila ativa |
| PATCH /restaurants/me/kitchen/orders/:orderId/status | cookie | transiciona status permitido |
| GET /restaurants/me/table-sessions | cookie | lista sessões e agregados |
| GET /restaurants/me/table-sessions/:sessionId/orders | cookie | detalha uma sessão |
| POST /restaurants/me/table-sessions/:sessionId/close | cookie | fecha conta atomicamente |
| POST /restaurants/me/table-sessions/:sessionId/transfer | cookie | transfere sessão e pedidos |
| GET /restaurants/me/overview | cookie | resumo por período e feedback |
| GET /public/restaurants/:slug/catalog | public | restaurante e cardápio publicados |
| POST /public/table-sessions/:sessionId/request-check | token | solicita conta |
| PUT /public/orders/:orderId/feedback | order token | grava avaliação idempotente |
```

- [x] **Step 2: Definir DTOs concretos nos dois repositórios**

Usar camelCase na rede. O núcleo mínimo é:

```ts
export type RestaurantDto = {
  id: string; name: string; slug: string; cnpj: string | null;
  whatsapp: string | null; address: string | null; phone: string | null;
  hours: string | null; description: string | null;
  primaryColor: string; secondaryColor: string; fontFamily: string;
  logoUrl: string | null; planType: "starter" | "pro" | "business";
  planStatus: "trialing" | "active" | "expired" | "cancelled";
  trialEndsAt: string | null; totalTables: number; maxTables: number;
  paymentMode: "open_tab" | "prepaid"; maxPendingOrders: number;
  localEnabled: boolean; deliveryEnabled: boolean;
  onboardingCompleted: boolean; updatedAt: string;
};

export type MenuVariationDto = {
  id: string; name: string; options: string[]; required: boolean;
};

export type MenuItemDto = {
  id: string; restaurantId: string; name: string; price: string;
  description: string | null; category: string; available: boolean;
  imageUrl: string | null; availableFrom: string | null;
  availableUntil: string | null; badge: string | null;
  isChefSuggestion: boolean; prepTimeMinutes: number | null;
  createdAt: string; updatedAt: string; variations: MenuVariationDto[];
};
```

- [x] **Step 3: Provar cobertura do inventário**

Run:

```powershell
rg -l '@/lib/supabase|integrations/supabase/client' src/pages/dashboard src/pages/onboarding src/contexts src/hooks src/components
```

Expected: salvar a lista inicial no relatório; ela é a baseline que Task 10 deve reduzir às ocorrências públicas explicitamente documentadas e `AuthContext` até a Task 6 do plano Better Auth.

- [x] **Step 4: Commit**

```powershell
git add docs/infra-migration-phase-5-readiness.md src/lib/business-api.types.ts
git commit -m "docs: define Neon business cutover contracts"
git -C .worktrees/vapt-api-infra-foundation add src/modules/business/contracts.ts
git -C .worktrees/vapt-api-infra-foundation commit -m "feat: define business API contracts"
```

---

### Task 1: Compartilhar o pool PostgreSQL e corrigir o transporte web

**Files:**
- Create: API `src/lib/database.ts`
- Create: API `src/lib/database.test.ts`
- Modify: API `src/app.ts`
- Modify: API `src/modules/auth/better-auth.ts`
- Modify: API `src/plugins/cors.ts`
- Modify: API `src/app.test.ts`
- Modify: frontend `src/lib/vapt-api-client.ts`
- Modify: frontend `src/test/setup.ts`
- Create: frontend `src/test/vapt-api-client.test.ts`

**Interfaces:**
- Produces: `Database = Pick<Pool, "query" | "connect">`, `withTransaction<T>(database, work)`, `BuildAppDependencies.database?: Database`.
- Produces: `vaptApiRequest` sempre com `credentials: "include"`, sem import de Supabase e sem header `Authorization`.

- [x] **Step 1: Escrever testes vermelhos de lifecycle/transação**

```ts
test("withTransaction commits and releases the client", async () => {
  const events: string[] = [];
  const result = await withTransaction(fakeDatabase(events), async () => "ok");
  assert.equal(result, "ok");
  assert.deepEqual(events, ["connect", "BEGIN", "COMMIT", "release"]);
});

test("withTransaction rolls back and releases after failure", async () => {
  const events: string[] = [];
  await assert.rejects(() => withTransaction(fakeDatabase(events), async () => {
    throw new Error("boom");
  }));
  assert.deepEqual(events, ["connect", "BEGIN", "ROLLBACK", "release"]);
});
```

- [x] **Step 2: Implementar o runtime compartilhado**

```ts
export type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;
export type Database = Pick<Pool, "query" | "connect">;

export async function withTransaction<T>(
  database: Database,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```

`buildApp` cria um único `Pool`, injeta-o no Better Auth e nos módulos de negócio, e encerra apenas pools próprios. Testar runtime/pool injetados para impedir double-close.

- [x] **Step 3: Escrever e implementar o teste vermelho do cliente web**

```ts
test("authenticated API requests use cookies without Supabase bearer tokens", async () => {
  await vaptApiRequest({ method: "GET", route: "/restaurants/me" });
  expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    credentials: "include",
    headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
  }));
});
```

Remover `getAccessToken`, o import de `@/lib/supabase` e a pré-validação local de sessão. Um `401` do servidor continua virando `new VaptApiClientError("unauthorized", "Sessão inválida. Faça login novamente.", 401)`.

- [x] **Step 4: Ampliar CORS somente para headers reais do browser**

```ts
allowedHeaders: [
  "Content-Type",
  "X-Captcha-Response",
  "Idempotency-Key",
  "X-Vapt-Order-Token",
]
```

Adicionar preflight para pedido público com `Idempotency-Key`/`X-Vapt-Order-Token` e manter origem exata/credentials.

- [x] **Step 5: Verificar e commit**

```powershell
npx tsx --test src/lib/database.test.ts src/app.test.ts
npm test
npm run build
git add src
git commit -m "refactor: share Neon database runtime"

npm test -- src/test/vapt-api-client.test.ts
npm run build
git add src/lib/vapt-api-client.ts src/test
git commit -m "refactor: use credentialed API transport"
```

---

### Task 2: Portar ownership, pedidos e pagamentos existentes para PostgreSQL

**Files:**
- Modify: API `src/lib/permissions.ts`
- Modify: API `src/lib/permissions.test.ts`
- Rewrite: API `src/modules/orders/repository.ts`
- Modify: API `src/modules/orders/orders.test.ts`
- Rewrite: API `src/modules/payments/repository.ts`
- Modify: API payment repository/service tests
- Rewrite: API `src/modules/payments/providers/mercado-pago/oauth.ts` repository adapter
- Modify: API OAuth repository tests
- Rewrite: API `src/modules/webhooks/repository.ts`
- Modify: API webhook tests
- Rewrite: API `src/modules/storage/repository.ts`
- Modify: API `src/modules/storage/repository.test.ts`, `src/modules/storage/service.test.ts`
- Modify: API `src/app.ts`

**Interfaces:**
- Consumes: `Queryable`, `Database`, existing repository interfaces and SQL functions from `002_business_routines.sql`.
- Produces: the same service-facing repository interfaces without `SupabaseClient`.

- [ ] **Step 1: Converter ownership para SQL parametrizado**

```sql
select exists (
  select 1 from public.restaurants
  where id = $1::uuid and owner_id = $2::uuid
) as allowed
```

Testar owner correto, owner incorreto, UUID inválido normalizado como `400`, e erro SQL convertido para o contrato genérico sem query/credencial.

- [ ] **Step 2: Portar `OrderRepository` sem mudar sua interface**

Usar:

```sql
select * from public.create_public_order_v3(
  $1::uuid, $2::jsonb, $3::text, $4::text, $5::text,
  $6::text, $7::text, $8::text, $9::text, $10::text
)
```

e, para leitura pública, `select` com `orders` + `order_items` somente após validar `public_access_token_hash`. Testar `numeric` como string, `display_id` bigint sem perda, idempotência e token errado.

- [ ] **Step 3: Portar `PaymentRepository` método por método**

Preservar as interfaces existentes e chamar as rotinas já versionadas:

```sql
select * from public.apply_payment_transition_v2(
  $1::uuid, $2::integer, $3::text, $4::text, $5::text,
  $6::timestamptz, $7::text, $8::timestamptz, $9::jsonb, $10::text[]
);
select * from public.claim_payment_effects(
  $1::text, $2::integer, $3::timestamptz, $4::timestamptz
);
select public.complete_payment_effect($1::uuid, $2::text, $3::timestamptz);
select public.fail_payment_effect(
  $1::uuid, $2::text, $3::text, $4::integer, $5::timestamptz, $6::text
);
select * from public.release_paid_order_to_production($1::uuid);
select public.count_pending_payment_effects();
```

Operações sem função usam SQL parametrizado e `ON CONFLICT`; reserva de webhook precisa distinguir duplicata de falha real. Rodar todos os testes de pagamentos após cada grupo de métodos.

- [ ] **Step 4: Portar OAuth e webhook repositories**

Estados OAuth são consumidos atomicamente:

```sql
update public.payment_oauth_states
set consumed_at = now()
where state_hash = $1 and consumed_at is null and expires_at > now()
returning *
```

Credenciais continuam cifradas e nunca entram em logs/respostas. Eventos de billing usam `ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id`.

- [ ] **Step 5: Portar o lookup de menu usado pelo R2**

Substituir `createSupabaseMenuItemExists` por `createMenuItemExists(queryable)`, com uma query que exige simultaneamente item, restaurante e owner:

```sql
select exists (
  select 1
  from public.menu_items as item
  join public.restaurants as restaurant on restaurant.id = item.restaurant_id
  where item.id = $1::uuid
    and restaurant.id = $2::uuid
    and restaurant.owner_id = $3::uuid
) as exists
```

Testar IDs de outro restaurante/owner e erro SQL sanitizado.

- [ ] **Step 6: Provar que nenhum runtime da API usa Supabase**

```powershell
rg -n 'createSupabaseAdminClient|SupabaseClient|@supabase/supabase-js' src -g '!scripts/migrate-menu-images-to-r2.ts'
```

Expected: zero matches. O script offline R2 é a única exceção explícita.

- [ ] **Step 7: Verificar e commit**

```powershell
npm test
npm run build
git add src
git commit -m "refactor: run core repositories on Neon"
```

---

### Task 3: Criar o catálogo público no Neon

**Files:**
- Create: API `src/modules/catalog/repository.ts`
- Create: API `src/modules/catalog/service.ts`
- Create: API `src/modules/catalog/routes.ts`
- Create: API `src/modules/catalog/catalog.test.ts`
- Modify: API `src/app.ts`
- Modify: frontend `src/pages/menu/PublicMenu.tsx`
- Modify: frontend `src/pages/delivery/PublicDelivery.tsx`
- Modify: frontend public menu/delivery tests

**Interfaces:**
- Produces: `GET /public/restaurants/:slug/catalog -> { restaurant: RestaurantDto; items: MenuItemDto[] }`.
- Public response excludes `ownerId`, billing IDs, provider credentials, CNPJ when not displayed, and internal flags.

- [ ] **Step 1: Escrever testes vermelhos de contrato e exposição**

Cobrir slug inexistente `404`, restaurante encontrado, apenas itens `available = true`, variações agrupadas, ordem estável e ausência de `ownerId`, `stripeCustomerId`, `asaasApiKey` e colunas internas.

- [ ] **Step 2: Implementar consulta pública parametrizada**

Consultar o restaurante por slug e itens/variações em no máximo duas queries; mapear `numeric` para string e timestamps para ISO.

- [ ] **Step 3: Substituir leituras públicas no frontend**

```ts
const catalog = await vaptApiRequest<PublicCatalogDto>({
  method: "GET",
  route: `/public/restaurants/${encodeURIComponent(slug)}/catalog`,
  requireAuth: false,
});
```

Remover imports Supabase de `PublicMenu.tsx` e `PublicDelivery.tsx` sem alterar checkout público.

- [ ] **Step 4: Verificar e commit em ambos os repositórios**

```powershell
npx tsx --test src/modules/catalog/catalog.test.ts
npm test
npm run build
git add src/modules/catalog src/app.ts
git commit -m "feat: serve public catalog from Neon"

npm test -- src/test/public-menu-rating.test.tsx src/test/delivery-online-checkout.test.tsx
npm run build
git add src/pages/menu src/pages/delivery src/test
git commit -m "refactor: load public catalog from API"
```

---

### Task 4: Implementar onboarding e restaurante próprio

**Files:**
- Create: API `src/modules/restaurants/repository.ts`
- Create: API `src/modules/restaurants/service.ts`
- Create: API `src/modules/restaurants/schemas.ts`
- Create: API `src/modules/restaurants/routes.ts`
- Create: API `src/modules/restaurants/restaurants.test.ts`
- Modify: API `src/app.ts`
- Create: `infra/neon/004_business_constraints.sql`
- Modify: frontend `src/pages/onboarding/OnboardingPage.tsx`
- Rewrite: frontend `src/lib/restaurants.ts`
- Modify: frontend `src/pages/dashboard/AppearancePage.tsx`
- Modify: frontend `src/pages/dashboard/SettingsPage.tsx`
- Modify: frontend `src/components/DashboardLayout.tsx`
- Modify: frontend `src/hooks/use-plan.ts`
- Modify: frontend `src/hooks/useSubscription.ts`
- Modify: frontend onboarding/settings tests

**Interfaces:**
- Produces: `createOwnedRestaurant(userId, input)`, `findOwnedRestaurant(userId)`, `updateOwnedRestaurant(userId, patch)`.
- Produces endpoints `POST /onboarding`, `GET /restaurants/me`, `PATCH /restaurants/me`.

- [ ] **Step 1: Escrever schemas Zod e testes vermelhos**

`POST /onboarding` aceita somente `restaurantName`, `slug`, `dishName`, `dishPrice`; rejeita `ownerId`, IDs, plano, billing e campos desconhecidos. `PATCH /restaurants/me` aceita uma união explícita de perfil/aparência/configuração e rejeita `id`, `ownerId`, `planType`, `planStatus` e billing IDs.

- [ ] **Step 2: Implementar onboarding atômico**

Dentro de `withTransaction`:

```sql
insert into public.restaurants
  (owner_id, name, slug, total_tables, max_tables, onboarding_completed, onboarding_completed_at)
values ($1, $2, $3, 1, 1, true, now())
returning *
```

Depois inserir o primeiro `menu_items`. Tratar conflito de slug/owner como `409`; se o item falhar, o restaurante não pode permanecer. Como não há produção, impor um único restaurante por owner com migration `004_business_constraints.sql` contendo índice unique em `restaurants(owner_id)`.

- [ ] **Step 3: Implementar read/patch por owner da sessão**

Nenhuma rota recebe `ownerId`. `PATCH` usa lista fixa de colunas e sempre `where owner_id = $n returning *`; zero linhas vira `404`.

- [ ] **Step 4: Migrar consumidores frontend**

`fetchOwnedRestaurant()` passa a não receber `ownerId` nem string `select`:

```ts
export async function fetchOwnedRestaurant(): Promise<RestaurantDto | null> {
  try {
    return await vaptApiRequest<RestaurantDto>({ method: "GET", route: "/restaurants/me" });
  } catch (error) {
    if (error instanceof VaptApiClientError && error.status === 404) return null;
    throw error;
  }
}
```

Onboarding usa `POST /onboarding`; Appearance/Settings usam `PATCH /restaurants/me`. Alterações de nome/senha da identidade permanecem intocadas até Task 6 do plano Better Auth.

- [ ] **Step 5: Verificar rollback, ownership e UI**

Testar segundo owner, slug duplicado, rollback do prato, patch proibido, restaurante ausente e mapeamento de todos os campos. Rodar onboarding/settings/plan tests e builds.

- [ ] **Step 6: Commit em ambos os repositórios**

```powershell
git add src/modules/restaurants src/app.ts
git commit -m "feat: manage owned restaurants in Neon"

git add infra/neon/004_business_constraints.sql src/pages/onboarding src/pages/dashboard src/components/DashboardLayout.tsx src/hooks src/lib/restaurants.ts src/test
git commit -m "refactor: use restaurant API for owner data"
```

---

### Task 5: Implementar CRUD transacional de cardápio

**Files:**
- Create: API `src/modules/menu/repository.ts`
- Create: API `src/modules/menu/service.ts`
- Create: API `src/modules/menu/schemas.ts`
- Create: API `src/modules/menu/routes.ts`
- Create: API `src/modules/menu/menu.test.ts`
- Modify: API `src/app.ts`
- Modify: API `src/modules/storage/routes.ts`
- Modify: frontend `src/pages/dashboard/MenuManagement.tsx`
- Create: frontend `src/test/menu-management.test.tsx`

**Interfaces:**
- Produces: list/create/update/delete endpoints under `/restaurants/me/menu-items`.
- Item create/update accepts `{ name, price, description, category, available, imageUrl, availableFrom, availableUntil, badge, isChefSuggestion, prepTimeMinutes, variations }`.

- [ ] **Step 1: Escrever testes vermelhos de validação/tenant**

Cobrir preço negativo, variação vazia, item de outro owner, chef suggestion única, criação com variações, substituição atômica de variações, remoção e rollback.

- [ ] **Step 2: Implementar repository com ownership em toda query**

Usar joins com `restaurants.owner_id = $userId`; nunca fazer update/delete apenas por `itemId`. Create/update roda em transação, zera outras sugestões do mesmo restaurante quando necessário e substitui variações somente após o item estar validado.

- [ ] **Step 3: Unificar persistência da URL R2**

Adicionar `PATCH /restaurants/:restaurantId/menu-items/:itemId/image` à rota R2 existente ou fazer o endpoint de menu aceitar `imageUrl` somente se o `itemId` pertence ao owner. Testar que URL arbitrária fora de `config.r2.publicBaseUrl` é rejeitada.

- [ ] **Step 4: Migrar `MenuManagement.tsx`**

Remover todas as operações `.from("menu_items")`/`.from("menu_item_variations")`. Após upload R2, usar o patch autenticado; após delete R2, remover item via API. Preservar optimistic UI apenas quando o servidor retornar sucesso.

- [ ] **Step 5: Verificar e commit**

```powershell
npx tsx --test src/modules/menu/menu.test.ts src/modules/storage/routes.test.ts
npm test
npm run build
git add src/modules/menu src/modules/storage src/app.ts
git commit -m "feat: manage menu data in Neon"

npm test -- src/test/menu-management.test.tsx
npm run build
git add src/pages/dashboard/MenuManagement.tsx src/test
git commit -m "refactor: manage menu through API"
```

---

### Task 6: Implementar fila de cozinha com máquina de estados

**Files:**
- Create: API `src/modules/kitchen/repository.ts`
- Create: API `src/modules/kitchen/service.ts`
- Create: API `src/modules/kitchen/schemas.ts`
- Create: API `src/modules/kitchen/routes.ts`
- Create: API `src/modules/kitchen/kitchen.test.ts`
- Modify: API `src/app.ts`
- Modify: frontend `src/pages/dashboard/KitchenMonitor.tsx`
- Create: frontend `src/test/kitchen-monitor.test.tsx`

**Interfaces:**
- Produces: `GET /restaurants/me/kitchen/orders` and `PATCH /restaurants/me/kitchen/orders/:orderId/status`.
- Allowed transitions: `paid|pending -> preparing`, `preparing -> ready`, `ready -> delivered`; same-state retry is idempotent; other transitions return `409`.

- [ ] **Step 1: Escrever testes vermelhos de status e tenant**

Cobrir fila ativa com `order_items`, ordem `created_at desc`, pedido de outro restaurante, transição válida, inválida, retry idempotente e concorrência.

- [ ] **Step 2: Implementar lock e transição**

```sql
select o.status
from public.orders o
join public.restaurants r on r.id = o.restaurant_id
where o.id = $1 and r.owner_id = $2
for update
```

Validar transição no serviço e atualizar com `updated_at = now()` dentro da mesma transação. O arquivamento automático usa a mesma rota, não fire-and-forget direto no banco.

- [ ] **Step 3: Migrar KitchenMonitor**

Substituir fetch/update Supabase por API. Em erro, restaurar o estado otimista e exibir mensagem; cancelar timers ao desmontar.

- [ ] **Step 4: Verificar e commit**

```powershell
npx tsx --test src/modules/kitchen/kitchen.test.ts
npm test
npm run build
git add src/modules/kitchen src/app.ts
git commit -m "feat: manage kitchen queue in Neon"

npm test -- src/test/kitchen-monitor.test.tsx
npm run build
git add src/pages/dashboard/KitchenMonitor.tsx src/test
git commit -m "refactor: use kitchen API"
```

---

### Task 7: Implementar caixa e sessões de mesa transacionais

**Files:**
- Create: API `src/modules/table-sessions/repository.ts`
- Create: API `src/modules/table-sessions/service.ts`
- Create: API `src/modules/table-sessions/schemas.ts`
- Create: API `src/modules/table-sessions/routes.ts`
- Create: API `src/modules/table-sessions/table-sessions.test.ts`
- Modify: API `src/app.ts`
- Modify: frontend `src/pages/dashboard/CashierPage.tsx`
- Modify: frontend `src/components/cashier/TableSessionModal.tsx`
- Create: frontend `src/test/cashier-flow.test.tsx`

**Interfaces:**
- Produces: list/detail/close/transfer endpoints do inventário.
- Close returns `{ sessionId, status: "closed", closedAt, deliveredOrderIds }`; transfer returns `{ sessionId, tableNumber, updatedOrderIds }`.

- [ ] **Step 1: Escrever testes vermelhos de agregação/ownership**

Cobrir apenas `open|check_requested`, soma decimal sem coerção imprecisa, count, detalhe ordenado, owner incorreto, sessão fechada, mesa inválida e sessão inexistente.

- [ ] **Step 2: Implementar close atômico**

Lock da sessão com ownership; atualizar pedidos não finais para `delivered`, depois sessão para `closed`/`closed_at`. Qualquer falha executa rollback. Repetição após fechamento retorna o mesmo estado sem duplicar efeitos.

- [ ] **Step 3: Implementar transfer atômico**

Validar `tableNumber` trim, tamanho `1..20`, lock da sessão aberta, atualizar sessão e todos os pedidos vinculados na mesma transação.

- [ ] **Step 4: Migrar Cashier e modal**

Remover queries Supabase e manter os DTOs locais derivados das respostas. Após close/transfer, atualizar lista com a resposta do servidor e refetch quando necessário.

- [ ] **Step 5: Verificar e commit**

```powershell
npx tsx --test src/modules/table-sessions/table-sessions.test.ts
npm test
npm run build
git add src/modules/table-sessions src/app.ts
git commit -m "feat: manage table sessions in Neon"

npm test -- src/test/cashier-flow.test.tsx
npm run build
git add src/pages/dashboard/CashierPage.tsx src/components/cashier src/test
git commit -m "refactor: use cashier API"
```

---

### Task 8: Implementar overview, feedback e solicitação pública de conta

**Files:**
- Create: API `src/modules/overview/repository.ts`
- Create: API `src/modules/overview/routes.ts`
- Create: API `src/modules/overview/overview.test.ts`
- Create: API `src/modules/feedback/repository.ts`
- Create: API `src/modules/feedback/routes.ts`
- Create: API `src/modules/feedback/feedback.test.ts`
- Modify: API `src/modules/table-sessions/routes.ts`
- Modify: API `src/app.ts`
- Modify: frontend `src/pages/dashboard/Overview.tsx`
- Modify: frontend `src/lib/order-feedback.ts`
- Modify: frontend `src/components/menu/FloatingActions.tsx`
- Modify: frontend overview/public rating tests

**Interfaces:**
- `GET /restaurants/me/overview?period=day|week|month` returns `{ restaurant, orders, feedback }` com um único `periodStart` calculado no servidor.
- `PUT /public/orders/:orderId/feedback` exige `X-Vapt-Order-Token` e aceita `{ rating, reasons, comment }`.
- `POST /public/table-sessions/:sessionId/request-check` exige `{ publicOrderId, publicOrderToken }` e só altera a sessão ligada ao pedido/token.

- [ ] **Step 1: Escrever testes vermelhos de período/serialização**

Fixar o relógio; testar limites day/week/month, timezone UTC, feedback vazio, ratings 1/5, decimal como string e ausência de dados de outro owner.

- [ ] **Step 2: Implementar overview por owner**

Resolver restaurante pelo userId, calcular `periodStart` no serviço e consultar pedidos/items + feedback por `restaurant_id` e `created_at >= $periodStart`.

- [ ] **Step 3: Implementar feedback público idempotente**

Validar token do pedido com o mesmo hash/secret de `OrderService`, então:

```sql
insert into public.order_feedback
  (order_id, restaurant_id, rating, reasons, comment)
values ($1::uuid, $2::uuid, $3::integer, $4::text[], $5::text)
on conflict (order_id) do update
set rating = excluded.rating,
    reasons = excluded.reasons,
    comment = excluded.comment
returning *
```

Token ausente/incorreto retorna `401`; orderId de outro token nunca grava.

- [ ] **Step 4: Implementar request-check limitado ao pedido**

Após validar token e carregar `table_session_id`, atualizar somente sessão `open` para `check_requested`. Sessão fechada retorna `409`; repetição em `check_requested` é idempotente.

- [ ] **Step 5: Migrar consumidores frontend**

Overview usa um endpoint; `order-feedback.ts` remove Supabase e n8n para persistência; `FloatingActions` envia orderId/token já disponíveis no fluxo público. Atualizar props e testes para impedir chamada sem token.

- [ ] **Step 6: Verificar e commit**

```powershell
npx tsx --test src/modules/overview/overview.test.ts src/modules/feedback/feedback.test.ts src/modules/table-sessions/table-sessions.test.ts
npm test
npm run build
git add src/modules src/app.ts
git commit -m "feat: serve overview and public guest actions from Neon"

npm test -- src/test/public-menu-rating.test.tsx src/test/overview-satisfaction.test.tsx
npm run build
git add src/pages/dashboard/Overview.tsx src/components/menu/FloatingActions.tsx src/lib/order-feedback.ts src/test
git commit -m "refactor: use API for overview and guest actions"
```

---

### Task 9: Retirar writers n8n/Supabase do caminho operacional

**Files:**
- Modify: API `src/modules/ingest/routes.ts`
- Modify: API `src/modules/billing/stripe/routes.ts`
- Create: API `src/modules/billing/stripe/repository.ts`
- Modify: API billing/ingest tests
- Modify: frontend `src/lib/n8n-client.ts`
- Modify: `docs/integrations/n8n/README.md`
- Delete: `docs/integrations/n8n/stripe/Vapt Stripe.json`
- Delete: `docs/integrations/n8n/ingest/Vapt Ingest.json`

**Interfaces:**
- Produces: feedback/push persistence directly na API/Neon; n8n pode executar integrações externas, mas não escrever em Supabase.
- Stripe service persists returned subscription identifiers/status through an ownership-scoped Neon repository.

- [ ] **Step 1: Inventariar nós Supabase versionados e escrever teste de proibição**

```powershell
rg -n 'supabase|SUPABASE_URL|service_role|rest/v1' docs/integrations/n8n src/lib/n8n-client.ts
```

Criar teste que lê os JSON versionados e falha se um workflow ativo contiver credencial/nó Supabase ou URL `/rest/v1`.

- [ ] **Step 2: Mover ingest persistence para Neon**

`/ingest/order-feedback` passa a delegar à rota pública autenticada por token; `/ingest/push-subscription` usa sessão/ownership e `ON CONFLICT(endpoint) DO UPDATE`. Nenhuma rota chama n8n para persistir linhas.

- [ ] **Step 3: Persistir resultado Stripe na API**

Após resposta válida do n8n/Stripe, atualizar somente o restaurante verificado com `stripe_customer_id`, `stripe_subscription_id`, `plan_type`, `plan_status`, `trial_ends_at`, `subscription_canceled_at` conforme a operação. Falha de persistência retorna erro e não afirma sucesso local.

- [ ] **Step 4: Retirar workflows de escrita legada**

Remover os dois JSON versionados de escrita legada e registrar no README que eles foram aposentados; o import/disable remoto não faz parte desta execução. Não chamar UI n8n sem autorização/credenciais explícitas.

- [ ] **Step 5: Verificar e commit**

```powershell
npm test
npm run build
rg -n 'supabase|rest/v1' docs/integrations/n8n -g '*.json'
git add src docs/integrations/n8n
git commit -m "refactor: remove Supabase writers from operations"
```

Expected: nenhum workflow ativo referencia Supabase/PostgREST.

---

### Task 10: Fechar o gate e preparar a retomada do Better Auth frontend

**Files:**
- Modify: `docs/infra-migration-phase-5-readiness.md`
- Modify: `docs/infra-migration-phase-4-neon.md`
- Modify: `docs/superpowers/plans/2026-09-25-better-auth-migration.md`
- Delete: API `src/lib/supabase.ts`
- Modify: API `src/lib/config.ts`, `src/lib/config.test.ts`, `.env.example`, `README.md`
- Modify: frontend `package.json`, `package-lock.json` only during subsequent Better Auth Task 6, after `AuthContext` stops importing Supabase

**Interfaces:**
- Produces: gate `GREEN` e uma baseline em que Tasks 6–9 do plano Better Auth podem continuar.

- [ ] **Step 1: Rodar inventários finais**

```powershell
rg -n 'supabase\.auth|access_token|fetchOwnedRestaurant\([^)]*,|Authorization.*Bearer' src/pages/dashboard src/pages/onboarding src/contexts src/hooks src/components src/lib
rg -l '@/lib/supabase|integrations/supabase/client' src/pages/dashboard src/pages/onboarding src/contexts src/hooks src/components
rg -n 'createSupabaseAdminClient|SupabaseClient|@supabase/supabase-js' .worktrees/vapt-api-infra-foundation/src -g '!scripts/migrate-menu-images-to-r2.ts'
```

Expected before Task 6: a primeira e a segunda busca retornam somente `src/contexts/AuthContext.tsx` e seus testes de identidade; nenhuma operação de negócio autenticada ou pública retorna. A terceira retorna zero runtime matches.

- [ ] **Step 2: Remover clientes/dependências não usados**

Remover `src/lib/supabase.ts` da API e retirar `supabase` de `AppConfig`; o script R2 continua lendo suas próprias variáveis de ambiente e justifica manter `@supabase/supabase-js`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em uma seção explicitamente offline do `.env.example`. Manter os dois clientes Supabase do frontend somente até a Task 6 do plano Better Auth remover o último consumidor, `AuthContext`; a remoção do pacote frontend entra no mesmo commit dessa Task 6.

- [ ] **Step 3: Atualizar o relatório para GREEN**

Registrar por superfície a nova rota, teste e commit. Usar exatamente:

```text
GREEN: no authenticated frontend operation depends on a Supabase access token or auth.uid().
The Better Auth frontend cutover may proceed with Tasks 6–9.
```

- [ ] **Step 4: Verificação cruzada final**

```powershell
npm test
npm run build
git diff --check

git -C .worktrees/vapt-api-infra-foundation status --short
git -C .worktrees/vapt-api-infra-foundation log -1 --oneline
npm --prefix .worktrees/vapt-api-infra-foundation test
npm --prefix .worktrees/vapt-api-infra-foundation run build
```

Executar também smoke local dos endpoints com runtime/repositório injetado; nenhum comando deste passo usa Neon remoto.

- [ ] **Step 5: Revisão e commits de documentação**

Solicitar revisão focada em tenant isolation, transações, exposição pública e inventário. Corrigir todo Critical/Important antes de marcar verde.

```powershell
git add docs/infra-migration-phase-5-readiness.md docs/infra-migration-phase-4-neon.md docs/superpowers/plans/2026-09-25-better-auth-migration.md package.json package-lock.json src
git commit -m "docs: mark Neon business cutover ready"
```

Depois deste commit, retomar na Task 6 de `2026-09-25-better-auth-migration.md`; não pular diretamente para aplicação de produção.
