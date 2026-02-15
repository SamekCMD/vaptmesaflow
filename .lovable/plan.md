

# Plano: Corrigir Menu Publico, Configuracoes e Aparencia

## Problemas Identificados

### 1. PublicMenu.tsx - JSX Quebrado + Dados Mock
- **JSX quebrado**: Linhas 190-191 e 213-217 tem props `style` "soltas" fora de elementos (provavelmente de um merge ruim do GitHub). Isso causa erro de compilacao ou comportamento inesperado.
- **Dados mock**: O componente usa `defaultRestaurantConfig` ("Bistro du Chef") e `mockMenuItems` hardcoded, ignorando completamente o parametro `slug` da URL. Por isso qualquer slug mostra o mesmo conteudo.

### 2. AppearancePage.tsx - Usa RestaurantContext (memoria apenas)
- Lê e escreve no `RestaurantContext` que e apenas estado em memoria (useState).
- O botao "Salvar Alteracoes" mostra um toast mas nao persiste nada no Supabase.
- Precisa buscar o restaurante do usuario logado ao montar e salvar via `supabase.from('restaurants').update(...)`.

### 3. SettingsPage.tsx - Colunas inexistentes no banco
- O codigo busca `phone`, `hours` e `description` da tabela `restaurants`, mas essas colunas **nao existem** no schema SQL criado anteriormente.
- O schema tem `whatsapp` em vez de `phone`, e nao tem `hours` nem `description`.
- Opcoes: adicionar as colunas faltantes OU ajustar o codigo para usar as existentes.

## Alteracoes Planejadas

### 1. Adicionar colunas faltantes na tabela `restaurants`
SQL para executar manualmente no Supabase:
```
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS hours TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
```

### 2. Corrigir PublicMenu.tsx
- Remover as linhas de JSX quebrado (props soltas nas linhas 190-191 e 213-217)
- Substituir os dados mock por fetch real do Supabase:
  - Buscar restaurante: `supabase.from('restaurants').select('*').eq('slug', slug).single()`
  - Buscar menu items: `supabase.from('menu_items').select('*').eq('restaurant_id', restaurant.id).eq('available', true)`
- Adicionar estados de loading e erro (restaurante nao encontrado)

### 3. Conectar AppearancePage.tsx ao Supabase
- Remover dependencia do `RestaurantContext` para dados
- Usar `useAuth()` para obter o `user.id`
- No `useEffect`, buscar: `supabase.from('restaurants').select('*').eq('owner_id', user.id).single()`
- Preencher o formulario com os dados reais (name, slug, primary_color, secondary_color, font_family, logo_url)
- No `handleSave`, fazer: `supabase.from('restaurants').update({...}).eq('owner_id', user.id)`
- Manter o preview ao vivo funcionando com estado local

### 4. SettingsPage.tsx ja funciona
- O SettingsPage ja usa Supabase corretamente. Apos adicionar as colunas `phone`, `hours` e `description`, ele vai funcionar sem alteracoes no codigo.

## Resumo dos Arquivos

| Arquivo | Acao |
|---|---|
| `src/pages/menu/PublicMenu.tsx` | Corrigir JSX quebrado + fetch real por slug |
| `src/pages/dashboard/AppearancePage.tsx` | Conectar ao Supabase (ler/salvar) |
| Supabase SQL (manual) | Adicionar colunas `phone`, `hours`, `description` |

## Instrucao para o Usuario
Antes de aprovar, execute este SQL no seu Supabase:
```sql
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS hours TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
```

