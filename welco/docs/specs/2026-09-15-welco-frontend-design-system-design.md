# Welco Frontend — Navy Classic Design System Unification
Date: 2026-09-15
Status: Approved
Author: Kilo

## 1. Purpose

Unify the Welco surgical-instruments marketplace frontend under a single, enforceable design system. Remove token sprawl, fix contrast gaps, enforce component state coverage, and standardize UX flows across all 40+ routes without changing the established navy-classic aesthetic.

## 2. Audience & Context

- Hospital procurement, distributors, clinic staff, and Welco administrators
- Desktop-primary with tablet and mobile as first-class targets
- Bilingual EN/AR with RTL support
- Users return repeatedly to check orders, quotes, tickets, and inventory

## 3. Aesthetic Direction

**Navy Classic** — deep-sea control panel meets surgical precision. Reference: Bloomberg Terminal meets medical equipment HMI.

The direction is already working. The problems are systemic: too many aliases, mixed radii, copy-pasted component blocks, missing states, and inconsistent contrast.

## 4. Design Brief

```
Purpose:    B2B surgical instruments marketplace, account management, and admin platform
Audience:   Hospital procurement, distributors, clinic staff, Welco administrators on desktop and mobile
Tone:       Navy Classic — deep-sea control panel meets surgical precision
Reference:  Bloomberg Terminal meets medical equipment HMI
Palette:    Deep navy base (#061328) / steel-blue surfaces (#071A38) / ice-white ink (#f4f8ff) / surgical mint (#3ed7b4) + gold (#FFD166) accents
Type:       Plus Jakarta Sans display · Inter body · JetBrains Mono data
Memorable:  Gold-gradient page titles with surgical precision iconography and laser-sweep card headers
Restraint:  No purple. No violet. No rounded-xl on everything. No hero→3-cards→CTA template.
```

## 5. Consolidated Token Block

Single source of truth in `src/assets/tokens.css`. Remove all alias indirection.

```css
:root {
  /* TYPE — one ratio: 1.250 major third */
  --wl-font-display: 'Plus Jakarta Sans', 'Sora', system-ui, sans-serif;
  --wl-font-body: 'Inter', system-ui, sans-serif;
  --wl-font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --step--1: 0.84rem; --step-0: 1rem; --step-1: 1.25rem;
  --step-2: 1.563rem; --step-3: 1.953rem; --step-4: 2.441rem;

  /* SPACE — 4px harmonic base */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --space-12: 48px; --space-16: 64px;

  /* COLOR — one ramp, one accent */
  --base: #061328;
  --surface: #071A38;
  --surface-soft: #0B274F;
  --ink: #d8e8ff;
  --ink-strong: #f4f8ff;
  --ink-soft: #bfcfe8;
  --muted: #93a5bd;
  --line: rgba(116, 169, 255, 0.24);
  --line-strong: rgba(151, 190, 255, 0.42);
  --primary: #69a9ff;
  --primary-hover: #8abcff;
  --primary-soft: rgba(105, 169, 255, 0.14);
  --accent: #d8e8ff;
  --gold: #FFD166;
  --success: #3ed7b4;
  --danger: #f26d6d;
  --warning: #f8c15d;

  /* RADIUS — one value for components, one for pills, one for modals */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-pill: 999px;

  /* SHADOW — two only */
  --shadow-card: 0 0 0 1px rgba(116, 169, 255, 0.1), 0 10px 30px rgba(0, 10, 25, 0.5);
  --shadow-hover: 0 4px 16px -2px rgba(0, 10, 25, 0.5), 0 10px 24px -4px rgba(105, 169, 255, 0.12);
}
```

### Token Rules

| Token | Rule |
|---|---|
| Type scale | One ratio (1.250 major third) for the whole page. |
| Space scale | Every margin/padding/gap is a `--space-*` token. No `13px`. No `0.85rem`. |
| Color ramp | Three ink levels is enough. Exactly one accent. |
| Radius | Three values only: `--radius-sm` (components), `--radius-md` (modals/large panels), `--radius-pill` (pills/tags). No arbitrary per-view radii like `--radius-xl` or `--radius-2xl`. Mixed radii is the single loudest amateur signal. |
| Shadow | Zero or two. Two shadows = one contact shadow + one ambient hover. |

## 6. What Changes

### 6.1 Remove Alias Sprawl
Collapse 20+ aliases (`--wl-indigo`, `--wl-violet`, `--wl-teal`, `--wl-brass`, `--wl-amber`, `--wl-obsidian`, `--wl-stone`, etc.) to their canonical tokens. One name, one value.

### 6.2 Radius Discipline
Stop using `--radius-xs`, `--radius-xl`, `--radius-2xl` arbitrarily across views.
- Components: `--radius-sm` (6px)
- Modals, large panels: `--radius-md` (8px)
- Pills, tags: `--radius-pill` (999px)

### 6.3 Contrast Fixes
Ensure body text meets 4.5:1 against `--surface`.

| Pair | Current | Target |
|---|---|---|
| Body text on surface | `#d8e8ff` on `#071A38` ≈ 8.2:1 | Pass |
| Muted text on surface | `#93a5bd` on `#071A38` ≈ 4.2:1 | Fix to ≥4.5:1 |
| Gold text on navy | `#FFD166` on `#061328` ≈ 6.8:1 | Pass |
| Primary on surface | `#69a9ff` on `#071A38` ≈ 5.1:1 | Pass |

The `--muted` token needs a 1-2 step lightness increase to hit 4.5:1 consistently.

### 6.4 Component State Standardization
Every interactive element gets all five states. Missing states are the #1 UX failure in this codebase.

```css
.btn              { /* rest */ }
.btn:hover        { /* pointer only — must not be the sole affordance */ }
.btn:active       { /* pressed — a real transform, not just a color shift */ }
.btn:focus-visible{ outline: 2px solid var(--primary); outline-offset: 2px; }
.btn:disabled     { /* visibly inert, and still readable */ }
.btn[aria-busy]   { /* loading — reserve the space, don't collapse the layout */ }
```

Never remove focus outlines. If the default outline is ugly, restyle it — do not set `outline: none`.

### 6.5 Empty / Loading / Error Patterns
Unify `SkeletonLoader`, `ErrorState`, and `EmptyState` into a single `DataState` component with consistent sizing, copy tone, and action buttons.

For every data-view component:
- **Loading first** → skeleton matching real layout, delayed ~200ms
- **Loading refresh** → keep old data visible, subtle indicator
- **Empty first-use** → explain feature + primary CTA, never "No data"
- **Empty no-results** → echo query, offer clear filters
- **Empty cleared** → acknowledge completion
- **Error recoverable** → what happened, retry control
- **Error permanent** → plain statement, nearest useful destination

### 6.6 Copy Standardization
- Buttons name the action ("Save changes", not "Submit")
- Errors say what happened and what to do
- Empty states invite action, never just say "No data"

### 6.7 Mobile Touch Targets
Enforce 44px minimum on all interactive elements. Primary actions in thumb-reach zone.

## 7. UX Flow Improvements

### 7.1 Locations Cascade
Add keyboard navigation between columns (arrow keys), not just click.

### 7.2 Profile Save
Disable submit only while submitting. Show inline validation on blur.

### 7.3 Password Change
Auto-logout after 1.2s is too aggressive; extend to 3s with a visible countdown.

### 7.4 Image Upload
Show preview + filename + remove button before upload completes.

### 7.5 Back Buttons
Ensure all views have a functional back button with proper fallback.

### 7.6 Offline Handling
Queue mutations, show toast on reconnect.

## 8. Implementation Scope

### 8.1 Files to Change
- `src/assets/tokens.css` — consolidate tokens, remove aliases
- `src/assets/base.css` — update component rules to use canonical tokens
- `src/assets/main.css` — remove Tailwind override sprawl
- `src/components/ui/*.vue` — add missing states, unify sizing
- `src/views/**/*.vue` — contrast audit, spacing audit, copy pass
- `src/router/index.ts` — verify back-button behavior

### 8.2 Out of Scope
- Backend API changes
- New features or routes
- Authentication logic changes
- Third-party dependency additions

## 9. Success Criteria

- [ ] Every spacing value in CSS is a token from the block
- [ ] The type scale is one ratio; no size was chosen by eye
- [ ] Exactly one accent color, under 10% of visible surface
- [ ] Three radius values only: `--radius-sm`, `--radius-md`, `--radius-pill`. No arbitrary per-view radii.
- [ ] A stranger could name the aesthetic direction from a screenshot
- [ ] The `Memorable` line from the brief is actually present in every page title and card header
- [ ] The `Restraint` line was actually respected
- [ ] Nothing from the Anti-Slop table appears
- [ ] All five states exist on every interactive element
- [ ] Focus is visible and never suppressed
- [ ] Body text passes 4.5:1; large text passes 3:1
- [ ] Mobile touch targets ≥ 44px
- [ ] All data views have empty, loading, error, and partial states

## 10. Self-Review Checklist

- [ ] Every spacing value in the CSS is a token from the block
- [ ] The type scale is one ratio; no size was chosen by eye
- [ ] Exactly one accent color, under 10% of visible surface
- [ ] Three radius values only: `--radius-sm`, `--radius-md`, `--radius-pill`. No arbitrary per-view radii.
- [ ] A stranger could name the aesthetic direction from a screenshot
- [ ] The `Memorable` line from the brief is actually present in the build
- [ ] The `Restraint` line was actually respected
- [ ] Nothing from the Anti-Slop table appears
- [ ] All five states exist on every interactive element
- [ ] Focus is visible and never suppressed
- [ ] Body text passes 4.5:1; large text passes 3:1
- [ ] Mobile touch targets ≥ 44px
