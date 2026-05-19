import { useEffect, useMemo, useRef } from 'react'
import Icon from './Icon'
import './Lightbox.css'

// ─────────────────────────────────────────────────────────
// Lightbox — full-screen image / video viewer.
// Features:
//   • Prev/next buttons (hidden when at first/last)
//   • Keyboard arrows + ESC to close
//   • Touch swipe (50px threshold) on mobile
//   • Counter when more than one item
//   • Click outside content closes
//   • Optional bottom meta strip (date + title + "View entry →")
// Used by JournalDetailPage, SpaceDetailPage, and MediaPage.
// ─────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 50    // px of horizontal travel that triggers a slide

export interface LightboxItem {
  type: 'IMAGE' | 'VIDEO'
  url: string
}

// Optional per-item caption shown in the bottom strip (Media library use).
// All fields are optional; the strip is hidden entirely if every field is empty.
export interface LightboxMeta {
  date?: string     // pre-formatted display string, e.g. "May 12, 2026"
  title?: string    // entry title or post snippet
  href?: string     // route to source — paired with onViewSource for navigation
}

interface LightboxProps {
  /** Rich content (preferred). Falls back to converting `images` if absent. */
  items?: LightboxItem[]
  /** Optional captions, index-aligned with `items`. */
  metas?: LightboxMeta[]
  /** Legacy back-compat: array of image URLs. Converted to items internally. */
  images?: string[]
  index: number
  open: boolean
  onClose: () => void
  onIndexChange: (i: number) => void
  /** Called when the user clicks "View entry →" in the meta strip.
   *  Parent decides how to navigate; lightbox just emits the href. */
  onViewSource?: (href: string) => void
}

export default function Lightbox({
  items,
  metas,
  images,
  index,
  open,
  onClose,
  onIndexChange,
  onViewSource,
}: LightboxProps) {

  const touchStartX = useRef<number | null>(null)

  // Normalize inputs: items > images (back-compat). Memoized to avoid
  // re-creating the array on every render if the parent passes a stable input.
  const resolvedItems = useMemo<LightboxItem[]>(() => {
    if (items && items.length) return items
    if (images && images.length) {
      return images.map(url => ({ type: 'IMAGE' as const, url }))
    }
    return []
  }, [items, images])

  // ── Keyboard: ESC closes, arrows navigate ─────────────
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft' && index > 0) {
        onIndexChange(index - 1)
      } else if (e.key === 'ArrowRight' && index < resolvedItems.length - 1) {
        onIndexChange(index + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, index, resolvedItems.length, onClose, onIndexChange])

  if (!open || resolvedItems.length === 0) return null

  const safeIndex   = Math.max(0, Math.min(index, resolvedItems.length - 1))
  const current     = resolvedItems[safeIndex]
  const currentMeta = metas?.[safeIndex]
  const canPrev     = safeIndex > 0
  const canNext     = safeIndex < resolvedItems.length - 1
  const isMultiple  = resolvedItems.length > 1

  // Meta strip is shown if any meta field has content for the current item
  const hasMeta = !!currentMeta && (
    !!currentMeta.date || !!currentMeta.title ||
    (!!currentMeta.href && !!onViewSource)
  )

  // ── Touch handlers — horizontal swipe ─────────────────
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (dx > SWIPE_THRESHOLD && canPrev) {
      onIndexChange(safeIndex - 1)
    } else if (dx < -SWIPE_THRESHOLD && canNext) {
      onIndexChange(safeIndex + 1)
    }
  }

  return (
    <div
      className="lightbox"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        className="lightbox-close"
        onClick={e => { e.stopPropagation(); onClose() }}
        aria-label="Close"
      >
        <Icon name="close" size={20} />
      </button>

      {/* Prev / Next navigation — only when multiple items */}
      {canPrev && (
        <button
          className="lightbox-nav lightbox-nav--prev"
          onClick={e => { e.stopPropagation(); onIndexChange(safeIndex - 1) }}
          aria-label="Previous"
        >
          <Icon name="chevron-left" size={22} />
        </button>
      )}
      {canNext && (
        <button
          className="lightbox-nav lightbox-nav--next"
          onClick={e => { e.stopPropagation(); onIndexChange(safeIndex + 1) }}
          aria-label="Next"
        >
          <Icon name="chevron-right" size={22} />
        </button>
      )}

      {/* Content — image or video. stopPropagation keeps clicks from closing. */}
      {current.type === 'VIDEO' ? (
        <video
          key={current.url}
          src={current.url}
          className="lightbox-video"
          controls
          autoPlay
          playsInline
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <img
          src={current.url}
          alt={currentMeta?.title || `Item ${safeIndex + 1} of ${resolvedItems.length}`}
          className="lightbox-img"
          onClick={e => e.stopPropagation()}
          draggable={false}
        />
      )}

      {/* Counter — only when more than one item */}
      {isMultiple && !hasMeta && (
        <p className="lightbox-counter">
          {safeIndex + 1} / {resolvedItems.length}
        </p>
      )}

      {/* Bottom meta strip — only when caller provided meta */}
      {hasMeta && (
        <div
          className="lightbox-meta"
          onClick={e => e.stopPropagation()}
        >
          <div className="lightbox-meta-info">
            {currentMeta?.date && (
              <span className="lightbox-meta-date">{currentMeta.date}</span>
            )}
            {currentMeta?.title && (
              <span className="lightbox-meta-title">{currentMeta.title}</span>
            )}
          </div>
          <div className="lightbox-meta-actions">
            {isMultiple && (
              <span className="lightbox-meta-counter">
                {safeIndex + 1} / {resolvedItems.length}
              </span>
            )}
            {currentMeta?.href && onViewSource && (
              <button
                className="lightbox-meta-link"
                onClick={() => onViewSource(currentMeta.href!)}
              >
                View entry
                <Icon name="chevron-right" size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
