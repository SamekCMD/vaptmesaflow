# Landing Page Redesign Design

Date: 2026-04-03
Scope: marketing landing page only
Primary goal: build trust first, then convert
Target users: donos de restaurantes, padarias e hamburguerias brasileiros
Brand direction: profissional e minimalista, com mais energia operacional

## Objective

Redesign the landing page so it communicates that Vapt is a credible operational system for restaurant service, not a generic SaaS dashboard. The page should feel more alive, clearer, and more trustworthy without becoming noisy or playful in the wrong way.

The landing page should answer three questions quickly:

1. Does this actually help me run service better?
2. Does it look reliable enough to trust with my operation?
3. Is it straightforward to start?

## Constraints

- This redesign is limited to the public landing page at the index route.
- It should preserve the current overall product identity and color system rather than rebrand the product.
- Motion must support clarity and trust, not spectacle.
- `prefers-reduced-motion` must be respected.
- The current pricing structure stays intact.
- The Cardápio management area is explicitly out of scope for this phase.
- Existing mojibake and encoding issues in landing files should be corrected as part of implementation where touched.

## Audience and Mental State

Primary users arriving on the landing page are restaurant owners and operators evaluating whether the product can reduce service friction. They are likely busy, skeptical, and scanning for concrete proof rather than broad promises.

This means the page should prioritize:

- believable product behavior
- operational language
- evidence of clarity and control
- fast comprehension

It should avoid:

- vague startup language
- decorative motion without meaning
- overly abstract feature copy
- dashboards that look fake or generic

## Design Direction

The chosen visual direction is `A. Cockpit operacional`.

This direction keeps a split hero layout, but the product mockup becomes a believable service-state cockpit instead of a static admin screenshot. The emotional target is operational energy: the interface should feel active, current, and under control.

The page should look:

- more alive than the current version
- more specific to restaurant operations
- more premium in execution
- still restrained enough to feel dependable

## Information Architecture

The landing page should be structured in this order:

1. Navbar
2. Hero
3. Operational feature story
4. Social proof
5. Pricing
6. FAQ
7. Footer

This preserves the current page skeleton while changing the character and function of each section.

## Hero Design

### Layout

The hero remains two columns on desktop:

- left: headline, supporting copy, CTAs, trust cues
- right: animated operational cockpit

On mobile, the copy should appear first and the cockpit should follow immediately below it.

### Copy Strategy

The hero headline should emphasize operational control during service, not abstract automation. The supporting paragraph should clearly state the product categories without sounding feature-dumpy.

The trust cues below the CTAs should shift away from generic SaaS reassurance and toward operational reassurance. For example, they should signal live order flow, kitchen visibility, and aligned service.

### Product Mockup

The right-side mockup should show a believable operating snapshot:

- three small top metrics
- a compact revenue chart
- a recent-orders or live-status module
- clear restaurant-specific statuses such as `Preparando`, `Na fila`, and `Pronto`

The mockup should feel like one integrated surface, not a collage of generic cards.

## Motion Strategy

### Principle

Motion should make the product feel active and responsive. It should not call attention to itself.

### Hero Motion

Hero motion is the strongest on the page and should include:

- staggered entrance of eyebrow, headline, paragraph, CTAs, and trust cues
- slightly delayed reveal of the cockpit
- subtle autonomous cockpit activity after load:
  - chart bars settling in
  - one or two status pulses
  - small metric-value emphasis

This motion should loop gently or settle into a calm resting state. Nothing should bounce or look game-like.

### Section Motion

Below the fold:

- feature blocks should reveal on scroll with short fade/translate transitions
- product snippets inside features can have small state transitions
- pricing should use restrained hover and CTA feedback only
- FAQ should use short, smooth expand/collapse motion

### Reduced Motion

Under reduced-motion preferences:

- entrance choreography becomes instant or near-instant
- cockpit autonomous movement becomes static
- hover motion should reduce to color/contrast shifts

## Delight Strategy

Delight should be used sparingly and professionally.

Appropriate delight moments:

- refined CTA hover/press feedback
- subtle status pulses in the hero cockpit
- smoother section transitions
- satisfying FAQ accordion behavior

Inappropriate delight moments:

- jokes in core copy
- celebratory effects
- exaggerated hover transforms
- novelty interactions that delay comprehension

## Section-by-Section Design

### Navbar

Keep the current functional structure, but align spacing and visual weight with the new hero. Motion should be minimal: clean hover states and a subtle button response.

### Operational Feature Story

Replace or rework the current feature presentation into operational blocks:

- Cardápio e mesas
- Cozinha
- Caixa
- Gestão

Each block should include:

- a concrete operational title
- one short explanatory paragraph
- one visual snippet or UI cue
- one outcome-focused line that says why it matters

This section should feel like an explanation of how the system supports service, not a generic feature catalog.

### Social Proof

Social proof should become more concrete and operational. It should validate that real businesses benefit from clearer service flow, faster team coordination, or better visibility.

If the current content is too generic, implementation may reframe the layout and copy while keeping the same testimonial source data.

### Pricing

Pricing keeps the current plan structure and current plan-card hierarchy. The redesign work here is stylistic and interaction-focused:

- stronger consistency with the new landing system
- stable typography and encoding
- restrained hover polish
- clearer recommended-plan emphasis

Pricing should feel reliable, not animated for its own sake.

### FAQ

FAQ should be simplified visually and made easier to scan. Accordion motion should support reading and reduce abrupt layout changes.

## Component Boundaries

Likely implementation targets:

- `src/pages/Index.tsx`
- `src/components/landing/Navbar.tsx`
- `src/components/landing/Hero.tsx`
- `src/components/landing/HeroDashboardMockup.tsx`
- `src/components/landing/Features.tsx`
- `src/components/landing/SocialProof.tsx`
- `src/components/landing/Pricing.tsx`
- `src/components/landing/FAQ.tsx`
- `src/index.css`

The preferred approach is to preserve the current page composition and refactor section internals rather than rebuild the landing page into one large component.

## Implementation Notes

- Fix encoding issues in any touched landing component before or during redesign work.
- Reuse the existing Tailwind and shadcn patterns where possible.
- Keep motion primarily in Framer Motion where it already exists, unless CSS transitions are simpler and more appropriate.
- Avoid introducing heavy animation dependencies.
- Keep the landing performant on mobile.

## Testing and Verification

Implementation will be considered successful when:

- hero communicates operational clarity in 2 to 3 seconds
- the page feels more energetic without feeling noisy
- text renders correctly in Portuguese throughout touched areas
- motion is smooth and non-blocking
- reduced-motion behavior works
- layout remains clean across desktop and mobile
- CTA hierarchy remains obvious

Verification should include:

- local visual review on desktop and mobile widths
- build verification
- targeted reduced-motion check in browser dev tools
- manual scan for contrast, spacing, and text rendering regressions

## Out of Scope

- dashboard redesign beyond existing work
- Cardápio management implementation changes
- pricing/business logic changes
- full copywriting overhaul for every marketing section
- rebranding the visual identity

## Recommendation

Implement the redesign as a focused landing-page pass with the hero and feature-story sections carrying most of the visual and motion change. Keep pricing and FAQ calmer. This provides the highest impact without turning the project into a full marketing-site rewrite.
