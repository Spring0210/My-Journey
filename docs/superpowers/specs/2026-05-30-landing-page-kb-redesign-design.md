# Landing Page Redesign — Knowledge Base + AI Reach

**Date:** 2026-05-30
**Status:** Approved
**Scope:** `frontend/src/pages/LandingPage.tsx` + `frontend/src/pages/LandingPage.css`

## Goal

Reframe the landing page from the legacy personal-journaling story to the
current product: an AI-native personal and team knowledge base where every
document is reachable by an AI agent — in the app, or from the user's own
tools (Claude Desktop, Cursor) over MCP.

## Decisions (from brainstorm)

- **Audience:** product / end-users. Sign-up is the primary goal. Minimal jargon.
- **Identity:** full knowledge-base pivot. Drop all "journal" language.
- **Featured value props:** all four — AI agent reach (MCP), personal + team
  spaces, in-app AI chat, write & organize docs.
- **Hero visual:** direction A — a macOS-style window showing a Team Space
  (document list) with the AI answering on the right and citing the document
  it read. "Grounded answers."
- **Visual system:** reuse the existing Apple-HIG tokens, pill buttons, frosted
  cards, and scroll fade-up hooks. No new design language.

## Page structure

1. **Hero**
   - Eyebrow: `KNOWLEDGE BASE · AI-NATIVE`
   - Headline: "The knowledge base **your AI** can actually use." (gradient on
     "your AI")
   - Sub: write/organize what your team knows; let any AI agent read, search,
     and write it back.
   - Actions: `Get started free` (primary) + `Sign in` (ghost) — unchanged.
   - Visual: new `HeroMockup` (direction A) — window with a doc-list sidebar and
     an AI exchange that cites a document. Floating badges: "AI cited 3 docs"
     and "Synced to Claude Desktop".

2. **Features — 2×2 grid**
   - Personal + team spaces (blue)
   - Write & organize docs (green)
   - In-app AI chat (orange)
   - AI agent reach (purple)

3. **"Bring your own AI" / MCP section** (replaces old AI-search demo)
   - Left: three points — connect any MCP client; read & write securely with
     scoped `mj_` tokens (audited); one toolset across every surface.
   - Right: visual panel showing the one-paste MCP config snippet plus a
     "Connected" status row.

4. **Final CTA** — dark gradient card, copy updated to "Your knowledge, ready
   for AI." → `Create your account`. Structure unchanged.

## Constraints / conventions

- **No emoji** in UI text or code. Use the `Icon` component or CSS shapes for
  document/client glyphs in the mockup.
- All colors via `var(--*)` tokens — no raw hex except where the existing file
  already does (e.g. macOS traffic-light dots).
- **Mobile-responsive**: verify at 390px. Hero badges and the heavier mockup
  internals collapse gracefully; MCP panel stacks under the list.
- Add necessary English comments.
- Reuse `useFadeInOnScroll` for staggered section reveals.

## Out of scope

- Backend, routing, auth, and nav/header changes.
- The legacy vanilla-JS landing page.

## Verification

- `npm run build` (tsc + vite) passes with no type errors.
- Manual check at 390px (mobile) and desktop, light + dark mode.
