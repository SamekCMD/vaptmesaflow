

# Public Menu Visual Rehaul

Redesign the public menu page (`PublicMenu.tsx`) to match the specified dark, minimal, sharp aesthetic. Zero logic changes — only layout structure, classes, and inline styles.

## Current State

The page currently has:
- A colored header banner with centered logo (circle) and restaurant name
- A "Chef Suggestion" card section
- Horizontal category pills (rounded-full)
- List-style menu items (horizontal card with image + text side by side)
- A floating "Ver Pedido" button
- A bottom nav with Menu / Meus Pedidos / Tema toggle

## Changes

### 1. Header → Fixed top bar (60px)
- Replace the colored banner with a fixed top bar: `bg-[#0C0C0E]/95 backdrop-blur-[12px]`, border-bottom `rgba(255,255,255,0.06)`, h-[60px], px-4, flex items-center
- Logo: 36x36, rounded-lg (8px, not circle), object-cover. Fallback: initials with `primaryColor` at 20% opacity bg
- Restaurant name: text-sm font-semibold text-[#F2F2F0], truncate
- Mesa badge: ml-auto, text-[11px] uppercase tracking-[0.06em] font-medium, bg `rgba(255,255,255,0.06)`, border `rgba(255,255,255,0.1)`, rounded-md, px-2.5 py-1, text `rgba(255,255,255,0.5)`

### 2. Categories → Sticky below header, sharp pills
- Sticky top-[60px], bg-[#0C0C0E], border-bottom `rgba(255,255,255,0.06)`, py-2.5 px-4, flex gap-2, overflow-x-auto scrollbar-none
- Inactive pill: bg `rgba(255,255,255,0.04)`, border `rgba(255,255,255,0.08)`, rounded-md (6px), px-3.5 py-1.5, text-[13px], text `rgba(255,255,255,0.45)`
- Active pill: bg `primaryColor/15`, border `primaryColor/40`, text primaryColor, font-medium

### 3. Menu Items → 2-column grid cards
- Replace the list layout with `grid grid-cols-2 gap-3`, px-4 pt-4 pb-20
- Each card: bg `rgba(255,255,255,0.03)`, border `rgba(255,255,255,0.07)`, rounded-[10px], overflow-hidden, flex-col, cursor-pointer
- Image: aspect-[4/3], object-cover, w-full. No image: bg `rgba(255,255,255,0.04)` with UtensilsCrossed icon centered at `rgba(255,255,255,0.15)`
- Content area: p-2.5, name text-[13px] font-medium line-clamp-2 text `rgba(255,255,255,0.9)`, description text-[11px] text `rgba(255,255,255,0.35)` line-clamp-1
- Bottom row: flex justify-between items-center mt-2, price in font-mono text-sm font-medium primaryColor, "+" button 28x28 rounded-md bg `primaryColor/15` border `primaryColor/30` text primaryColor
- Unavailable: image overlay with dark opacity, "Indisponível" badge, name/price at opacity-40, no + button
- Remove the "Adicionar" text button, chef suggestion section, and badge chips (destaque/promoção/novo) from the grid cards — keep logic but simplify visual

### 4. Bottom bar → Fixed, 64px, tab-based
- h-16, bg-[#0C0C0E]/96 backdrop-blur-[16px], border-top `rgba(255,255,255,0.06)`, pb-[env(safe-area-inset-bottom)]
- Remove theme toggle tab entirely (force dark on public menu)
- Tabs: Menu, Meus Pedidos (keep existing click handlers)
- Inactive: icon+label `rgba(255,255,255,0.3)`, active: primaryColor
- Icons: h-5 w-5 strokeWidth 1.5, label text-[10px] tracking-[0.04em]
- Cart badge: absolute, 16x16 rounded-full bg primaryColor, text-[10px] font-semibold text-black

### 5. Floating cart button
- Keep position and logic, update to max-w-md centered, rounded-[10px]

### 6. QR Code / Error screens
- Match dark bg `#0C0C0E`

## Files Modified
- `src/pages/menu/PublicMenu.tsx` — all visual changes above

No other files changed. No logic, state, queries, or component props altered.

