

# Plano: Refatorar Pagamento para Webhook Central n8n

## Resumo

Remover toda exposicao de chaves e chamadas diretas ao Asaas no front-end. Eliminar uso de Edge Functions. O front-end passara a:

1. Enviar pedido para um **webhook central do n8n** (URL unica da plataforma Vapt, nao do cliente)
2. Fazer **polling direto no Supabase** (tabela `orders`) para detectar confirmacao de pagamento
3. O n8n sera responsavel por buscar a API Key do restaurante no banco, gerar o Pix no Asaas e atualizar o status do pedido

O cliente (restaurante) apenas salva sua API Key do Asaas no Dashboard -- nao precisa saber nada sobre n8n ou webhooks.

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/components/menu/OrderSummaryDrawer.tsx` | Substituir `supabase.functions.invoke("create-pix-payment")` por `fetch()` para URL central do n8n |
| `src/components/menu/PixPaymentModal.tsx` | Substituir `supabase.functions.invoke("check-payment-status")` por SELECT direto na tabela `orders`; trocar prop `paymentId` por `orderId` |
| `src/pages/dashboard/SettingsPage.tsx` | Remover `handleValidateKey` que chama Asaas diretamente do browser; campo API Key continua mas sem validacao client-side |
| `src/lib/constants.ts` | **NOVO** - Constante `N8N_WEBHOOK_URL` (usando `import.meta.env.VITE_N8N_WEBHOOK_URL` com fallback) |

## Arquivos que NAO mudam

- `src/pages/menu/PublicMenu.tsx` - nao precisa mais passar webhook URL, ja que e uma constante global
- Edge Functions existentes ficam no repositorio como referencia mas nao serao usadas pelo front-end

---

## Detalhes Tecnicos

### 1. Nova constante: `src/lib/constants.ts`

```typescript
export const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || "";
```

Voce definira a variavel `VITE_N8N_WEBHOOK_URL` no ambiente de build. Como e uma URL publica de webhook (nao uma chave secreta), pode ser uma variavel de ambiente do Vite sem problema de seguranca.

### 2. OrderSummaryDrawer - Gerar Pix via n8n

Bloco atual (linhas 134-158):
```text
ANTES:
  const { data: pixResult } = await supabase.functions.invoke("create-pix-payment", { body: {...} })

DEPOIS:
  const res = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurant_id: restaurantId,
      order_id: orderData.id,
      value: totalPrice,
      customer_name: `Mesa ${tableNumber || "S/N"}`,
      table_number: tableNumber,
    }),
  });
  const pixResult = await res.json();
```

O n8n deve retornar o mesmo formato:
```json
{
  "payment_id": "pay_xxx",
  "qr_code_base64": "iVBOR...",
  "pix_payload": "00020126...",
  "expiration": "2025-01-01T12:30:00Z"
}
```

Tambem passaremos `orderId` ao PixPaymentModal em vez de depender apenas do `paymentId`.

### 3. PixPaymentModal - Polling direto no Supabase

Interface muda: `paymentId` e `restaurantId` saem, entra `orderId`.

Bloco atual (linhas 60-78):
```text
ANTES:
  supabase.functions.invoke("check-payment-status", { body: { restaurant_id, payment_id } })

DEPOIS:
  const { data } = await supabase
    .from("orders")
    .select("payment_status, status")
    .eq("id", orderId)
    .single();

  if (data && ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(data.payment_status)) {
    setConfirmed(true);
    onPaymentConfirmed();
  }
```

O n8n sera responsavel por verificar o pagamento no Asaas e fazer o UPDATE no banco (payment_status + status). O front-end so le.

### 4. SettingsPage - Remover validacao direta do Asaas

- Remover a funcao `handleValidateKey` inteira (linhas 105-133) que faz `fetch` direto para `sandbox.asaas.com` do browser, expondo a chave
- Remover os states `validatingKey` e `keyValid`
- O campo da API Key continua visivel quando `payment_mode === "prepaid"`, mas sem botao "Validar Chave"
- Adicionar texto explicativo: "Sua chave sera validada automaticamente ao processar o primeiro pagamento"
- Remover a condicao que exige `keyValid` antes de salvar (`handleSavePayment` linhas 139-146)

### 5. Fluxo Atualizado

```text
MODO PAGAMENTO ANTECIPADO (com n8n):

  1. Cliente clica "Pagar com Pix"
  2. Front-end insere pedido com status "waiting_payment"
  3. Front-end faz POST para webhook central n8n (URL da plataforma Vapt)
  4. n8n recebe restaurant_id + order_id
  5. n8n busca asaas_api_key no banco de dados do Supabase
  6. n8n gera Pix no Asaas e retorna QR Code + payload
  7. Front-end exibe QR Code no PixPaymentModal
  8. Front-end faz polling a cada 5s: SELECT payment_status FROM orders WHERE id = orderId
  9. n8n (outro fluxo ou o mesmo) verifica pagamento e atualiza orders no banco
  10. Quando payment_status = CONFIRMED -> front-end mostra sucesso e fecha modal
```

### 6. Seguranca

- A API Key do Asaas **nunca** e exposta no front-end (nem para validacao)
- O webhook do n8n e uma URL publica da plataforma -- nao e segredo, apenas um endpoint POST
- O n8n acessa o banco com credenciais seguras para ler a API Key
- O polling do front-end le apenas o `payment_status` via RLS (o cliente so ve seus proprios pedidos)

