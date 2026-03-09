
# KDS Enhancements - Timer Visual + Som + Persistência

## Análise

O KDS já possui:
- Sistema de polling 5s
- Detecção de novos pedidos com `knownOrderIdsRef`
- Som de alerta existente (`playBellSound`)
- Atualização de status via Supabase direto (não via n8n)
- Timer simples que atualiza a cada 15s

## Mudanças Necessárias

### 1.1 Timer Visual (Semáforo)
- Mudar `setTick` de 15s para 1s para atualizar timer a cada segundo
- Criar função `getTimerDisplay(order)` que retorna `{ display: "MM:SS", bgColor, textColor }`
- Cores: Verde (<10min), Amarelo (10-20min), Vermelho (>20min)
- Para `status === "ready"`, usar `updated_at` como tempo de parada
- Aplicar background no Card via `style={{ backgroundColor, color }}`

### 1.2 Alerta Sonoro Toggle
- Adicionar estado `soundEnabled` com localStorage (`vapt_kds_sound_enabled`)
- Botão toggle no header com ícone Bell/BellOff
- Condicionar `playBellSound()` ao estado `soundEnabled`
- Filtrar novos pedidos apenas `payment_status === 'CONFIRMED'` para tocar som

### 1.3 Persistência de Status
- A função `advance()` já persiste via Supabase diretamente (linhas 175-178)
- Adicionar estado `updatingOrderId` para mostrar spinner
- Já tem tratamento de erro com toast e não reverte estado (precisa reverter)
- Manter a lógica atual via Supabase pois já funciona

## Código

**Arquivo:** `src/pages/dashboard/KitchenMonitor.tsx`

1. Timer de 15s → 1s
2. Nova função `getTimerStyle(order, isReady)` com cores do semáforo
3. Estado `soundEnabled` + localStorage + toggle button
4. Estado `updatingOrderId` + spinner + rollback em erro
5. Timer pausa na coluna "Prontos" usando `updated_at`
