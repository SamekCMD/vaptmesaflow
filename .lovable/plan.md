

# Plano: Conectar Onboarding ao Supabase e Atualizar Dashboard

## Problemas Identificados

1. **Onboarding nao salva nada** - O `handleFinish` apenas navega para `/dashboard` sem inserir dados no Supabase
2. **Dashboard com dados hardcoded** - Mostra "Joao Demo" e metricas fixas em vez de dados reais do usuario logado
3. **Sem protecao de rotas** - Qualquer pessoa acessa `/dashboard` sem estar logada
4. **Senha/Login** - As senhas ficam na tabela `auth.users` do Supabase (gerenciada automaticamente). O login funciona normalmente com email + senha via `signInWithPassword`

## Alteracoes Planejadas

### 1. Onboarding - Salvar no Supabase (`OnboardingPage.tsx`)
- No `handleFinish`, inserir na tabela `restaurants` (name, slug, whatsapp, primary_color, secondary_color, owner_id = user autenticado)
- Inserir o primeiro prato na tabela `menu_items` (name, price, description, category, restaurant_id)
- Mostrar loading e tratamento de erros
- Importar `supabase` client e `useAuth` para obter o `user.id`

### 2. Dashboard Layout - Dados reais do usuario (`DashboardLayout.tsx`)
- Usar `useAuth()` para obter o nome do usuario logado (de `user.user_metadata.full_name`)
- Mostrar as iniciais reais no avatar
- Adicionar botao de logout funcional
- Redirecionar para `/login` se nao estiver autenticado

### 3. Dashboard Overview - Buscar dados do restaurante (`Overview.tsx`)
- Buscar o restaurante do usuario logado via Supabase (`restaurants` WHERE `owner_id = auth.uid()`)
- Se nao houver restaurante, mostrar mensagem orientando a completar o onboarding
- Manter as metricas visuais mas indicar que sao dados de exemplo por enquanto (sem tabela de pedidos ainda)

### 4. Protecao de rotas - Componente `ProtectedRoute`
- Criar componente que verifica se o usuario esta autenticado
- Se nao estiver, redireciona para `/login`
- Se estiver carregando, mostra loading spinner
- Envolver as rotas `/dashboard` e `/onboarding` com este componente

### 5. Fluxo pos-cadastro
- Signup -> auto-login (ja acontece com confirmacao de email desativada) -> Onboarding -> salva restaurante -> Dashboard
- Login -> verificar se tem restaurante -> se nao, redirecionar para onboarding; se sim, ir para dashboard

## Detalhes Tecnicos

### Novo arquivo: `src/components/ProtectedRoute.tsx`
Componente wrapper que usa `useAuth()` para checar autenticacao e redirecionar.

### Alteracoes em `OnboardingPage.tsx`
```
handleFinish:
  1. Insert into restaurants (owner_id, name, slug, whatsapp, primary_color, secondary_color)
  2. Get the returned restaurant.id
  3. Insert into menu_items (restaurant_id, name, price, description, category)
  4. Navigate to /dashboard
```

### Alteracoes em `DashboardLayout.tsx`
- Substituir "Joao Demo" / "JD" por dados reais de `useAuth().user`
- Adicionar funcao de logout no dropdown do usuario

### Alteracoes em `Overview.tsx`
- Query Supabase para buscar restaurante do owner logado
- Exibir nome do restaurante no cabecalho
- Estado vazio amigavel se nao houver restaurante

### Alteracoes em `App.tsx`
- Envolver rotas protegidas com `ProtectedRoute`

### Sobre senhas
Nao e necessario campo de senha nas tabelas publicas. O Supabase gerencia senhas internamente na tabela `auth.users` (hash bcrypt). O login funciona via `signInWithPassword(email, password)` que ja esta implementado.

