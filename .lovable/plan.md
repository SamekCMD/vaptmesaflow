

# Plano: Sistema de Fluxo Hibrido de Pagamentos

## Resumo

Permitir que cada restaurante escolha entre dois modos de operacao: **Pagamento Antecipado** (Pix via Asaas antes de enviar para cozinha) ou **Comanda Aberta** (pedido vai direto para cozinha, cliente paga depois). A API Key do Asaas sera fornecida pelo proprio dono do restaurante no Dashboard.

---

## 1. Banco de Dados - Migracao SQL

Adicionar colunas na tabela `restaurants`:

```sql
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'open_tab'
    CHECK (payment_mode IN ('prepaid', 'open_tab')),
  ADD COLUMN IF NOT EXISTS asaas_api_key TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS max_pending_orders INT NOT NULL DEFAULT 3;
```

Adicionar status `waiting_payment` ao enum de pedidos:

```sql
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'waiting_payment' BEFORE 'pending';
```

Adicionar coluna `payment_id` na tabela `orders` para rastrear o pagamento Asaas:

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT '';
```

**Nota sobre RLS**: As politicas existentes ja protegem UPDATE de restaurants apenas pelo owner autenticado. A API Key ficara armazenada na tabela, mas so sera lida pela Edge Function (via service_role) e pelo proprio dono (via RLS de SELECT por owner_id).

---

## 2. Edge Function: `create-pix-payment`

Uma Edge Function que recebe os dados do pedido e chama a API do Asaas para gerar um Pix dinamico. O fluxo:

1. Recebe `restaurant_id`, `order_id`, valor e dados do cliente
2. Busca a `asaas_api_key` do restaurante usando service_role
3. Chama a API do Asaas (`POST /api/v3/payments`) com:
   - `billingType: "PIX"`
   - `value`, `description`, `dueDate`
4. Retorna o `QR Code (base64)`, `payload (copia-e-cola)` e `payment_id`
5. Atualiza o pedido com `payment_id`

**Nota**: Como o Supabase e externo, sera necessario rodar esta edge function no ambiente Supabase do usuario.

---

## 3. Edge Function: `check-payment-status`

Uma Edge Function para polling do status do pagamento:

1. Recebe `restaurant_id` e `payment_id`
2. Busca a API Key do restaurante
3. Chama `GET /api/v3/payments/{id}` no Asaas
4. Retorna o status (`PENDING`, `CONFIRMED`, `RECEIVED`, etc.)
5. Se confirmado, atualiza o pedido de `waiting_payment` para `pending`

---

## 4. Dashboard - Pagina de Configuracoes de Pagamento

Nova secao na pagina `SettingsPage.tsx` (ou uma nova rota `/dashboard/payments`):

### Componentes:
- **Switch** visual entre "Comanda Aberta" e "Pagamento Antecipado"
- **Campo API Key do Asaas** (type="password") - visivel apenas quando modo = "prepaid"
- **Botao "Validar Chave"** que faz um GET de teste na API do Asaas (`/api/v3/finance/balance`)
- **Campo "Limite de pedidos pendentes"** para modo comanda aberta (default: 3)
- Salva em `restaurants` via UPDATE protegido por RLS

### UX:
- Ao trocar o toggle, mostrar descricao do modo selecionado
- Indicador visual (badge verde) quando API Key validada com sucesso
- Alerta se tentar ativar modo prepaid sem API Key valida

---

## 5. Menu Publico - Logica Condicional

### 5.1 Buscar configuracao do restaurante

Ao carregar `PublicMenu.tsx`, ja temos os dados do restaurante. Adicionar leitura de `payment_mode` e `max_pending_orders` no fetch existente.

### 5.2 Modo "Comanda Aberta" (`open_tab`)

- Pedido vai direto para cozinha com status `pending` (comportamento atual)
- **Anti-fraude**: Antes de enviar, contar pedidos do cliente (via localStorage IDs) com status `pending` ou `preparing`. Se >= `max_pending_orders`, bloquear com mensagem: "Aguarde seus pedidos anteriores serem aceitos pela cozinha."
- **Nova aba "Minha Comanda"**: Agrupa todos os pedidos da mesa/sessao, soma total em tempo real. Componente `TabDrawer.tsx` que reutiliza dados do `MyOrdersDrawer`

### 5.3 Modo "Pagamento Antecipado" (`prepaid`)

1. Cliente monta carrinho normalmente
2. Ao clicar "Enviar Pedido", o `OrderSummaryDrawer` muda o fluxo:
   - INSERT do pedido com status `waiting_payment`
   - Chama Edge Function `create-pix-payment`
   - Abre modal `PixPaymentModal` com QR Code e codigo copia-e-cola
3. Modal faz polling a cada 5s na Edge Function `check-payment-status`
4. Quando confirmado:
   - Modal fecha automaticamente
   - Animacao de sucesso: "Pagamento confirmado! Pedido enviado para a cozinha!"
   - Pedido muda para `pending` e aparece no KDS

### 5.4 Pedidos `waiting_payment` no KDS

- O KDS continua filtrando por `pending`, `preparing`, `ready` - pedidos aguardando pagamento **nao aparecem**

---

## 6. Componente: PixPaymentModal

Novo componente `src/components/menu/PixPaymentModal.tsx`:

- Modal (Dialog) com layout limpo
- QR Code renderizado como imagem base64 (retornada pelo Asaas)
- Botao "Copiar codigo Pix" com feedback visual
- Contador regressivo de expiracao (ex: 30 minutos)
- Indicador de "Aguardando pagamento..." com spinner
- Auto-fechamento ao confirmar + animacao de sucesso (CheckCircle2 com Framer Motion, similar ao sucesso atual do OrderSummaryDrawer)

---

## 7. Validacao de Mesa (Anti-Fraude)

No `OrderSummaryDrawer`, antes de inserir o pedido:
- Verificar que `tableNumber` nao esta vazio
- Validar que o `restaurant_id` corresponde ao slug da URL (ja garantido pelo fetch atual)
- O `restaurant_id` e injetado server-side pela query, nao pelo cliente

---

## 8. Arquivos a Criar/Modificar

| Arquivo | Acao |
|---|---|
| Migracao SQL | Adicionar colunas `payment_mode`, `asaas_api_key`, `max_pending_orders` em restaurants; `payment_id`, `payment_status` em orders; novo valor no enum |
| `supabase/functions/create-pix-payment/index.ts` | **NOVO** - Edge Function para gerar Pix via Asaas |
| `supabase/functions/check-payment-status/index.ts` | **NOVO** - Edge Function para verificar status do pagamento |
| `src/pages/dashboard/SettingsPage.tsx` | Adicionar secao de Configuracoes de Pagamento com Switch e campo API Key |
| `src/components/menu/PixPaymentModal.tsx` | **NOVO** - Modal de pagamento Pix com QR Code e polling |
| `src/components/menu/OrderSummaryDrawer.tsx` | Logica condicional: prepaid (gera Pix) vs open_tab (envia direto) + anti-fraude |
| `src/pages/menu/PublicMenu.tsx` | Passar `paymentMode` e `maxPendingOrders` para os drawers; aba "Minha Comanda" |
| `src/components/menu/MyOrdersDrawer.tsx` | Adicionar visao de "Comanda" com total acumulado da mesa |

---

## 9. Fluxo Resumido

```text
MODO COMANDA ABERTA:
  Cliente -> Adiciona itens -> Enviar Pedido
    -> Verifica limite de pendentes (max 3)
    -> INSERT orders (status=pending) -> Cozinha ve instantaneamente
    -> Aba "Minha Comanda" mostra total acumulado da mesa

MODO PAGAMENTO ANTECIPADO:
  Cliente -> Adiciona itens -> Enviar Pedido
    -> INSERT orders (status=waiting_payment)
    -> Edge Function gera Pix via Asaas
    -> Modal com QR Code + Copia e Cola
    -> Polling a cada 5s verifica status
    -> Pagamento confirmado -> status=pending -> Cozinha ve o pedido
    -> Animacao de sucesso
```

---

## Secao Tecnica

### Asaas API Endpoints usados:
- `POST /api/v3/payments` - Criar cobranca Pix
- `GET /api/v3/payments/{id}/pixQrCode` - Obter QR Code
- `GET /api/v3/payments/{id}` - Verificar status
- `GET /api/v3/finance/balance` - Validar API Key

### Ambiente Asaas:
- Sandbox: `https://sandbox.asaas.com`
- Producao: `https://api.asaas.com`
- Header: `access_token: $API_KEY`

### Seguranca:
- A API Key do Asaas **nunca** e exposta no client-side
- Todas as chamadas ao Asaas passam pelas Edge Functions usando service_role para ler a chave
- RLS garante que apenas o owner pode ler/editar sua propria `asaas_api_key`
- O `restaurant_id` e derivado do slug no fetch, nao manipulavel pelo cliente
- Pedidos `waiting_payment` ficam invisiveis no KDS ate confirmacao

