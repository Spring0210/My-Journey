# Frontend Polish — Cross-page Consistency Pass

**Date:** 2026-05-18
**Status:** Draft (pending user review)
**Scope:** 6 items, ordered by dependency.

## Goals

1. Eliminate visible inconsistencies across the React frontend that currently break the Apple HIG illusion (raw `alert()`, `"Loading..."` text, single-image lightbox in journal vs full lightbox in spaces).
2. Add a baseline of motion polish (page/modal transitions, calendar visual variety) without bloating bundle size.
3. Lay foundations (Toast, ConfirmDialog, Skeleton, Lightbox, EmptyState, Framer Motion) that future Phase 8A/8B/8C work can reuse without re-inventing.

## Out of scope (deferred)

- Mood selector + tag system + streak (Phase 8A — pulls in DB migrations and is larger than this polish pass).
- Reading Mode for Journal Detail (clean separate task).
- Writing stats page (Phase 8C — needs SQL aggregates + new page).
- `SpaceDetailPage.tsx` refactor (Phase 8D — code health, not user-facing).
- Reflection prompt on save / Weekly pattern recap / On This Day (Phase 8B — AI features, separate scope).

---

## Work item 1 — Toast + ConfirmDialog system

**Files added**

```
frontend/src/components/feedback/
  ToastProvider.tsx
  Toast.tsx
  useToast.ts
  ConfirmDialog.tsx
  ConfirmProvider.tsx
  useConfirm.ts
  Feedback.css
```

**API**

```ts
// Toast
const toast = useToast()
toast.success('Saved')
toast.error('Failed to delete photo')
toast.info('Notifications marked read')

// Confirm
const confirm = useConfirm()
const ok = await confirm({
  title: 'Delete entry?',
  message: 'This cannot be undone.',
  danger: true,                 // makes confirm button red
  confirmLabel: 'Delete',       // optional, default 'Confirm'
  cancelLabel: 'Cancel',        // optional, default 'Cancel'
})
if (ok) { ... }
```

**Layout**

- Toast container:
  - Desktop: fixed bottom-right, 24px from edges, stacks bottom-to-top.
  - Mobile (≤768px): fixed top, 16px from edges, centered, stacks top-to-bottom.
  - Max 3 visible; 4th replaces oldest.
- Each toast: auto-dismiss 3000ms; pause on hover; manual close (×).
- ConfirmDialog:
  - Desktop: centered card, fade + scale-in (0.96→1).
  - Mobile: bottom sheet, slide-up.
  - ESC cancels; click backdrop cancels.

**Tokens used**

- Toast bg: `var(--surface-card)`; border: `var(--separator)`; shadow: `var(--shadow-overlay)` (add token if missing).
- Variants — success: green check, error: red x, info: blue i — icon color only, no full color fill.

**Provider wiring**

`AppLayout.tsx` wraps children in `<ToastProvider>` and `<ConfirmProvider>` (both above `<Outlet>`).

**Replacement scan**

Replace every `alert(` (~10 call sites) and `window.confirm(` / `confirm(` (~5 call sites) across:

- `pages/journal/JournalListPage.tsx`
- `pages/journal/JournalDetailPage.tsx`
- `pages/spaces/SpacesListPage.tsx`
- `pages/spaces/SpaceDetailPage.tsx`
- `pages/notifications/NotificationsPage.tsx`
- `pages/profile/ProfilePage.tsx`
- `pages/dashboard/DashboardPage.tsx`

---

## Work item 2 — Skeleton loaders

**Files added**

```
frontend/src/components/ui/Skeleton.tsx
frontend/src/components/ui/Skeleton.css
```

**API**

```tsx
<Skeleton width="100%" height={20} radius={6} />
<Skeleton variant="text" lines={3} />
<Skeleton variant="circle" size={36} />
```

**Animation**

`@keyframes shimmer` — linear-gradient sweeps across the skeleton at 1.2s loop. Gradient: `var(--surface-secondary)` → `var(--surface-tertiary)` → `var(--surface-secondary)`. Honors `prefers-reduced-motion: reduce` (static dim block instead).

**Per-page skeletons (inline, no separate file)**

Each page replaces its existing `if (loading) return <div>"Loading..."</div>` with a hand-shaped skeleton that mimics the loaded layout:

- `DashboardPage`: greeting line + today card + 4 entry rows.
- `JournalListPage`: 9 grid cards.
- `JournalDetailPage`: title bar + date row + 5 lines of content + photo grid placeholder.
- `CalendarPage`: toolbar + 5×7 grid of empty day cells.
- `NotificationsPage`: 5 rows (avatar + 2-line text).
- `SpacesListPage`: 6 space cards.
- `SpaceDetailPage`: cover + 3 posts (avatar + 3-line text).

---

## Work item 3 — Framer Motion page + modal transitions

**Dependency**

`pnpm add framer-motion` (≈50KB gzip; one of the smaller motion libs for the value).

**Page transition**

```tsx
// AppLayout.tsx
<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
  >
    <Outlet />
  </motion.div>
</AnimatePresence>
```

**Modal transitions**

Each modal (writing prompts, recap, search sheets, space invite, lightbox container) wrapped with:

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.96 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.96 }}
  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
/>
```

Backdrop fades separately. Bottom sheets on mobile use `y` instead of `scale`.

**Accessibility**

Wrap all motion in `useReducedMotion()` check — when true, set all `transition.duration` to 0.

---

## Work item 4 — Shared `<Lightbox>` component

**File**

`frontend/src/components/ui/Lightbox.tsx` + `Lightbox.css`

**Props**

```ts
type LightboxProps = {
  images: string[]
  index: number
  open: boolean
  onClose: () => void
  onIndexChange: (i: number) => void
}
```

**Behavior**

- prev/next arrow buttons:
  - Visible on hover (desktop); always visible on mobile.
  - Hidden when at first / last index unless looping (no looping for v1).
- Keyboard: `←` prev, `→` next, `Esc` close.
- Touch swipe: horizontal pan threshold 50px → prev/next.
- Counter top-right: `3 / 7` (hidden for single image).
- Click outside image closes; click image does nothing.
- Single image: no nav, no counter — same as today's journal lightbox.

**Migration**

- `JournalDetailPage.tsx`:
  - Replace `lightboxSrc: string | null` with `lightboxIndex: number | null`.
  - Photo click passes index; combine `existingPhotos + pendingFiles.map(URL.createObjectURL)` into the source list.
  - Remove `.jdetail-lightbox*` CSS.
- `SpaceDetailPage.tsx`:
  - Replace inline lightbox JSX with `<Lightbox>`.
  - Keep `openLightbox(images, index)` helper.
  - Remove `.sdetail-lightbox*` CSS.

---

## Work item 5 — Empty state SVG illustrations

**File**

```
frontend/src/components/ui/EmptyState.tsx
frontend/src/components/ui/illustrations/
  EmptyJournal.tsx          // feather + page
  EmptySearchResult.tsx     // magnifier + question
  EmptyNotifications.tsx    // bell + check
```

**Style**

- Inline SVG, `viewBox="0 0 120 120"`, stroke-only line art.
- `stroke="var(--label-tertiary)"`, `stroke-width="1.5"`, no fill.
- Hand-drawn-but-clean feel — single line, gentle curves.

**EmptyState API**

```tsx
<EmptyState
  illustration={<EmptyJournal />}
  title="Your journal is empty"
  subtitle="Write your first entry to get started."
  action={<button>Write first entry</button>}
/>
```

**Sites**

- DashboardPage `entries.length === 0` block.
- JournalListPage `entries.length === 0 && !isSearchMode` block (plain "No entries yet" today) — and search-no-result variant.
- NotificationsPage `notifs.length === 0` block.

---

## Work item 6 — Calendar visual rework

### 6a — Event pill differentiation (frontend only)

- Event pill renders custom content via FullCalendar `eventContent` callback:
  - Has photo → small camera icon (SVG, 10px) + title.
  - Text-only → small bullet dot + title.
- Same day with N entries: stack vertically (existing FullCalendar behavior); if N > 3, show `+N more` chip.

### 6b — Hover preview tooltip (desktop only)

- `eventMouseEnter` → after 200ms delay, render a floating card near the event:
  - 80×80 thumbnail of first image (if any), or text excerpt (first 60 chars).
  - Entry title + date.
- `eventMouseLeave` cancels the timer / hides the card.
- Skip on touch / mobile (`@media (pointer: coarse)`).

### 6c — Year heatmap view

**Frontend**

- New file: `frontend/src/pages/journal/YearHeatmap.tsx`.
- Replaces FullCalendar with custom `<table>` 53 cols × 7 rows; each cell is one day.
- Color scale (5 buckets):
  - 0 entries: `var(--surface-secondary)`.
  - 1 entry: `color-mix(in srgb, var(--accent) 20%, transparent)`.
  - 2 entries: `30%`. 3: `45%`. ≥4: `60%`.
- Cell hover: native `title` attribute "YYYY-MM-DD · N entries".
- Cell click: navigate to `/journal?date=YYYY-MM-DD`.
- Year selector top-right (Prev / Year display / Next).
- Layout under CalendarPage's existing month grid, OR view-switcher in FullCalendar header — chose **view-switcher** (less scrolling, matches month / list pattern). FullCalendar's `customButtons` + a custom view registration is heavier than just adding a third top-level toggle above `<FullCalendar>`. Implement as a `useState<'month' | 'list' | 'year'>` in `CalendarPage.tsx`; render FullCalendar for month/list and `<YearHeatmap />` for year.

**Backend**

```java
// JournalController.java
@GetMapping("/heatmap")
public ResponseEntity<List<HeatmapPoint>> heatmap(
    @RequestParam Long userId,
    @RequestParam int year
) { ... }

// JournalService.java
public List<HeatmapPoint> getHeatmap(Long userId, int year) {
    return repo.countEntriesPerDay(userId, year);  // JPQL aggregate
}

// JournalEntryRepository.java
@Query("SELECT new com.myjourney.dto.HeatmapPoint(e.entryDate, COUNT(e)) " +
       "FROM JournalEntry e WHERE e.user.id = :userId " +
       "AND YEAR(e.entryDate) = :year " +
       "GROUP BY e.entryDate")
List<HeatmapPoint> countEntriesPerDay(@Param("userId") Long userId, @Param("year") int year);
```

DTO:

```java
public record HeatmapPoint(LocalDate date, Long count) {}
```

API path (frontend): `getHeatmap(userId, year)` in `frontend/src/api/journal.ts`.
Type (frontend): `type HeatmapPoint = { date: string; count: number }` in `types/api.ts`.

### 6d — Mobile toolbar fix

FullCalendar's default toolbar wraps badly on ≤480px. Override via custom `headerToolbar` config:

```ts
headerToolbar={{
  left: 'title',
  right: 'prev,next today dayGridMonth,listWeek,year',
}}
// CSS forces title row above buttons on mobile via flex-wrap reorder.
```

---

## Architecture summary

**New shared infra** (reusable by future work):
- `<ToastProvider>` / `useToast` — covers Phase 8A entry save feedback.
- `<ConfirmProvider>` / `useConfirm` — covers Phase 8 tag delete, mood reset, etc.
- `<Skeleton>` — covers all future pages.
- `<Lightbox>` — covers any image surface (future video lightbox can extend).
- `<EmptyState>` — single source for empty-state visual language.
- Framer Motion installed → available for any future animation.

**Page-specific changes**:
- All 7 pages get skeleton replacement.
- `JournalDetailPage` + `SpaceDetailPage` migrate to `<Lightbox>`.
- `CalendarPage` rendered conditionally with `<YearHeatmap>` for year view.
- `DashboardPage` + `JournalListPage` + `NotificationsPage` use `<EmptyState>` with SVGs.

**Backend changes**:
- Single new endpoint `GET /api/entries/heatmap` + DTO + repository query. No migration needed.

---

## Testing strategy

**Manual (golden path):**
1. Save a journal entry → toast appears.
2. Delete entry → confirm dialog → toast.
3. Refresh any page → skeleton visible briefly → real content fades in.
4. Navigate between routes → fade+slide transition.
5. Open lightbox on journal entry with 3 photos → swipe / arrow navigates.
6. Same on space post.
7. Calendar: switch to Year view → see heatmap → click cell → journal list filtered.
8. Resize to 390px → mobile toast top, mobile calendar toolbar tidy.

**Automated:** Defer. This is a UI polish pass and Phase 7 (golden-path tests via Vitest) hasn't shipped yet. Add visual regression in a later phase if/when warranted.

---

## Open questions (resolved before drafting)

| Q | A |
|---|---|
| Toast position? | Desktop bottom-right, mobile top. |
| Heatmap data: frontend aggregate or backend? | Backend (`GET /api/entries/heatmap`). |
| Mood color in calendar pills? | No — defer to Phase 8A. |
| Mood UI form (when Phase 8A starts)? | SF Symbols line icons; tracked in roadmap, not this spec. |

---

## Rollout sequence

1. Toast + ConfirmDialog → batch replace alert/confirm.
2. Skeleton component + per-page replacements.
3. Framer Motion install + AppLayout transition + modal motion wrap.
4. Lightbox component + JournalDetail/SpaceDetail migration.
5. EmptyState + 3 illustrations + 3 page integrations.
6. Calendar rework: 6a → 6b → 6c (backend first, then YearHeatmap) → 6d.

Each item is a self-contained commit. After all 6, push.
