

# Correcao de 3 Bugs no Fluxo "Pagar Depois"

## Problemas Identificados

### Bug 1: "Pedir a Conta" retorna 401 (Unauthorized)
A politica RLS de UPDATE na tabela `table_sessions` permite apenas usuarios com `status = 'open'`, mas nao garante acesso anonimo corretamente. O Supabase retorna 401 porque o usuario anonimo nao tem permissao efetiva de UPDATE. A politica precisa ser recriada para permitir que usuarios anonimos atualizem sessoes abertas para `check_requested`.

**SQL a executar no Supabase:**
```sql
-- Dropar politica existente que nao funciona para anon
DROP POLICY IF EXISTS "Anon can update to check_requested" ON public.table_sessions;

-- Recriar com permissao explicita para anon
CREATE POLICY "Anon can update to check_requested"
  ON public.table_sessions FOR UPDATE
  TO anon
  USING (status = 'open')
  WITH CHECK (status = 'check_requested');
```

Tambem precisamos garantir que anon pode fazer UPDATE na tabela `orders` (para vincular `table_session_id`):
```sql
CREATE POLICY "Anon can update order session link"
  ON public.orders FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
```

### Bug 2: "Meus Pedidos" mostra pedidos antigos
O `MyOrdersDrawer` busca pedidos por IDs armazenados no `localStorage`, que acumulam indefinidamente. Pedidos de dias atras continuam aparecendo.

**Correcao:** No modo `open_tab`, filtrar pedidos apenas da sessao ativa (`table_session_id`). No modo `prepaid`, filtrar apenas pedidos das ultimas 24 horas. Passar `tableSessionId` e `paymentMode` como props para o `MyOrdersDrawer`.

### Bug 3: Primeiro pedido nao aparece no Caixa
O fluxo atual: (1) insere order SEM `table_session_id`, (2) chama `onOrderPlaced`, (3) cria session, (4) faz UPDATE para vincular. Esse UPDATE pode falhar silenciosamente por RLS.

**Correcao:** Criar a `table_session` ANTES de inserir o pedido (dentro do `OrderSummaryDrawer`), para que o INSERT do pedido ja inclua o `table_session_id`. Mover a logica de criacao de sessao do `handleOrderPlaced` (PublicMenu) para o `handleSendOrder` (OrderSummaryDrawer).

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/components/menu/MyOrdersDrawer.tsx` | Aceitar props `tableSessionId` e `paymentMode`; filtrar pedidos por sessao ou por tempo |
| `src/components/menu/OrderSummaryDrawer.tsx` | Criar table_session antes do INSERT do pedido; expor novo sessionId via callback |
| `src/pages/menu/PublicMenu.tsx` | Passar novas props ao MyOrdersDrawer; simplificar handleOrderPlaced; remover logica duplicada de criacao de sessao |

## Detalhes Tecnicos

### MyOrdersDrawer - Filtro por sessao/tempo

```typescript
// Novas props:
interface MyOrdersDrawerProps {
  // ...existentes
  tableSessionId?: string | null;
  paymentMode?: "open_tab" | "prepaid";
}

// No fetchOrders:
if (paymentMode === "open_tab" && tableSessionId) {
  // Buscar apenas pedidos da sessao ativa
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("table_session_id", tableSessionId)
    .order("created_at", { ascending: false });
} else {
  // Modo prepaid: buscar por IDs do localStorage, mas filtrar ultimas 24h
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .in("id", ids)
    .gte("created_at", new Date(Date.now() - 24*60*60*1000).toISOString())
    .order("created_at", { ascending: false });
}
```

### OrderSummaryDrawer - Criar sessao antes do pedido

No `handleSendOrder`, quando `paymentMode === "open_tab"` e `tableSessionId` e null:

1. Criar `table_session` primeiro
2. Usar o ID retornado no INSERT do pedido
3. Chamar um novo callback `onSessionCreated(sessionId)` para atualizar o estado no PublicMenu

### PublicMenu - Simplificar handleOrderPlaced

Remover toda a logica de criacao de sessao do `handleOrderPlaced`. Adicionar um callback `onSessionCreated` que apenas salva o `tableSessionId` no state e localStorage.

### SQL - Politicas RLS

Executar as queries SQL mencionadas no Bug 1 diretamente no Supabase SQL Editor para corrigir as permissoes de UPDATE para usuarios anonimos.

