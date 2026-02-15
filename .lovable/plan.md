

# Plano: Skeleton Screens, Toasts, Loading States e Melhorias na Hero

## Resumo

Adicionar feedback visual em todo o app: skeletons durante carregamento, toasts para confirmacoes/erros, e corrigir a Hero da landing page (imagem e botao).

## Alteracoes Planejadas

### 1. Hero da Landing Page (`Hero.tsx`)
- **Remover a imagem hero-dashboard.png** e substituir por uma ilustracao CSS/SVG estilizada mostrando um mockup de dashboard (cards, grafico, etc.) feito com divs e cores do tema. Isso fica sempre alinhado com a marca.
- **Botao "Ver Funcionalidades"**: corrigir a cor do texto para ser legivel. Trocar `text-hero-foreground` por `text-white` ou usar uma cor com contraste adequado sobre o fundo escuro.

### 2. Skeleton no Dashboard Overview (`Overview.tsx`)
- Substituir o spinner `Loader2` por skeleton screens:
  - 4 cards de metricas com skeleton (retangulos cinza pulsantes)
  - 1 card de grafico com skeleton
- Usar o componente `Skeleton` ja existente em `src/components/ui/skeleton.tsx`

### 3. Skeleton no Menu Publico (`PublicMenu.tsx`)
- Substituir o spinner por skeleton do header + lista de itens:
  - Skeleton do cabecalho (circulo + linhas)
  - Skeleton da barra de categorias
  - 4-6 cards de itens com skeleton

### 4. Skeleton na Gestao de Cardapio (`MenuManagement.tsx`)
- Este componente usa dados mock locais (nao conectado ao Supabase ainda), mas vamos preparar a estrutura:
  - Adicionar estado de loading simulado breve
  - Skeleton da tabela (5 linhas com retangulos)
- Adicionar toasts ao salvar/editar/deletar itens

### 5. Skeleton nas Configuracoes (`SettingsPage.tsx`)
- Substituir o spinner por skeleton do formulario (5 campos com labels)

### 6. Skeleton na Aparencia (`AppearancePage.tsx`)
- Substituir qualquer spinner por skeleton do formulario de aparencia

### 7. Skeleton no Monitor da Cozinha (`KitchenMonitor.tsx`)
- Adicionar skeleton das 3 colunas com cards placeholder
- Toast ao avancar pedido ("Pedido #101 movido para Preparando")

### 8. Toasts Globais
- **MenuManagement**: toast ao adicionar, editar e deletar item
- **KitchenMonitor**: toast ao avancar pedido
- **SettingsPage**: ja tem toasts (manter)
- **AppearancePage**: ja tem toast (manter)
- **Overview**: ja tem toast de erro (manter)

## Detalhes Tecnicos

### Componente auxiliar: Skeletons reutilizaveis
Criar componentes skeleton especificos reutilizaveis dentro de cada arquivo (inline) usando o `Skeleton` base:
- `MetricCardSkeleton` - para os 4 cards do dashboard
- `ChartSkeleton` - para o grafico
- `MenuItemSkeleton` - para itens do menu publico
- `TableRowSkeleton` - para linhas da tabela de gestao

### Hero - Mockup ilustrativo
Em vez de usar uma imagem estatica, criar um componente `HeroDashboardMockup` com divs estilizadas que simulam um dashboard:
- Fundo escuro arredondado (card)
- Mini cards de metricas (retangulos coloridos)
- Mini grafico (SVG simples ou barras CSS)
- Isso garante que a ilustracao sempre combine com o tema verde do Vapt

### Botao "Ver Funcionalidades"
Mudar de `text-hero-foreground` para `text-white` e adicionar `border-white/20` para garantir legibilidade sobre o fundo escuro da hero.

## Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/components/landing/Hero.tsx` | Mockup CSS no lugar da imagem + fix botao |
| `src/pages/dashboard/Overview.tsx` | Skeleton screens nos cards e grafico |
| `src/pages/menu/PublicMenu.tsx` | Skeleton do menu publico |
| `src/pages/dashboard/MenuManagement.tsx` | Toasts nas acoes + skeleton da tabela |
| `src/pages/dashboard/KitchenMonitor.tsx` | Toast ao avancar + skeleton |
| `src/pages/dashboard/SettingsPage.tsx` | Skeleton no formulario |
| `src/pages/dashboard/AppearancePage.tsx` | Skeleton no formulario |

