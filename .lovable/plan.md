

# Sprint: 5 Correções Críticas

## FIX 1 — Countdown do Pix (PixPaymentModal.tsx)
O timer calcula `remaining` em milissegundos mas pode gerar valores absurdos se `expiration` vier em formato inesperado. Corrigir para usar `Math.floor(diff/1000)` com guard `diff <= 0` e padStart em ambos minutos e segundos.

**Arquivo:** `src/components/menu/PixPaymentModal.tsx` (linhas 42-50)

## FIX 2 — Status em português no modal do Caixa (TableSessionModal.tsx)
Linha 147: `{order.status}` exibe o valor cru do banco. Adicionar mapeamento `statusLabel` e aplicar em `<Badge>{statusLabel[order.status] || order.status}</Badge>`.

**Arquivo:** `src/components/cashier/TableSessionModal.tsx` (linha 147)

O KDS já usa labels próprios nas colunas (linhas 49-54), não precisa de alteração.

## FIX 3 — Header do menu público com cor do restaurante
Análise do código: o header na linha 279 **já usa** `restaurant.primaryColor` via inline style, e os botões/tabs também usam inline styles com `primaryColor`. O código está correto. Contudo, vou verificar se há algum CSS global ou classe que override. Não há `bg-primary` no header. A cor pode estar vindo correta do banco — se o restaurante tem cor azul configurada, aparece azul. **Nenhuma mudança necessária**, mas vou confirmar que nenhum elemento usa classe hardcoded.

## FIX 4 — Tempo Médio distorcido (Overview.tsx)
O `avgPrepTime` usa `completedOrders` que são filtrados pelo período selecionado (pode ser "year"). Quando o período é longo, pedidos antigos com `updated_at` muito distante inflam o valor. Filtrar para últimas 24h apenas para esta métrica, independente do período selecionado.

**Arquivo:** `src/pages/dashboard/Overview.tsx` (linhas 139-146)

## FIX 5 — Botão "Testar Conexão" Asaas (SettingsPage.tsx)
Adicionar estado `testingKey`/`testResult`, botão "Testar Conexão" abaixo do input da API key, e lógica de fetch para `https://api.asaas.com/v3/myAccount`. Tratar CORS com try/catch mostrando mensagem amarela.

**Arquivo:** `src/pages/dashboard/SettingsPage.tsx` (linhas 203-231)

---

## Resumo de mudanças

| Arquivo | Mudança |
|---|---|
| `src/components/menu/PixPaymentModal.tsx` | Corrigir cálculo do timer com guard e padStart |
| `src/components/cashier/TableSessionModal.tsx` | Adicionar statusLabel map e traduzir badge |
| `src/pages/dashboard/Overview.tsx` | Filtrar avgPrepTime para últimas 24h |
| `src/pages/dashboard/SettingsPage.tsx` | Adicionar botão "Testar Conexão" com fetch direto à API Asaas |

**Nota sobre FIX 3:** O código do PublicMenu já aplica `restaurant.primaryColor` corretamente via inline styles em todos os elementos (header, tabs, botões, preços, nav). Não há cor hardcoded em azul no código. Se a cor aparece azul, é o valor salvo no banco. Nenhuma alteração de código necessária.

