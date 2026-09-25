# Fase 5 — Gate de acesso a dados antes do Better Auth

Data da inspeção: 25/09/2026.

## Resultado

**Gate atual: RED.**

O backend Better Auth, o schema de identidade e o adaptador de sessão podem ser implementados enquanto este gate está vermelho. A troca do `AuthContext` e do transporte autenticado no frontend não pode ser ativada até as operações autenticadas abaixo usarem rotas da API apoiadas no Neon.

Motivo: o frontend atual usa o access token Supabase implicitamente nas consultas PostgREST/RLS. Uma sessão Better Auth em cookie não cria `auth.uid()` no Supabase. Trocar apenas o login faria o cadastro inicial e as mutações autenticadas de restaurante, cardápio, cozinha e caixa falharem.

Não será criado um JWT Supabase temporário, nem um modo dual de autenticação. Como não existem clientes ou dados reais, o caminho de menor legado é terminar o cutover de dados da Fase 4 e então ativar Better Auth.

## Inventário direto

| Surface | Operation | Public or authenticated | Current transport | Required transport before Better Auth cutover |
|---|---|---|---|---|
| `src/contexts/AuthContext.tsx` | sessão, signup, signin e signout | Authenticated identity | `supabase.auth` | Better Auth `/api/auth/*` com cookie HTTP-only |
| `src/pages/onboarding/OnboardingPage.tsx` | cria restaurante e primeiro item do cardápio | Authenticated owner write | Supabase PostgREST + `auth.uid()` | `POST /onboarding` transacional na API/Neon usando `request.auth.userId` |
| `src/pages/dashboard/AppearancePage.tsx` | lê restaurante próprio e atualiza marca/aparência | Authenticated owner read/write | Supabase PostgREST/RLS | `GET/PATCH /restaurants/me` na API/Neon |
| `src/pages/dashboard/SettingsPage.tsx` | lê/atualiza restaurante, canais e fluxo de pagamento; atualiza nome/senha | Authenticated owner read/write and identity write | Supabase PostgREST/RLS + `supabase.auth.updateUser` | API/Neon para restaurante; Better Auth para nome/senha |
| `src/pages/dashboard/MenuManagement.tsx` | lista, cria, altera e remove itens/variações; salva URL R2 | Authenticated owner read/write | Supabase PostgREST/RLS | rotas CRUD de cardápio na API/Neon com ownership |
| `src/pages/dashboard/KitchenMonitor.tsx` | lista pedidos e avança/arquiva status | Authenticated owner read/write | Supabase PostgREST/RLS | rotas de fila/status de pedidos na API/Neon com ownership |
| `src/pages/dashboard/CashierPage.tsx` | lista sessões de mesa e agrega pedidos | Authenticated owner read | Supabase PostgREST/RLS | rotas de caixa/sessões na API/Neon com ownership |
| `src/components/cashier/TableSessionModal.tsx` | lista pedidos, fecha conta, encerra/transfere sessão e mesa | Authenticated owner read/write | Supabase PostgREST/RLS | rotas de sessão/fechamento/transferência na API/Neon com ownership e transação |
| `src/pages/dashboard/Overview.tsx` | lê restaurante, pedidos e feedback do período | Authenticated owner read | Supabase PostgREST/RLS por `fetchOwnedRestaurant`, orders e feedback | endpoint de resumo na API/Neon com ownership |
| `src/components/menu/FloatingActions.tsx` | solicita conta para uma sessão pública | Public customer write scoped by session | Supabase PostgREST anônimo | rota pública limitada na API/Neon; não depende de identidade do proprietário |

## Dependências indiretas

| Surface | Operation | Public or authenticated | Current transport | Required transport before Better Auth cutover |
|---|---|---|---|---|
| `src/lib/restaurants.ts` | seleciona restaurante por `owner_id` | Authenticated owner read | Supabase PostgREST; hoje a seleção também depende de políticas excessivamente amplas de leitura | `GET /restaurants/me`; o servidor deriva o owner da sessão |
| `src/components/DashboardLayout.tsx` | resolve restaurante/slug do usuário | Authenticated owner read | `fetchOwnedRestaurant` | `GET /restaurants/me` |
| `src/hooks/use-plan.ts` | lê plano do restaurante próprio | Authenticated owner read | `fetchOwnedRestaurant` | `GET /restaurants/me/plan` ou payload consolidado de restaurante |
| `src/hooks/useSubscription.ts` | lê assinatura do restaurante próprio | Authenticated owner read | `fetchOwnedRestaurant` | endpoint autenticado de billing/assinatura |
| `src/lib/order-feedback.ts` via `Overview.tsx` | lê feedback por restaurante | Authenticated owner read | Supabase PostgREST/RLS | endpoint de resumo/feedback na API/Neon |

## Contrato alvo do cutover de dados

| Route | Auth | Purpose |
|---|---|---|
| `POST /onboarding` | cookie | cria restaurante e primeiro item atomicamente |
| `GET /restaurants/me` | cookie | resolve o restaurante do proprietário |
| `PATCH /restaurants/me` | cookie | atualiza perfil, aparência e configuração |
| `GET /restaurants/me/menu-items` | cookie | lista itens e variações |
| `POST /restaurants/me/menu-items` | cookie | cria item e variações |
| `PATCH /restaurants/me/menu-items/:itemId` | cookie | atualiza item e substitui variações |
| `DELETE /restaurants/me/menu-items/:itemId` | cookie | remove item do proprietário |
| `GET /restaurants/me/kitchen/orders` | cookie | lista fila ativa |
| `PATCH /restaurants/me/kitchen/orders/:orderId/status` | cookie | transiciona status permitido |
| `GET /restaurants/me/table-sessions` | cookie | lista sessões e agregados |
| `GET /restaurants/me/table-sessions/:sessionId/orders` | cookie | detalha uma sessão |
| `POST /restaurants/me/table-sessions/:sessionId/close` | cookie | fecha conta atomicamente |
| `POST /restaurants/me/table-sessions/:sessionId/transfer` | cookie | transfere sessão e pedidos |
| `GET /restaurants/me/overview` | cookie | resumo por período e feedback |
| `GET /public/restaurants/:slug/catalog` | public | restaurante e cardápio publicados |
| `POST /public/table-sessions/:sessionId/request-check` | token | solicita conta |
| `PUT /public/orders/:orderId/feedback` | order token | grava avaliação idempotente |

Os contratos de rede usam camelCase. Valores `numeric` são serializados como strings decimais e timestamps como ISO 8601; identificadores de owner, billing e credenciais nunca fazem parte dos DTOs públicos.

## Operações públicas que não bloqueiam o gate por identidade

Cardápio e delivery públicos podem continuar anônimos durante a transição somente se cada rota estiver explicitamente limitada ao recurso público esperado. Eles não justificam manter Supabase Auth. Escritas públicas — pedido, feedback e solicitação de conta — devem continuar protegidas pelos tokens/contratos públicos já previstos na API e não por `auth.uid()`.

## Regra binária do gate

```text
GREEN only when no authenticated frontend operation depends on a Supabase access token or auth.uid().
Public anonymous reads may remain temporarily only when explicitly listed and scheduled for later removal.
```

Para mudar de RED para GREEN:

1. implementar as rotas de negócio autenticadas na API com ownership derivado da sessão;
2. apontar essas rotas para o Neon, não para o PostgREST legado;
3. substituir os consumidores autenticados listados acima;
4. repetir os inventários abaixo e obter zero dependências autenticadas;
5. só então executar as Tasks 6–9 do plano Better Auth.

## Comandos de verificação

Inventário direto:

```powershell
rg -l '@/lib/supabase|integrations/supabase/client' src/pages/dashboard src/pages/onboarding src/contexts src/hooks src/components
```

Inventário indireto de ownership:

```powershell
rg -n 'fetchOwnedRestaurant|supabase\.auth|access_token' src/pages/dashboard src/pages/onboarding src/contexts src/hooks src/components src/lib
```

O primeiro comando pode continuar retornando componentes estritamente públicos documentados. O segundo não pode retornar autenticação Supabase nem leituras autenticadas por `owner_id` quando o gate estiver GREEN.

## Baseline da Task 0

O inventário direto foi congelado antes do primeiro corte de código em 25/09/2026:

```text
src/components/cashier/TableSessionModal.tsx
src/components/menu/FloatingActions.tsx
src/contexts/AuthContext.tsx
src/pages/dashboard/AppearancePage.tsx
src/pages/dashboard/CashierPage.tsx
src/pages/dashboard/KitchenMonitor.tsx
src/pages/dashboard/MenuManagement.tsx
src/pages/dashboard/Overview.tsx
src/pages/dashboard/SettingsPage.tsx
src/pages/onboarding/OnboardingPage.tsx
```

Total inicial: **10 arquivos**. A Task 10 compara novamente a mesma superfície; antes da Task 6 do Better Auth, somente `src/contexts/AuthContext.tsx` pode permanecer como dependência de identidade temporária, nunca como transporte de dados de negócio.
