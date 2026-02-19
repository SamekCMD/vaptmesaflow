

# Plano: Fluxo "Pagar Depois" com Dashboard de Caixa

## Resumo

Implementar o modelo de **comanda aberta completo** com sessoes de mesa, dashboard de caixa para o admin, e botoes flutuantes no menu do cliente para "Chamar Garcom" e "Pedir a Conta". Inclui divisao de conta, troca de mesa e alertas sonoros.

---

## 1. Banco de Dados - Migracoes SQL

### 1.1 Tabela `table_sessions`

```sql
CREATE TABLE public.table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  table_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'check_requested', 'closed')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  UNIQUE(restaurant_id, table_number, status) -- previne duas sessoes abertas na mesma mesa (parcial via trigger ou app logic)
);

-- RLS: admin do restaurante pode ler/editar
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can manage table_sessions"
  ON public.table_sessions FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- Acesso anonimo para INSERT e SELECT (cliente abre sessao e pede conta)
CREATE POLICY "Anon can read open sessions"
  ON public.table_sessions FOR SELECT
  USING (status IN ('open', 'check_requested'));

CREATE POLICY "Anon can insert sessions"
  ON public.table_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon can update to check_requested"
  ON public.table_sessions FOR UPDATE
  USING (status = 'open');
```

### 1.2 Vincular `orders` a `table_sessions`

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS table_session_id UUID REFERENCES public.table_sessions(id);
```

---

## 2. Arquivos a Criar

| Arquivo | Descricao |
|---|---|
| `src/pages/dashboard/CashierPage.tsx` | Dashboard de Caixa com mapa de mesas |
| `src/components/cashier/TableCard.tsx` | Card de mesa individual (livre/ocupada/pediu conta) |
| `src/components/cashier/TableSessionModal.tsx` | Modal de extrato da mesa com divisao de conta e troca de mesa |
| `src/components/menu/FloatingActions.tsx` | Botoes flutuantes "Chamar Garcom" e "Pedir a Conta" no menu do cliente |

## 3. Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/App.tsx` | Adicionar rota `/dashboard/cashier` |
| `src/components/DashboardLayout.tsx` | Adicionar item "Caixa" no menu lateral |
| `src/pages/menu/PublicMenu.tsx` | Logica de sessao de mesa + botoes flutuantes + texto do botao condicional |
| `src/components/menu/OrderSummaryDrawer.tsx` | Vincular pedido a `table_session_id`; trocar botao para "Confirmar Pedido" no modo open_tab |

---

## 4. Detalhes Tecnicos

### 4.1 Logica de Sessao de Mesa (PublicMenu)

Quando `paymentMode === "open_tab"` e o cliente acessa o menu com `?mesa=X`:

1. Verificar se existe uma `table_session` com `status = 'open'` para aquela mesa/restaurante
2. Se nao existir, criar uma nova ao enviar o primeiro pedido
3. Salvar o `session_id` no `localStorage` para uso nos pedidos seguintes
4. Todos os pedidos incluirao `table_session_id` no INSERT

### 4.2 OrderSummaryDrawer - Modo Open Tab

- Quando `paymentMode === "open_tab"`: botao diz **"Confirmar Pedido"** (em vez de "Pagar com Pix")
- O INSERT do pedido inclui `table_session_id`
- Nao chama webhook do n8n, vai direto para cozinha com `status = 'pending'`

### 4.3 Botoes Flutuantes (FloatingActions)

Aparecem apos o primeiro pedido enviado no modo `open_tab`:

- **"Chamar Garcom"**: Insere/atualiza um registro (pode ser via campo na table_session ou uma notificacao simples). Dispara toast de confirmacao.
- **"Pedir a Conta"**: Faz `UPDATE table_sessions SET status = 'check_requested' WHERE id = session_id`. O dashboard de caixa detecta via polling.

### 4.4 Dashboard de Caixa (`CashierPage.tsx`)

**Layout**: Grid de cards representando mesas.

**Dados**: Polling a cada 5 segundos buscando:
```sql
SELECT ts.*, 
  (SELECT SUM(o.total_price) FROM orders o WHERE o.table_session_id = ts.id) as session_total,
  (SELECT COUNT(*) FROM orders o WHERE o.table_session_id = ts.id) as order_count
FROM table_sessions ts
WHERE ts.restaurant_id = :id AND ts.status IN ('open', 'check_requested')
```

**Cores dos Cards**:
- Cinza: mesa livre (sem sessao aberta)
- Verde: mesa ocupada (sessao `open`)
- Amarelo piscando: cliente pediu a conta (`check_requested`)

**Alerta Sonoro**: Quando o polling detecta uma nova sessao `check_requested` que nao existia antes, toca o som de campainha (reutiliza `playBellSound`).

**Tambem alerta** quando um novo pedido chega em qualquer mesa aberta.

### 4.5 Modal de Extrato da Mesa (`TableSessionModal`)

Ao clicar em uma mesa aberta/amarela:

1. **Extrato**: Lista todos os pedidos (`orders`) vinculados aquela `table_session_id` com seus itens
2. **Total da Mesa**: Soma de todos os pedidos
3. **Divisao de Conta**: Campo numerico "Dividir por X pessoas" com calculadora simples mostrando `total / X`
4. **Troca de Mesa**: Dropdown/input para selecionar novo numero de mesa. Faz `UPDATE table_sessions SET table_number = :novo WHERE id = :session_id`
5. **Finalizar Conta**: Botao que faz `UPDATE table_sessions SET status = 'closed', closed_at = now() WHERE id = :session_id`. Fecha o modal e o card desaparece do mapa.

### 4.6 Mapa de Mesas - Quais mesas mostrar?

O sistema mostrara:
- Todas as mesas com sessao aberta ou `check_requested` (dados reais)
- Opcionalmente, o admin pode configurar o numero total de mesas (campo `total_tables` na tabela `restaurants`, default 20) para exibir as livres tambem

Para simplificar a V1, usaremos um campo `total_tables` (default 20) que gera cards de 1 a N, preenchendo com dados reais quando houver sessao ativa.

**Migracao adicional**:
```sql
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS total_tables INT NOT NULL DEFAULT 20;
```

---

## 5. Fluxo Resumido

```text
CLIENTE (modo Pagar Depois):
  1. Acessa menu via QR Code (?mesa=5)
  2. Adiciona itens ao carrinho
  3. Clica "Confirmar Pedido"
  4. Sistema cria table_session (se nao existe) e vincula o pedido
  5. Pedido vai para cozinha (status=pending)
  6. Botoes flutuantes aparecem: "Chamar Garcom" | "Pedir a Conta"
  7. Cliente pode fazer mais pedidos (vinculados a mesma sessao)
  8. Ao clicar "Pedir a Conta": sessao muda para check_requested

ADMIN (Dashboard Caixa):
  1. Ve mapa de mesas em tempo real (polling 5s)
  2. Mesa pisca amarelo quando conta foi solicitada + alerta sonoro
  3. Clica na mesa -> Modal com extrato completo
  4. Pode dividir conta, trocar mesa ou finalizar
  5. Ao finalizar: sessao fecha, mesa volta a ficar livre
```

---

## 6. Secao Tecnica - Resumo de Mudancas

### Migracoes SQL:
- Criar tabela `table_sessions` com RLS
- Adicionar `table_session_id` em `orders`
- Adicionar `total_tables` em `restaurants`

### Novos arquivos (4):
- `src/pages/dashboard/CashierPage.tsx`
- `src/components/cashier/TableCard.tsx`
- `src/components/cashier/TableSessionModal.tsx`
- `src/components/menu/FloatingActions.tsx`

### Arquivos modificados (4):
- `src/App.tsx` - nova rota `/dashboard/cashier`
- `src/components/DashboardLayout.tsx` - item "Caixa" no sidebar
- `src/pages/menu/PublicMenu.tsx` - logica de sessao + botoes flutuantes
- `src/components/menu/OrderSummaryDrawer.tsx` - vincular `table_session_id` + botao condicional

