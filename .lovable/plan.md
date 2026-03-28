

# Light Mode + Dropdown Reorganization + Cleanup

## Batch 1 — Theme System

### 1.1 `src/index.css`
- Replace the single `:root` block with light-first tokens using HSL values (shadcn requirement)
- Add `.dark` block with current dark tokens
- Light values: `--background: 45 7% 97%` (#F8F8F6), `--foreground: 60 7% 7%` (#111110), `--primary: 153 20% 45%` (#5C8A72), etc.
- Keep scrollbar, selection, mono utilities — update scrollbar/selection colors to use CSS vars
- Add sidebar vars for both light and dark

### 1.2 `src/hooks/useTheme.ts` (new)
- Custom hook with `localStorage` key `vapt_theme`, default `'light'`
- Toggles `light`/`dark` class on `document.documentElement`
- Returns `{ theme, toggleTheme }`

### 1.3 `src/App.tsx`
- Remove `next-themes` `ThemeProvider` (or change to `defaultTheme="light"`, remove `forcedTheme="dark"`)
- Add a `useEffect` at app level that reads `localStorage` and sets the class on mount

## Batch 2 — Dropdown Reorganization

### 2.1 `src/components/DashboardLayout.tsx`
- Import `useTheme` hook, `Sun`/`Moon`/`ExternalLink`/`CreditCard`/`Settings` icons, `Switch` component, `DropdownMenuSeparator`, `DropdownMenuLabel`
- Fetch restaurant `slug` alongside `id` in the existing Supabase query
- Replace dropdown content with:
  1. Header block (name + email from `user.email`) — non-clickable `DropdownMenuLabel`
  2. Separator
  3. Theme toggle row: icon + "Modo Claro"/"Modo Escuro" label + `Switch` — uses `onClick` to call `toggleTheme`, no navigation
  4. Separator
  5. "Assinatura" → navigates `/dashboard/subscription`
  6. "Configurações" → navigates `/dashboard/settings`
  7. "Ver Cardápio" → `window.open('/menu/' + slug, '_blank')`
  8. Separator
  9. "Sair" → `handleLogout`, destructive styling

## Batch 3 — Sidebar Cleanup

### 3.1 `src/components/DashboardLayout.tsx`
- Remove "WhatsApp" and "Assinatura" from `navItems` array
- Keep routes in `App.tsx` unchanged
- Final sidebar: Visão Geral, Cardápio, Cozinha (KDS), Caixa, Aparência, Configurações

## Batch 4 — Console.log Cleanup

### 4.1 `src/components/menu/PixPaymentModal.tsx`
- Wrap all 5 `console.log`/`console.error` calls with `if (import.meta.env.DEV)` guard

## Files Modified
- `src/index.css` — light/dark CSS vars
- `src/hooks/useTheme.ts` — new file
- `src/App.tsx` — remove forcedTheme dark
- `src/components/DashboardLayout.tsx` — dropdown + sidebar
- `src/components/menu/PixPaymentModal.tsx` — console.log guards

