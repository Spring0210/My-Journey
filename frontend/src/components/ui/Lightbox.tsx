import { useEffect, useRef } from 'react'
import Icon from './Icon'
import './Lightbox.css'

// ─────────────────────────────────────────────────────────
// Lightbox — full-screen image viewer.
// Features:
//   • Prev/next buttons (hidden when at first/last)
//   • Keyboard arrows + ESC to close
//   • Touch swipe (50px threshold) on mobile
//   • Image counter when more than one image
//   • Click outside image closes
// Used by JournalDetailPage and SpaceDetailPage.
// ─────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 50    // px of horizontal travel that triggers a slide

interface LightboxProps {
  images: string[]
  index: number
  open: boolean
  onClose: () => void
  onIndexChange: (i: number) => void
}

export default function Lightbox({
  images, index, open, onClose, onIndexChange,
}: LightboxProps) {

  const touchStartX = useRef<number | null>(null)

  // ── Keyboard: ESC closes, arrows navigate ─────────────
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft' && index > 0) {
        onIndexChange(index - 1)
      } else if (e.key === 'ArrowRight' && index < images.length - 1) {
        onIndexChange(index + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, index, images.length, onClose, onIndexChange])

  if (!open || images.length === 0) return null

  const currentSrc  = images[Math.max(0, Math.min(index, images.length - 1))]
  const canPrev     = index > 0
  const canNext     = index < images.length - 1
  const isMultiple  = images.length > 1

  // ── Touch handlers — horizontal swipe ─────────────────
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (dx > SWIPE_THRESHOLD && canPrev) {
      onIndexChange(index - 1)
    } else if (dx < -SWIPE_THRESHOLD && canNext) {
      onIndexChange(index + 1)
    }
  }

  return (
    <div
      className="lightbox"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
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

      {/* Prev / Next navigation — only when multiple images */}
      {canPrev && (
        <button
          className="lightbox-nav lightbox-nav--prev"
          onClick={e => { e.stopPropagation(); onIndexChange(index - 1) }}
          aria-label="Previous image"
        >
          <Icon name="chevron-left" size={22} />
        </button>
      )}
      {canNext && (
        <button
          className="lightbox-nav lightbox-nav--next"
          onClick={e => { e.stopPropagation(); onIndexChange(index + 1) }}
          aria-label="Next image"
        >
          <Icon name="chevron-right" size={22} />
        </button>
      )}

      {/* Image — stop click so it doesn't trigger overlay close */}
      <img
        src={currentSrc}
        alt={`Image ${index + 1} of ${images.length}`}
        className="lightbox-img"
        onClick={e => e.stopPropagation()}
        draggable={false}
      />

      {/* Counter — only when more than one image */}
      {isMultiple && (
        <p className="lightbox-counter">
          {index + 1} / {images.length}
        </p>
      )}
    </div>
  )
}
