

# Visual Redesign: Dark Sage Minimal Identity

Complete visual overhaul of the Vapt platform. No logic, routes, queries, or data changes — only CSS tokens, Tailwind config, component styles, and typography.

## Scope Summary

~20 files across 5 batches. Replace the green/coral HSL-based identity with a dark near-black base + sage accent system using hex values. Switch fonts from Inter to DM Sans/DM Mono.

---

## Batch 1 — Foundation (Tokens + CSS)

### 1.1 Create `src/lib/design-tokens.ts`
New file with the full token object as specified (bg, border, text, sage, status, font, radius, shadow).

### 1.2 Rewrite `src/index.css`
- Replace Google Fonts import: DM Sans + DM Mono instead of Inter + Nunito
- Remove both `:root` and `.dark` blocks. Replace with a single `:root` block using hex values directly (no HSL conversion needed since shadcn vars will be set as hex-compatible values)
- Key shadcn overrides: `--background: 0 0% 5%` (converted from #0C0C0E), `--primary: 153 13% 55%` (from #7D9E8C), etc. — all CSS custom properties converted to HSL format for shadcn compatibility
- Remove `.dark` class block entirely (always dark)
- Replace utility classes: `.text-gradient` → sage-based subtle gradient, `.hero-gradient` → #0C0C0E to #111114, `.card-hover` → border-color transition only (no translateY/colored shadow), `.glow` → removed or replaced with subtle dark shadow
- Add scrollbar, selection, and `.mono` utility styles
- Body: `font-family: 'DM Sans'`, `font-size: 14px`, `line-height: 1.6`

### 1.3 Update `tailwind.config.ts`
- Change `fontFamily.sans` to `['DM Sans', 'system-ui', 'sans-serif']`
- Add `fontFamily.mono: ['DM Mono', 'monospace']`
- Update `--radius` to `6px`
- Remove `hero`, `surface`, `badge-*` custom colors (replaced by direct hex usage in components)
- Keep shadcn color structure but values will come from updated CSS vars
- Update animation keyframes: remove bounce effects, keep fade-in at 150ms ease

### 1.4 Remove `src/App.css`
Unused legacy styles (Vite boilerplate). No component imports it.

---

## Batch 2 — Shadcn Base Components

### 2.1 `button.tsx`
Update `buttonVariants`:
- **default**: bg `#7D9E8C`, text `#0C0C0E`, hover `#9AB5A6`, rounded-md (6px), font-medium, transition 150ms
- **outline** (secondary): transparent bg, border `#2E2E34`, text `#F2F2F0`, hover bg `#17171B`, hover border sage
- **ghost**: transparent, text `#8A8A8E`, hover bg `#17171B` + text `#F2F2F0`
- **destructive**: bg `#2A1818`, text `#C97B7B`, border `#3D2626`, hover bg `#3D2626`
- Remove `link` variant or keep minimal

### 2.2 `card.tsx`
- bg `#111114`, border `#222226`, rounded-lg (8px), no shadow
- Hover: border-color `#2E2E34` with 150ms transition

### 2.3 `input.tsx`
- bg `#17171B`, border `#222226`, text `#F2F2F0`, placeholder `#555558`
- Focus: border `#7D9E8C`, ring `rgba(125,158,140,0.15)`, no outline
- Height 36px (h-9), rounded-md (6px), text-sm (14px)

### 2.4 `badge.tsx`
- Reduce default sizing: text-[11px], uppercase, tracking-[0.06em], font-medium, rounded-sm (4px), px-2 py-0.5
- **default** (success/active): bg `#1A2E26`, text `#7DBF9E`, border `#2A4A3A`
- **secondary** (pending): bg `#2A2318`, text `#C9A84C`, border `#3D3220`
- **outline**: keep as-is but match border color
- Add `info` variant: bg `#181E2A`, text `#7B9BC9`, border `#26303D`

### 2.5 `select.tsx`
- Match input styling: bg `#17171B`, border `#222226`, focus border sage
- Dropdown content: bg `#1E1E23`, border `#222226`

### 2.6 `dialog.tsx`
- Overlay: bg `#0C0C0E/80` with backdrop-blur
- Content: bg `#1E1E23`, border `#222226`, rounded-lg (8px)

### 2.7 `label.tsx`
- text-xs (11px when used as caption) or text-sm, font-medium, color from `--text-secondary`

---

## Batch 3 — Layout (Sidebar, Header, DashboardLayout)

### 3.1 `DashboardLayout.tsx`
**Sidebar:**
- bg `#0C0C0E`, border-right `#222226`, width 220px (w-[220px] instead of w-64)
- Logo "Vapt": DM Sans weight-600, color `#F2F2F0`, no gradient
- Nav items: text-[13px], color `#8A8A8E`, px-3 py-2, rounded-md (6px)
- Active: bg `#17171B`, text `#F2F2F0`, border-left 2px solid `#7D9E8C`
- Hover: bg `#111114`, text `#F2F2F0`
- Icons: h-4 w-4 (16px), stroke-width inherited
- Plan badge at bottom: use new badge status styles

**Header:**
- bg `#0C0C0E`, border-bottom `#222226`, h-[52px]
- Title: text-sm font-medium
- Avatar: bg `#17171B` (remove primary tint)

**Main content area:**
- bg `#0C0C0E`
- Padding kept but ensure 24px+ spacing between sections

### 3.2 `TrialBanner.tsx`
- Use status token colors instead of HSL-based primary/warning/destructive tints

### 3.3 `PushNotificationBanner.tsx`
- Match new dark styling

---

## Batch 4 — Pages

### 4.1 Dashboard Overview (`Overview.tsx`)
- H1: text-xl font-semibold (not text-2xl font-bold), tracking-tight
- KPI cards: label as uppercase 11px `#555558`, value in `font-mono text-[28px] font-medium`, sub text `#8A8A8E`
- Period selector: bg `#111114`, active bg `#17171B`
- Chart: bar fill `#7D9E8C`, grid stroke `#222226`, tooltip bg `#1E1E23`
- Top items: badge ranking circles match new badge style

### 4.2 Kitchen Monitor (`KitchenMonitor.tsx`)
- Column status dots: use sage/status token colors instead of Tailwind emerald/yellow/blue/green
- KDS cards: remove the colored background timer system — use dark cards with subtle border color changes for urgency
- Timer badge: mono font, status-colored text only

### 4.3 Cashier (`CashierPage.tsx`)
- Table cards: free = border `#222226`, occupied = border sage-dim `#4A6358`, check_requested = border `#C9A84C` with subtle pulse
- Remove colored bg tints on table cards

### 4.4 Menu Management (`MenuManagement.tsx`)
- Table rows: border-bottom `#222226`, hover bg `#111114`
- No zebra striping
- Price column: font-mono

### 4.5 Settings + Appearance + WhatsApp + Subscription pages
- Apply consistent heading hierarchy (h1: 20px/600, h2: 14px/500)
- Cards with new token styling
- Remove colored icon backgrounds (bg-primary/10) — use `#17171B` instead

### 4.6 Landing pages (Navbar, Hero, Features, SocialProof, FAQ, Footer, Pricing, HeroDashboardMockup)
- Navbar: bg `#0C0C0E`, "Vapt" in `#F2F2F0` (no gradient), links in `#8A8A8E`
- Hero: bg gradient `#0C0C0E` → `#111114`, CTA button sage, sub-text `#8A8A8E`
- Features: card bg `#111114`, icon containers bg `#1A2E26` (sage-subtle), icon color `#7D9E8C`
- Pricing cards: highlighted card border sage `#4A6358`, "Mais Popular" badge sage
- Social proof: stars in `#C9A84C` (warning), cards bg `#111114`
- FAQ: accordion bg `#111114`
- Footer: bg `#0C0C0E`
- HeroDashboardMockup: update all white/5 → `#111114`, bars → sage gradient
- Remove `text-gradient` usage → plain `#F2F2F0` or sage `#7D9E8C`

### 4.7 Auth pages (Login, Signup)
- bg `#0C0C0E`, card bg `#111114`
- "Vapt" title: plain `#F2F2F0` font-semibold (no gradient)

### 4.8 Onboarding
- Same dark treatment, progress bar sage

### 4.9 PricingPage (standalone)
- Remove hero-gradient header, use `#0C0C0E` with border
- Remove `.glow` and `.card-hover`

### 4.10 NotFound
- bg `#0C0C0E`

---

## Batch 5 — Polish

### 5.1 `FeatureGate.tsx`
- Lock icon container: bg `#17171B`
- Blur overlay: `#0C0C0E/80`

### 5.2 Skeletons (`DashboardSkeletons.tsx`)
- Skeleton bg `#17171B` (inherits from muted token)

### 5.3 ThemeProvider
- In `App.tsx`, change `defaultTheme="dark"` — remove `enableSystem` to enforce single dark theme, or keep as-is since we removed the `.dark` CSS block and made `:root` the dark theme

### 5.4 Review all remaining files for:
- Any remaining `text-gradient` class → replace with plain text or sage
- Any `glow` class → remove
- Any `hero-gradient` → replace with `bg-[#0C0C0E]` or inline gradient
- Any `card-hover` → replace with `transition-colors duration-150` + hover:border
- Border radius > 12px (except phone mockup preview)
- Colored shadows → black-only shadows
- Missing mono font on monetary values and IDs
- Icon sizing consistency (16px, strokeWidth 1.5)

---

## Files Modified (total ~25)

**New:** `src/lib/design-tokens.ts`
**Deleted:** `src/App.css`
**Modified:** `src/index.css`, `tailwind.config.ts`, `button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`, `select.tsx`, `dialog.tsx`, `DashboardLayout.tsx`, `TrialBanner.tsx`, `Overview.tsx`, `KitchenMonitor.tsx`, `CashierPage.tsx`, `MenuManagement.tsx`, `SettingsPage.tsx`, `AppearancePage.tsx`, `WhatsAppIntegration.tsx`, `SubscriptionPage.tsx`, `Navbar.tsx`, `Hero.tsx`, `Features.tsx`, `SocialProof.tsx`, `FAQ.tsx`, `Footer.tsx`, `Pricing.tsx`, `HeroDashboardMockup.tsx`, `LoginPage.tsx`, `SignupPage.tsx`, `OnboardingPage.tsx`, `PricingPage.tsx`, `NotFound.tsx`, `FeatureGate.tsx`, `TableCard.tsx`, `App.tsx`

