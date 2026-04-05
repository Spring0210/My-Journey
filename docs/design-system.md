# MyJourney Design System
## Based on Apple Human Interface Guidelines (HIG)

This document is the single source of truth for all visual design decisions.
Every component, page, and CSS file must reference the tokens defined here
and in `frontend/src/styles/tokens.css`.

---

## 1. Design Philosophy

Apple's three core principles, applied to MyJourney:

| Principle | Meaning | How we apply it |
|---|---|---|
| **Clarity** | Content is king. UI elements exist only to serve the user. | Remove decorative elements that don't carry meaning. Every color, shadow, and border must earn its place. |
| **Deference** | The UI supports content, it never competes with it. | Neutral surfaces let the user's writing and photos be the visual focus. |
| **Depth** | Layering and motion communicate hierarchy and relationships. | Subtle shadows, translucent layers, and spring animations give the interface physical weight. |

**Additional rule for MyJourney:** The UI must feel calm and private — not loud or social-media-like. This is a journaling product; the design should invite reflection, not excitement.

---

## 2. Color System

### 2.1 Apple.com Web Colors (used for marketing pages — Landing, Auth, Legal)

These are the exact colors used on apple.com marketing pages:

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--surface-primary` | `#ffffff` | `#000000` | Page background |
| `--surface-secondary` | `#f5f5f7` | `#1d1d1f` | Section background, sidebar |
| `--surface-tertiary` | `#e8e8ed` | `#2c2c2e` | Hover state, dividers |
| `--surface-card` | `#ffffff` | `#1c1c1e` | Card background |
| `--surface-overlay` | `rgba(255,255,255,0.72)` | `rgba(28,28,30,0.72)` | Frosted overlay panels |
| `--label-primary` | `#1d1d1f` | `#f5f5f7` | Primary text (apple.com uses off-black/off-white, not pure #000) |
| `--label-secondary` | `#6e6e73` | `rgba(235,235,245,0.60)` | Secondary text |
| `--label-tertiary` | `#86868b` | `rgba(235,235,245,0.36)` | Placeholder, captions |
| `--label-quaternary` | `#aeaeb2` | `rgba(235,235,245,0.18)` | Disabled text |
| `--accent` | `#0071e3` | `#2997ff` | Interactive blue (apple.com CTAs) |
| `--accent-hover` | `#0077ed` | `#0a84ff` | Blue hover state |
| `--accent-pressed` | `#006edb` | `#007aff` | Blue pressed/active state |
| `--separator` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.12)` | Borders, dividers |
| `--separator-opaque` | `#d2d2d7` | `#38383a` | Opaque separator (for print, screenshots) |
| `--nav-bg` | `rgba(255,255,255,0.82)` | `rgba(29,29,31,0.82)` | Frosted-glass navigation bar |
| `--shadow-color` | `rgba(0,0,0,1)` | `rgba(0,0,0,1)` | Base for shadow calculations |

### 2.2 iOS System Colors (used in app pages — Journal, Spaces, etc.)

These match UIColor system colors exactly. Referenced as `--system-*`.

#### Accent / Status Colors

| Name | Light | Dark | Usage |
|---|---|---|---|
| `--system-blue` | `#007aff` | `#0a84ff` | Links, primary interactive |
| `--system-green` | `#34c759` | `#30d158` | Success, positive states |
| `--system-red` | `#ff3b30` | `#ff453a` | Destructive, errors |
| `--system-orange` | `#ff9500` | `#ff9f0a` | Warnings, highlights |
| `--system-yellow` | `#ffcc00` | `#ffd60a` | Caution, stars |
| `--system-purple` | `#af52de` | `#bf5af2` | Premium, creative |
| `--system-indigo` | `#5856d6` | `#5e5ce6` | Navigation, branding |
| `--system-pink` | `#ff2d55` | `#ff375f` | Likes, hearts |
| `--system-teal` | `#30b0c7` | `#40cbe0` | Calm, water |
| `--system-cyan` | `#32ade6` | `#64d2ff` | Sky, open |
| `--system-mint` | `#00c7be` | `#63e6e2` | Fresh, nature |
| `--system-brown` | `#a2845e` | `#ac8e68` | Earth, warmth |

#### Fill Colors (transparent tints — for chips, tags, backgrounds)

| Name | Light | Dark | Usage |
|---|---|---|---|
| `--fill-primary` | `rgba(120,120,128,0.20)` | `rgba(120,120,128,0.36)` | Standard fill |
| `--fill-secondary` | `rgba(120,120,128,0.16)` | `rgba(120,120,128,0.32)` | Secondary fill |
| `--fill-tertiary` | `rgba(118,118,128,0.12)` | `rgba(118,118,128,0.24)` | Subtle fill |
| `--fill-quaternary` | `rgba(116,116,128,0.08)` | `rgba(116,116,128,0.18)` | Very subtle fill |

#### iOS Background Colors

| Name | Light | Dark | Usage |
|---|---|---|---|
| `--bg-primary` | `#ffffff` | `#000000` | Main window background |
| `--bg-secondary` | `#f2f2f7` | `#1c1c1e` | Grouped table background |
| `--bg-tertiary` | `#ffffff` | `#2c2c2e` | Card on grouped background |

> **Note on `--surface-*` vs `--bg-*`**: Use `--surface-*` tokens for web layout
> contexts (marketing pages, auth). Use `--bg-*` tokens for app UI contexts
> (journal, spaces pages) where you want iOS-native feel.

### 2.3 Gradient Recipes

These are reusable gradient patterns, inspired directly by Apple's usage on
product pages and Apple Intelligence marketing materials.

```css
/* Hero radial glow — subtle blue halo behind hero text */
--gradient-hero-glow: radial-gradient(
  ellipse 60% 50% at 50% 20%,
  rgba(0, 113, 227, 0.10) 0%,
  rgba(175, 82, 222, 0.05) 50%,
  transparent 75%
);

/* Dark mode version */
--gradient-hero-glow-dark: radial-gradient(
  ellipse 60% 50% at 50% 20%,
  rgba(41, 151, 255, 0.14) 0%,
  rgba(191, 90, 242, 0.07) 50%,
  transparent 75%
);

/* Gradient text — blue to purple (Apple Intelligence style) */
--gradient-text-blue-purple: linear-gradient(135deg, #0071e3 0%, #af52de 100%);

/* Dark surface CTA card */
--gradient-cta-dark: linear-gradient(145deg, #1d1d1f 0%, #2c2c2e 100%);

/* Feature icon backgrounds — kept for space cards / avatar placeholders.
   Do NOT use these for landing page feature icons; see §9.2 for the
   current icon standard (soft tinted bg + colored icon). */
--gradient-icon-blue:   linear-gradient(145deg, #0071e3, #0052cc);
--gradient-icon-purple: linear-gradient(145deg, #af52de, #7c3aed);
--gradient-icon-orange: linear-gradient(145deg, #ff9500, #e07800);
--gradient-icon-green:  linear-gradient(145deg, #34c759, #1da647);
--gradient-icon-teal:   linear-gradient(145deg, #30b0c7, #1a8fa8);
--gradient-icon-pink:   linear-gradient(145deg, #ff2d55, #d4004c);
--gradient-icon-indigo: linear-gradient(145deg, #5856d6, #3634b8);
```

---

## 3. Typography

### 3.1 Font Stack

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display",
             "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
```

- Renders as **SF Pro** on Apple devices (macOS, iOS, iPadOS)
- Renders as **Segoe UI** on Windows (via system-ui)
- Falls back to **Helvetica Neue** on Linux/other
- **Never load a web font** — SF Pro's license does not permit web embedding, and system fonts render perfectly

### 3.2 Web Marketing Type Scale (apple.com)

This scale is used on landing pages, marketing sections, auth pages.

| Style | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|
| **Display** | `80px` | `700` | `1.02` | `-0.035em` | Absolute maximum hero (WWDC-scale) |
| **Hero** | `64px` | `700` | `1.05` | `-0.030em` | Standard hero title |
| **Large Title** | `48px` | `600` | `1.08` | `-0.020em` | Section heading |
| **Title 1** | `40px` | `600` | `1.10` | `-0.015em` | Page title |
| **Title 2** | `32px` | `600` | `1.13` | `-0.010em` | Card heading |
| **Title 3** | `24px` | `600` | `1.20` | `0em` | Sub-section heading |
| **Headline** | `17px` | `600` | `1.29` | `0em` | Strong body labels |
| **Body** | `17px` | `400` | `1.47` | `0em` | Standard paragraph text |
| **Callout** | `15px` | `400` | `1.40` | `0em` | Supporting text, captions |
| **Subhead** | `15px` | `600` | `1.33` | `0em` | Labels, nav items |
| **Footnote** | `13px` | `400` | `1.23` | `0em` | Legal, metadata |
| **Caption** | `12px` | `400` | `1.33` | `0em` | Timestamps, tiny labels |
| **Eyebrow** | `12px` | `600` | `—` | `+0.08em` | Section labels above titles (UPPERCASE) |

**Eyebrow label rule:** Always uppercase, accent color (`var(--accent)`), 12px, semibold, 0.08em letter-spacing. Used to label sections before a large title.

### 3.3 iOS App Type Scale (app pages: journal, spaces, etc.)

| Style | Size | Weight | Notes |
|---|---|---|---|
| Large Title | `34px` | `400` | Automatic navigation title |
| Title 1 | `28px` | `400` | Main content title |
| Title 2 | `22px` | `400` | Section title |
| Title 3 | `20px` | `400` | Sub-section |
| Headline | `17px` | `600` | Emphasized body text |
| Body | `17px` | `400` | Default reading text |
| Callout | `16px` | `400` | Secondary reading text |
| Subhead | `15px` | `400` | Supplementary text below title |
| Footnote | `13px` | `400` | Secondary labels |
| Caption 1 | `12px` | `400` | Image captions, timestamps |
| Caption 2 | `11px` | `400` | Smallest legible text |

### 3.4 Typography Rules

- **No pure black text** — use `var(--label-primary)` (`#1d1d1f` / `#f5f5f7`), never `#000000`
- **Line length** — 45–75 characters for readable body text. Max-width `692px` on text sections
- **Responsive scaling** — Hero drops from `64px` → `52px` → `40px` → `36px` across breakpoints
- **Minimum font size** — `11px` absolute minimum. Never go below `12px` for interactive elements

---

## 4. Spacing & Layout

### 4.1 Grid — 8pt Base Unit

All spacing values must be multiples of **4px**. Prefer multiples of **8px**.

```
4px   — micro gap (icon + label gap)
8px   — small gap (form field items)
12px  — medium-small gap
16px  — standard gap (list items, card padding unit)
20px  — medium gap
24px  — large gap (section gutters, card padding)
32px  — extra large gap
40px  — section inner spacing
48px  — component separation
64px  — major section padding unit
80px  — section vertical padding (tablet)
100px — section vertical padding (desktop)
```

### 4.2 Page Layout Widths

| Context | Max Width | Usage |
|---|---|---|
| Wide layout | `1100px` | Dashboard, split-panel pages |
| Standard | `980px` | Most content pages |
| Narrow | `692px` | Text-heavy pages, article-style content |
| Auth | `400px` | Login/register card width |

### 4.3 Section Vertical Padding

| Breakpoint | Padding | |
|---|---|---|
| Desktop | `100px` | ≥1069px |
| Tablet | `80px` | 769–1068px |
| Mobile | `60px` | 481–768px |
| Small mobile | `40px` | ≤480px |

### 4.4 Horizontal Gutter

```
Desktop  (≥769px):  24px padding-inline
Mobile   (≤768px):  20px padding-inline
```

---

## 5. Border Radius

| Name | Value | Usage |
|---|---|---|
| `--radius-xs` | `4px` | Tiny indicators, progress bars |
| `--radius-sm` | `8px` | Input fields, small tags, code blocks |
| `--radius-md` | `12px` | Smaller cards, chips, tooltips |
| `--radius-lg` | `18px` | Standard content cards |
| `--radius-xl` | `22px` | Large feature cards |
| `--radius-2xl` | `28px` | Hero panels, CTA cards |
| `--radius-pill` | `980px` | Buttons, badges (pill shape) |
| `--radius-full` | `50%` | Avatars, icon buttons |

**Rule:** Nested elements should have smaller radii than their container.
If a card has `--radius-lg` (18px), the images inside use `--radius-md` (12px).

---

## 6. Shadows & Elevation

Apple uses shadows very sparingly. The rule: **contrast first, shadow second**.

| Level | Light Mode Shadow | Dark Mode Shadow | Usage |
|---|---|---|---|
| **Flat** | none | none | Cards on colored backgrounds |
| **Raised** | `0 1px 3px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.06)` | `0 1px 3px rgba(0,0,0,0.20), 0 2px 12px rgba(0,0,0,0.30)` | Cards on white/primary bg |
| **Elevated** | `0 2px 8px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.10)` | `0 2px 8px rgba(0,0,0,0.40), 0 4px 24px rgba(0,0,0,0.50)` | Dropdowns, popovers |
| **Floating** | `0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)` | `0 8px 32px rgba(0,0,0,0.60), 0 2px 8px rgba(0,0,0,0.30)` | Modals, sheets |
| **Hero image** | `0 24px 80px rgba(0,0,0,0.16), 0 4px 20px rgba(0,0,0,0.08)` | same | Product screenshots |

**Token names:** `--shadow-flat`, `--shadow-raised`, `--shadow-elevated`, `--shadow-floating`

---

## 7. Motion & Animation

Apple's motion is purposeful — it explains relationships, not just decoration.

| Type | Duration | Easing | Usage |
|---|---|---|---|
| Micro | `150ms` | `ease` | Hover, focus ring, color changes |
| Standard | `200ms` | `ease` | Button press, toggle, tab switch |
| Enter/Spring | `250ms` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Modal open, sheet present, drawer open |
| Exit | `180ms` | `ease-in` | Modal close, sheet dismiss |
| Page | `350ms` | `ease-out` | Page transitions |
| Parallax | tied to scroll | — | Hero imagery (apple.com product pages) |

**Rules:**
- Never animate `background-color` or `color` on `body` — only on specific elements
- `transform` and `opacity` only — never animate `width`, `height`, or `margin` for performance
- All animations must respect `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Components

### 8.1 Navigation Bar

```
Height:            52px (web), 44px (iOS native)
Position:          sticky top: 0; z-index: 100
Background:        var(--nav-bg)  +  backdrop-filter: saturate(180%) blur(20px)
Bottom border:     1px solid var(--separator)
Logo font:         18px / 700 / -0.02em tracking
Nav links:         14px / 400 / color: var(--label-secondary) / hover: opacity 0.8
```

### 8.2 Sidebar (App)

```
Width (desktop):   260px
Background:        var(--surface-secondary)
Right border:      1px solid var(--separator)
Nav item padding:  9px 12px
Nav item radius:   10px
Nav item font:     15px / 400 / color: var(--label-secondary)
Active state bg:   color-mix(in srgb, var(--accent) 12%, transparent)
Active state text: var(--accent)
Active weight:     600
Section label:     11px / 600 / uppercase / 0.06em tracking / var(--label-tertiary)
```

### 8.3 Buttons

| Variant | Background | Text | Border | Padding | Font |
|---|---|---|---|---|---|
| Primary | `var(--accent)` | `#ffffff` | `1px solid transparent` | `12px 22px` | `15px / 500` |
| Primary Large | `var(--accent)` | `#ffffff` | `1px solid transparent` | `14px 28px` | `17px / 500` |
| Secondary / Ghost | `var(--surface-secondary)` | `var(--label-primary)` | `1px solid var(--separator)` | `12px 22px` | `15px / 400` |
| Destructive | `color-mix(in srgb, var(--system-red) 10%, transparent)` | `var(--system-red)` | `1px solid color-mix(in srgb, var(--system-red) 25%, transparent)` | `12px 22px` | `15px / 400` |
| Text link | `transparent` | `var(--accent)` | none | `0` | inherits |

**Rules:**
- All buttons: `border-radius: var(--radius-pill)` (pill shape)
- Hover state: `background` transitions to slightly darker shade
- Active state: `transform: scale(0.97)`
- Disabled state: `opacity: 0.50; cursor: not-allowed`
- Side-by-side buttons: must use `border: 1px solid transparent` on the borderless one to match height with bordered sibling

### 8.4 Input Fields

```
Height:         44px (minimum tap target — required by Apple HIG)
Padding:        0 12px
Border:         1px solid var(--separator)
Border radius:  var(--radius-sm) = 8px
Font:           15px / 400 / var(--label-primary)
Background:     var(--surface-primary) or var(--surface-card)
Placeholder:    var(--label-tertiary)
Focus border:   var(--accent)  (do not use box-shadow ring)
Error border:   var(--system-red)
```

### 8.5 Cards

| Type | Radius | Shadow | Border | Padding |
|---|---|---|---|---|
| Standard content | `var(--radius-lg)` = 18px | `var(--shadow-raised)` | `1px solid var(--separator)` | `24px` |
| Feature / large | `var(--radius-xl)` = 22px | `var(--shadow-raised)` | `1px solid var(--separator)` | `32-36px` |
| Inline / compact | `var(--radius-md)` = 12px | none | `1px solid var(--separator)` | `16px` |
| CTA dark card | `var(--radius-2xl)` = 28px | none | none | `80px 40px` |

**Card border rule:** All cards must have `border: 1px solid var(--separator)`.
This ensures visibility in both light mode (subtle) and dark mode (necessary for card/bg contrast).

### 8.6 Modals & Overlays

```
Overlay:        rgba(0, 0, 0, 0.45) — not pure black
Modal card:     var(--surface-card), var(--radius-xl), var(--shadow-floating)
Max width:      560px
Padding:        32px
Animation in:   translateY(12px) → translateY(0), 220ms ease-out  (no scale, no opacity change — avoids dizzy effect)
Animation out:  translateY(0) → translateY(12px), 180ms ease-in
Close button:   32px circle, var(--surface-secondary), var(--label-secondary)
```

**Mobile rule (≤768px): always use a bottom sheet instead of a centered modal.**

iOS HIG and Material Design both mandate this. Centered modals on small screens are
awkward — buttons are near the edge and the modal feels cramped. Bottom sheets slide
up from the thumb zone and feel native.

Implementation pattern:

```css
@media (max-width: 768px) {
  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }
  .modal {
    max-width: 100%;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    border-bottom: none;
    max-height: 85vh;
    padding-bottom: 36px;          /* safe-area clearance */
    animation: sheet-in 280ms ease-out;
  }
  /* Drag handle */
  .modal::before {
    content: '';
    display: block;
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--fill-secondary);
    margin: 12px auto 20px;
  }
}
@keyframes sheet-in {
  from { transform: translateY(24px); }
  to   { transform: translateY(0); }
}
```

### 8.7 Glassmorphism

Used for: nav bar, floating panels, iOS-style overlays.

```css
background: var(--nav-bg);  /* rgba with alpha */
backdrop-filter: saturate(180%) blur(20px);
-webkit-backdrop-filter: saturate(180%) blur(20px);
```

Do NOT use glassmorphism on cards that sit on top of other cards — the effect
requires a colorful background to be visible and meaningful.

---

## 9. Apple.com Marketing Patterns

### 9.1 Hero Section

```
Padding top:       120–140px desktop, 80px tablet, 64px mobile
Text alignment:    center (product pages) or left (editorial)
Title style:       Hero (64px) or Display (80px) for major campaigns
Subtitle:          21px / 400 / var(--label-secondary) / max-width: 560px
Background trick:  Radial gradient glow centered behind text
Image treatment:   Screenshot floats below text, fades into next section
```

### 9.2 Feature Grid (Bento)

Apple's feature tiles can be:
- **2×2 symmetric grid** — four equal feature cards
- **Asymmetric bento** — one wide card (2 cols) + two narrow cards, or 1 tall + 2 stacked

Feature card anatomy:
1. **Icon** — 56px square, 16px radius. Use the **soft tinted icon** pattern (see below).
2. **Title** — 21px / 600 / var(--label-primary)
3. **Description** — 15px / 400 / var(--label-secondary) / 1.60 line-height

#### Icon standard — soft tinted background (current)

Do **not** use solid gradient backgrounds with white icons (`--gradient-icon-*`).
Use a soft `color-mix` tint so the icon adapts naturally to dark and light mode:

```css
/* Light mode */
.icon-container--blue {
  background: color-mix(in srgb, #0071e3 10%, var(--surface-card));
  color: #0071e3;
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
}

/* Dark mode override — lighter color for contrast on dark surface */
[data-theme="dark"] .icon-container--blue {
  background: color-mix(in srgb, #2997ff 14%, var(--surface-card));
  color: #2997ff;
}
```

Color pairs (light → dark):

| Name   | Light color | Dark color |
|--------|-------------|------------|
| Blue   | `#0071e3`   | `#2997ff`  |
| Purple | `#af52de`   | `#bf5af2`  |
| Orange | `#ff9500`   | `#ff9f0a`  |
| Green  | `#34c759`   | `#30d158`  |
| Teal   | `#30b0c7`   | `#40cbe0`  |
| Pink   | `#ff2d55`   | `#ff375f`  |
| Indigo | `#5856d6`   | `#5e5ce6`  |

The `--gradient-icon-*` tokens remain available for contexts that need a solid colored
background (e.g. space cover placeholders, avatar initials), but **not** for feature icons.

### 9.3 "Dark CTA" Section

Apple frequently ends a page with a dark panel:
- Background: `linear-gradient(145deg, #1d1d1f, #2c2c2e)`
- Subtle radial glow inside: `rgba(0,113,227,0.20)` centered
- Title: white (`#f5f5f7`), 52px, 700 weight
- Button: white background, dark text (inverted from the standard CTA)

### 9.4 Eyebrow + Title Pattern

```
<p class="eyebrow">Features</p>          12px / 600 / uppercase / accent color
<h2 class="section-title">Everything    48–52px / 600 / label-primary
you need</h2>
```

The eyebrow sits 16px above the title. The title has tight letter-spacing
(`-0.02em` or tighter). This pattern is used on virtually every apple.com section.

### 9.5 AI / Chat Visualization

For AI features, Apple shows product screenshots. Since we don't have those,
show a live "chat bubble" mockup:
- User bubble: accent background, white text, right-aligned, `border-radius: 18px 18px 4px 18px`
- AI response bubble: surface-secondary, border, left-aligned, `border-radius: 18px 18px 18px 4px`

---

## 10. Responsive Breakpoints

| Name | Width | Changes |
|---|---|---|
| Desktop | ≥1069px | Full sidebar, 3-col grids, 100px section padding |
| Tablet | 769–1068px | 2-col grids, 80px section padding |
| Mobile | 481–768px | 1-col, sidebar collapses to drawer, 60px padding |
| Small mobile | ≤480px | Tighter typography scale, 40px padding |
| iPhone viewport | `390px` | Must test every new component at this width |

---

## 11. Dark / Light Mode

- Both modes required on every page from day one
- Theme applied via `data-theme="dark"` on `<html>` element
- User preference stored in `localStorage` as `"theme": "light" | "dark"`
- Falls back to `prefers-color-scheme` if no stored preference
- **Never hardcode hex colors** — always use a CSS variable
- Test dark mode for every component before marking it done

**Common dark mode mistakes to avoid:**
1. `surface-card` same as `surface-secondary` (cards disappear) → fix with `border: 1px solid var(--separator)` on all cards
2. Shadow too light in dark mode → use separate dark shadow tokens
3. Gradient text invisible in dark mode → test gradient against dark background
4. Image screenshots with white BG look wrong in dark mode → use PNG with transparency or adjust

---

## 12. Accessibility

- Minimum tap/click target: **44×44px**
- Color contrast: **WCAG AA** minimum (4.5:1 for body text, 3:1 for large text)
- All interactive elements must have visible focus state
- `aria-label` required on icon-only buttons
- Do not convey information with color alone
- System blue (`#0071e3`) on white: contrast ratio 4.51:1 — just passes AA

---

## 13. Legal & Branding

- Product name: **MyJourney** (one word, no space)
- Domain: `myjourneycloud.com`
- Contact: **Spring**
- Copyright line: `Copyright © 2026 Ben X. All rights reserved.`
- Footer must appear on every page with links to `/privacy` and `/terms`
- No emoji in any UI text or code
- Languages: English and Chinese only — never Korean or other languages

---

## 14. File Reference

| File | Purpose |
|---|---|
| `frontend/src/styles/tokens.css` | **Single source of truth** — all CSS variables |
| `frontend/src/pages/LandingPage.css` | Landing page styles |
| `frontend/src/pages/auth/Auth.css` | Auth pages (Login, Register, Forgot Password) |
| `frontend/src/pages/journal/JournalList.css` | Journal list page |
| `frontend/src/pages/journal/JournalDetail.css` | Journal create/edit page |
| `frontend/src/pages/journal/Calendar.css` | Calendar page |
| `docs/design-system.md` | This file — design specification |
| `docs/roadmap.md` | Feature roadmap |
| `docs/conventions.md` | Code conventions |
