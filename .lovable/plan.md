# Plano: Sistema de Fluxo de Pedidos em Tempo Real

## Visao Geral

Conectar o carrinho do cliente no menu publico com o painel de cozinha (KDS) do dashboard, usando tabelas reais no Supabase e Realtime para notificacoes instantaneas.

## 1. Banco de Dados - Migracoes SQL

### Criar enum e tabelas

```sql
-- Enum de status
CREATE TYPE public.order_status AS ENUM ('pending', 'preparing', 'ready', 'delivered');

-- Tabela orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id BIGINT NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_number TEXT,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sequencia por restaurante: display_id sera gerado via trigger
CREATE OR REPLACE FUNCTION public.generate_display_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(display_id), 0) + 1 INTO NEW.display_id
  FROM public.orders
  WHERE restaurant_id = NEW.restaurant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_display_id
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.generate_display_id();

-- Tabela order_items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.menu_items(id),
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  notes TEXT DEFAULT ''
);

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode inserir pedidos (cliente publico, sem auth)
CREATE POLICY "Anyone can insert orders" ON public.orders FOR INSERT WITH CHECK (true);
-- Qualquer um pode ler pedidos do restaurante (para o cliente acompanhar)
CREATE POLICY "Anyone can read orders" ON public.orders FOR SELECT USING (true);
-- Apenas dono autenticado pode atualizar status
CREATE POLICY "Owner can update orders" ON public.orders FOR UPDATE TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Anyone can insert order_items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read order_items" ON public.order_items FOR SELECT USING (true);

-- Habilitar Realtime na tabela orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
```

### Notas sobre seguranca

- INSERT e SELECT sao publicos (cliente do menu nao tem auth)
- UPDATE restrito ao owner do restaurante (autenticado)
- O KDS filtra por `restaurant_id` do dono logado

## 2. Fluxo do Cliente (Menu Publico)

### 2.1 Capturar mesa da URL

- Ler `?table=15` da URL em `PublicMenu.tsx` via `useSearchParams`
- Armazenar em estado e exibir no header ("Mesa 15")
- Se não houver numero da mesa, mostrar uma tela alertando ao usuário para ler o QR Code exibido na mesa.

### 2.2 Enviar pedido real (`OrderSummaryDrawer.tsx`)

- Substituir o `setTimeout` fake por insert real no Supabase:
  1. `INSERT INTO orders` com `restaurant_id`, `table_number`, `total_price`
  2. `INSERT INTO order_items` com cada item do carrinho
- Salvar os IDs dos pedidos no `localStorage` para rastrear "Meus Pedidos"

### 2.3 Aba "Meus Pedidos" no menu inferior

- Nova aba no bottom nav com icone `ClipboardList`
- Cria componente `MyOrdersDrawer.tsx`:
  - Lista pedidos do localStorage filtrados por restaurant_id
  - Busca status atual via Supabase
  - Mostra: display_id, itens, status (badge colorido), horario
- Supabase Realtime: subscribe em `orders` filtrado pelos IDs do localStorage
  - Quando status muda para `ready`, exibir toast: "Seu pedido #X esta pronto!"

### 2.4 Props adicionais no OrderSummaryDrawer

- Receber `restaurantId` e `tableNumber`
- Callback `onOrderPlaced` para salvar o order ID no localStorage

## 3. KDS Dashboard (KitchenMonitor.tsx)

### 3.1 Conectar ao Supabase

- Remover dados mock `initialOrders`
- Buscar pedidos reais: `supabase.from('orders').select('*, order_items(*)').eq('restaurant_id', restaurantId).in('status', ['pending','preparing','ready']).order('created_at')`
- Obter `restaurant_id` do dono logado via query em `restaurants` por `owner_id`

### 3.2 Realtime no KDS

- Subscribe em `orders` filtrado por `restaurant_id`
- Novos pedidos aparecem automaticamente na coluna "Novos"
- Mudancas de status movem cards entre colunas

### 3.3 Acoes do Chef

- Botao "Aceitar" (pending -> preparing): `supabase.from('orders').update({ status: 'preparing' }).eq('id', orderId)`
- Botao "Finalizar" (preparing -> ready): `supabase.from('orders').update({ status: 'ready' }).eq('id', orderId)`
- Toast de confirmacao apos cada acao

### 3.4 Alerta visual de pedidos antigos

- Pedidos com mais de 10 minutos: borda vermelha pulsante via CSS animation (`animate-pulse border-red-500`)

### 3.5 Mapeamento de colunas

- Renomear: "queue" -> "pending" para alinhar com o enum
- Colunas: Novos (pending), Preparando (preparing), Prontos (ready)

## 4. Arquivos a Criar/Modificar


| Arquivo                                      | Acao                                                                |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Migracao SQL                                 | Criar tabelas `orders`, `order_items`, enum, trigger, RLS, realtime |
| `src/components/menu/OrderSummaryDrawer.tsx` | Insert real no Supabase + receber restaurantId/tableNumber          |
| `src/components/menu/MyOrdersDrawer.tsx`     | **NOVO** - aba meus pedidos com realtime                            |
| `src/pages/menu/PublicMenu.tsx`              | Ler `?table=`, aba "Meus Pedidos", passar props ao drawer           |
| `src/pages/dashboard/KitchenMonitor.tsx`     | Fetch real + realtime + alerta 10min                                |
| `src/hooks/use-cart.ts`                      | Sem mudancas                                                        |


## 5. Fluxo Resumido

```text
Cliente abre /menu/slug?table=15
  -> Adiciona itens ao carrinho
  -> Confirma pedido
  -> INSERT orders + order_items no Supabase
  -> Salva order_id no localStorage
  -> Aba "Meus Pedidos" mostra status em tempo real

Chef no Dashboard /dashboard/kitchen
  -> Ve pedido novo aparecer (Realtime)
  -> Clica "Aceitar" -> status = preparing
  -> Cliente recebe notificacao em tempo real
  -> Clica "Finalizar" -> status = ready
  -> Cliente recebe toast "Pedido pronto!"
```