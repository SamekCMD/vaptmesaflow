

# Correção: "Finalizar Conta" falha com erro 409

## Causa Raiz

O erro nos logs de rede é claro:

```
"duplicate key value violates unique constraint table_sessions_restaurant_id_table_number_status_key"
```

Existe uma constraint `UNIQUE(restaurant_id, table_number, status)` na tabela `table_sessions`. Quando você tenta mudar o status para `closed`, o banco rejeita porque **já existe outra sessão fechada** para a mesma mesa. Ou seja, a mesa 2 já foi fechada anteriormente, e a constraint impede que duas linhas tenham `(restaurant_id, "2", "closed")`.

## Solução

Essa constraint precisa ser **removida**. A intenção original era impedir duas sessões abertas na mesma mesa, mas uma constraint UNIQUE simples não funciona para isso — ela também bloqueia múltiplas sessões fechadas.

### SQL a executar no Supabase:

```sql
ALTER TABLE public.table_sessions
  DROP CONSTRAINT IF EXISTS table_sessions_restaurant_id_table_number_status_key;
```

Opcionalmente, para manter a proteção contra duas sessões abertas na mesma mesa, pode-se criar um **unique index parcial**:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS unique_open_session_per_table
  ON public.table_sessions (restaurant_id, table_number)
  WHERE status IN ('open', 'check_requested');
```

Isso permite múltiplas sessões `closed` para a mesma mesa, mas impede duas sessões ativas simultâneas.

### Código — nenhuma alteração necessária

O código do `TableSessionModal.tsx` está correto. O problema é exclusivamente no banco de dados.

