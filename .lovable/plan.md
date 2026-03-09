

# Sprint: Cardápio Avançado — Imagens, Variações, Horários, Badges, Chef

## Escopo

5 features que estendem o gerenciamento de cardápio (admin) e o cardápio público. Envolve migrações de banco, storage, e mudanças em vários componentes.

---

## Migrações SQL

### Migration 1: Novos campos em `menu_items`
```sql
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS available_from time DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS available_until time DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS badge varchar DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_chef_suggestion boolean DEFAULT false;
```

### Migration 2: Tabela `menu_item_variations`
```sql
CREATE TABLE menu_item_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
  name varchar NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  required boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE menu_item_variations ENABLE ROW LEVEL SECURITY;
-- RLS: authenticated can manage via restaurant ownership; anon can read
CREATE POLICY "Authenticated users manage variations" ON menu_item_variations
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM menu_items mi JOIN restaurants r ON mi.restaurant_id = r.id WHERE mi.id = menu_item_id AND r.owner_id = auth.uid())
  );
CREATE POLICY "Anyone can read variations" ON menu_item_variations
  FOR SELECT TO anon USING (true);
```

### Migration 3: Storage bucket `menu-images`
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;
-- RLS para upload/delete por donos autenticados e leitura pública
CREATE POLICY "Auth users upload menu images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'menu-images');
CREATE POLICY "Auth users delete menu images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'menu-images');
CREATE POLICY "Public read menu images" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'menu-images');
```

---

## Arquivos a Criar/Modificar

### 1. `src/pages/dashboard/MenuManagement.tsx` — Reescrita significativa

**Interface `MenuItem` estendida:**
```ts
interface MenuItem {
  id: string; name: string; price: number; category: string; available: boolean;
  image_url: string | null;
  available_from: string | null; available_until: string | null;
  badge: string | null;
  is_chef_suggestion: boolean;
  variations: Variation[];
}
```

**Form state estendido:** adicionar `image_url`, `imageFile`, `imagePreview`, `availableFrom`, `availableUntil`, `badge`, `isChefSuggestion`, `variations[]`

**3.1 — Upload de imagem:**
- Input `type="file"` accept=".jpg,.png,.webp" max 5MB
- Preview via `URL.createObjectURL`
- Função `resizeImage(file, maxSize=1200)` usa canvas para redimensionar
- Upload para `menu-images/{restaurant_id}/{item_id}.jpg` no Supabase Storage
- Salvar URL pública em `image_url`
- Botão "Remover imagem" que deleta do storage e seta `image_url = null`
- Thumbnail 40x40 rounded na tabela de listagem

**3.2 — Variações:**
- Seção "Variações" no modal de edição
- Botão "Adicionar Variação" cria entry com `name: "", options: [], required: true`
- Cada variação: input nome, input para adicionar opções (Enter para adicionar chip), toggle obrigatório, botão remover
- Ao salvar item: delete existing + insert new variations via `menu_item_variations`
- Fetch variations junto com items via query separada

**3.3 — Horário:**
- Toggle "Restringir horário" no modal
- Inputs `type="time"` para `available_from` e `available_until`
- Salvos no update/insert do menu_item

**3.4 — Badge:**
- Select dropdown: Nenhum / Destaque / Promoção / Novo
- Salvo como `null | 'destaque' | 'promocao' | 'novo'`

**3.5 — Sugestão do Chef:**
- Toggle "Sugestão do Chef"
- Ao ativar: UPDATE todos os outros items para `is_chef_suggestion = false`, depois setar o atual para `true`

### 2. `src/lib/restaurant-config.ts` — Estender `PublicMenuItem`

```ts
export interface PublicMenuItem {
  id: number; name: string; description: string; price: number;
  category: string; imageUrl?: string; available: boolean;
  // novos campos:
  availableFrom?: string | null;
  availableUntil?: string | null;
  badge?: string | null;
  isChefSuggestion?: boolean;
  variations?: { id: string; name: string; options: string[]; required: boolean }[];
}
```

### 3. `src/pages/menu/PublicMenu.tsx` — Mudanças no cardápio público

**Fetch:** incluir novos campos no map dos items + fetch `menu_item_variations` para os item IDs

**3.3 — Filtro por horário:**
- Função `isWithinTimeRange(from, until)` compara hora atual
- Items fora do horário: badge "Fora do horário", botão desabilitado com texto "Disponível HH–HH"

**3.4 — Badges visuais nos cards:**
- `destaque`: badge dourado ⭐
- `promocao`: badge vermelho 🏷️
- `novo`: badge verde ✨
- Posição: canto superior esquerdo do card

**3.5 — Seção Chef no topo:**
- Se existir item com `isChefSuggestion`, renderizar antes das categorias
- Card grande com foto, nome, descrição, preço, botão "Pedir Agora"
- Background: `primaryColor` com 10% opacidade

### 4. `src/components/menu/ProductDrawer.tsx` — Variações

- Receber `variations` do item
- Para cada variação: renderizar grupo de radio buttons estilizados
- State `selectedVariations: Record<string, string>` (variation name → option)
- Variações obrigatórias: validar antes de permitir adicionar
- Ao adicionar: concatenar variações no `notes`: `"Ponto: Ao Ponto | Tamanho: Para 2"`
- Botão desabilitado + mensagem se variação obrigatória não selecionada

### 5. `src/hooks/use-cart.ts` — Ajuste menor

- O `notes` já é string, as variações serão concatenadas nele pelo ProductDrawer, sem mudança necessária no hook

---

## Fluxo de Dados

```text
Admin edita item → Upload imagem → Storage → URL salva em menu_items.image_url
                 → Variações → menu_item_variations (delete+insert)
                 → Campos badge, horário, chef → menu_items UPDATE

Público carrega → menu_items + menu_item_variations JOIN
               → Filtra horário client-side
               → Renderiza badges, chef section, variações no drawer
```

## Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| Migration: add columns to menu_items | criar |
| Migration: menu_item_variations table | criar |
| Migration: menu-images bucket + policies | criar |
| `src/lib/restaurant-config.ts` | modificar (estender PublicMenuItem) |
| `src/pages/dashboard/MenuManagement.tsx` | modificar (imagem, variações, horário, badge, chef) |
| `src/pages/menu/PublicMenu.tsx` | modificar (badges, horário, chef section) |
| `src/components/menu/ProductDrawer.tsx` | modificar (variações com radio buttons) |

