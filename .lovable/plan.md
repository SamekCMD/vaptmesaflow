

# VAPT — Design Rehaul Completo

## Scope

Visual-only redesign of the entire dashboard and landing page. Zero logic, route, hook, or API changes. The goal is to transform the current green-themed, light-mode-default UI into a dark, coral-accented SaaS product aesthetic inspired by Linear/Vercel/Stripe.

## Design System

Replace the current emerald green (#0ea573) primary with coral (#FF5C3A). Switch to a dark-first palette with backgrounds ranging from #0A0B0F to #1C1F28. Add Geist font family for display/titles, keep Inter for body, add Geist Mono for numbers/code.

## Files to Modify

### 1. `package.json` — Add font dependencies
- Add `@fontsource/geist`, `@fontsource-variable/geist-mono` (or equivalent available packages)

### 2. `src/index.css` — Complete token overhaul
- Replace all CSS custom properties (`:root` and `.dark`) with the new dark-first design tokens from the spec
- Add custom font-face variables (`--font-display`, `--font-body`, `--font-mono`)
- Map existing Shadcn variables (`--background`, `--foreground`, `--card`, `--primary`, etc.) to the new values
- Add custom scrollbar styles
- Update utility classes (`.text-gradient`, `.hero-gradient`, `.glow`, `.card-hover`) to use coral
- Remove light mode or make it identical to dark (dark-only product)

### 3. `tailwind.config.ts` — Update font families and extend theme
- Set `fontFamily.sans` to Inter, add `fontFamily.display` for Geist, `fontFamily.mono` for Geist Mono
- Extend colors if needed for brand-coral, brand-gold tokens

### 4. `src/main.tsx` — Import font packages
- Add `import '@fontsource/geist/...'` and `import '@fontsource-variable/geist-mono'` and Inter imports

### 5. `src/components/DashboardLayout.tsx` — Sidebar + Topbar redesign
- Sidebar: width 220px, bg `var(--bg-secondary)`, border-right subtle
- Logo: "Vapt" in Geist Bold 18px with coral flame icon
- Nav links: padding 8px 12px, radius-md, 16px icons + labels
- Active state: bg-active, left 2px coral border, text-primary
- Hover: bg-hover, 150ms transition
- Plan badge: pill with coral-muted bg, coral text, Geist Mono 11px uppercase
- Topbar: 52px height, bg-primary (#0A0B0F), border-bottom subtle
- Avatar: 32px circle, bg-active, initials
- Bell with coral dot indicator

### 6. `src/pages/dashboard/Overview.tsx` — Metric cards + chart styling
- Metric cards: bg-card, border-subtle, radius-lg, shadow-card
- Labels: 11px uppercase tracking-wide, text-tertiary, Inter
- Values: 28px Geist Bold (font-display)
- Icons: 32x32 coral-muted bg with coral icon
- Period selector: pills with coral-muted active state
- Chart: bar gradient from coral to rgba(255,92,58,0.3), dashed grid lines
- Tooltip: bg-hover, border-strong, shadow-elevated
- Top items: rank in Geist Mono coral, trophy/star in gold-muted

### 7. `src/pages/dashboard/KitchenMonitor.tsx` — KDS columns
- Column headers: 11px Geist Medium uppercase, text-tertiary, pill counter
- Order cards: bg-card (dark), border-subtle, radius-lg — replace colored background timer with dark cards + colored dot/text indicator
- Timer semaphore: green dot <10min, yellow 10-20, red pulsing >20
- Action buttons: outline with coral border, coral text, hover coral-muted bg
- Ready column: opacity 0.6, subtle green border

### 8. `src/pages/dashboard/CashierPage.tsx` + `src/components/cashier/TableCard.tsx` — Table map
- Cards: aspect-ratio 1:1 implied, radius-lg
- Free: bg-card, border-subtle, number in text-tertiary
- Occupied: bg-active, border-default, number text-primary, value in coral
- Check requested: border gold 1.5px, pulse animation, bell icon gold
- Hover: scale(1.02), shadow-elevated, 150ms
- Legend: update colors to match new palette

### 9. `src/pages/dashboard/MenuManagement.tsx` — Menu item list/table
- Item rows in bg-card, border-subtle, radius-lg
- Image: 56x56, radius-md, bg-hover placeholder
- Name: 14px Geist Medium
- Category: 11px pill, bg-hover, text-secondary
- Price: 14px Geist Mono coral
- Toggle: coral when active
- Edit/delete: icon buttons 28px, hover bg-hover

### 10. `src/pages/dashboard/SubscriptionPage.tsx` — Plan cards
- Cards: bg-card, border-default, radius-xl
- Current plan: coral 1.5px border, shadow-coral
- "Mais Popular" badge: coral bg, white text, positioned above card with translateY(-50%)
- Price: 36px Geist Bold + "/mês" 14px text-secondary
- Features: green checkmark SVG, red X, 13px Inter
- CTA: coral bg, hover coral-hover, radius-md, Geist Medium 14px
- "Plano Atual" button: transparent bg, border-default, text-tertiary, disabled

### 11. `src/components/ui/button.tsx` — Global button variants
- Default variant: coral bg, white text, radius-md, hover coral-hover, active scale(0.98)
- Keep other variants but update to dark palette

### 12. `src/components/ui/card.tsx` — Global card styling
- Base: bg-card, border-subtle, shadow-card, radius-lg

### 13. `src/components/ui/input.tsx` — Input styling
- bg-secondary, border-default, radius-md
- Focus: border coral, ring coral-muted
- Placeholder: text-disabled

### 14. `src/components/ui/skeleton.tsx` — Skeleton gradient
- Animate from bg-card to bg-hover

### 15. `src/components/ui/dialog.tsx` — Modal overlay
- Overlay: rgba(0,0,0,0.7) backdrop-blur-sm
- Content: bg-card, border-default, radius-xl, shadow-elevated

### 16. Landing pages: `Hero.tsx`, `Navbar.tsx`, `Features.tsx`, `HeroDashboardMockup.tsx`, `Pricing.tsx`, `FAQ.tsx`, `Footer.tsx`, `SocialProof.tsx`
- Update all green/emerald references to coral
- Update hero gradient, badges, CTAs to coral palette
- Dashboard mockup: use new dark card backgrounds and coral accent bars

### 17. Auth pages: `LoginPage.tsx`, `SignupPage.tsx`
- Dark backgrounds, coral primary buttons, updated card styling

### 18. Other dashboard pages: `AppearancePage.tsx`, `SettingsPage.tsx`, `WhatsAppIntegration.tsx`
- Apply new card/input/button styles (mostly inherited from global component changes)

### 19. `src/components/skeletons/DashboardSkeletons.tsx`
- Update to use new palette tokens (mostly inherited)

### 20. `src/components/dashboard/TrialBanner.tsx`, `PushNotificationBanner.tsx`, `StripeCheckoutModal.tsx`
- Update accent colors from green to coral

### 21. `src/components/FeatureGate.tsx`
- Update lock icon container and text to use new palette

### 22. `src/App.css` — Remove or clean up unused legacy styles

## Implementation Strategy

Due to the massive scope (20+ files), implementation will be batched:

**Batch 1 — Foundation**: index.css tokens, tailwind.config.ts, main.tsx font imports, button.tsx, card.tsx, input.tsx, skeleton.tsx, dialog.tsx, App.css cleanup

**Batch 2 — Dashboard core**: DashboardLayout.tsx, Overview.tsx, SubscriptionPage.tsx, skeletons

**Batch 3 — Dashboard features**: KitchenMonitor.tsx, CashierPage.tsx, TableCard.tsx, MenuManagement.tsx, SettingsPage.tsx, AppearancePage.tsx, WhatsAppIntegration.tsx, FeatureGate.tsx, banners

**Batch 4 — Landing + Auth**: Hero.tsx, Navbar.tsx, Features.tsx, HeroDashboardMockup.tsx, Pricing.tsx, FAQ.tsx, Footer.tsx, SocialProof.tsx, LoginPage.tsx, SignupPage.tsx

## What will NOT change
- No routes, hooks, API calls,