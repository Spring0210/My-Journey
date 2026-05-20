import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMedia } from '@/api/media'
import type { MediaResponse, MediaTypeFilter } from '@/types/api'
import Icon from '@/components/ui/Icon'
import PageTopBar from '@/components/ui/PageTopBar'
import EmptyState from '@/components/ui/EmptyState'
import EmptyMedia from '@/components/ui/illustrations/EmptyMedia'
import Lightbox, { type LightboxItem, type LightboxMeta } from '@/components/ui/Lightbox'
import { useToast } from '@/components/feedback'
import './Media.css'

// ─────────────────────────────────────────────────────────
// MediaPage — gallery of everything the user has uploaded.
// Sources: their own private journal images + their own Space
// posts (images + videos). Sorted by source date, descending.
// Month-grouped, infinite scroll, ALL/Photos/Videos filter.
// ─────────────────────────────────────────────────────────

const PAGE_SIZE = 60

// Pre-loaded one viewport before the user reaches the bottom so the next
// page is usually already in hand by the time it would matter.
const SENTINEL_ROOT_MARGIN = '400px 0px'

// Convert "YYYY-MM-DD" into a sticky month header label, e.g. "May 2026".
function monthLabel(isoDate: string): string {
  const [y, m] = isoDate.split('-')
  const date   = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

// Group key — "YYYY-MM"
function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7)
}

// "May 12, 2026" for the lightbox meta strip
function formatFullDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date     = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

// The route back to a single media item's source entry. Server-provided so
// DOCUMENT routing can pick between /journal/* and /spaces/*/documents/*.
// Falls back to a best-effort path on older payloads that predate the field.
function sourceHref(item: MediaResponse): string {
  if (item.sourceHref) return item.sourceHref
  return item.sourceType === 'JOURNAL'
    ? `/journal/legacy/${item.sourceId}`
    : `/spaces/${item.sourceId}`
}

// Cloudinary first-frame thumbnail trick:
//   /upload/...mp4  →  /upload/so_0/...jpg
// "so_0" is the start-offset transformation; rewriting the extension to .jpg
// tells Cloudinary to render that frame as a JPEG.
function videoThumbnail(url: string): string {
  return url
    .replace('/upload/', '/upload/so_0/')
    .replace(/\.[a-z0-9]+$/i, '.jpg')
}

export default function MediaPage() {
  const navigate = useNavigate()
  const toast    = useToast()

  const [items, setItems]         = useState<MediaResponse[]>([])
  const [cursor, setCursor]       = useState<string | null>(null)
  const [hasMore, setHasMore]     = useState(true)
  const [loading, setLoading]     = useState(true)   // initial page load
  const [loadingMore, setMore]    = useState(false)  // subsequent pages
  const [type, setType]           = useState<MediaTypeFilter>('ALL')
  const [error, setError]         = useState<string | null>(null)
  const [lightboxIndex, setLb]    = useState<number | null>(null)

  // Track the request that is in-flight so chip switches abort the previous one.
  const abortRef = useRef<AbortController | null>(null)

  // ── Fetch a page ──────────────────────────────────────
  const fetchPage = useCallback(async (
    forType: MediaTypeFilter,
    forCursor: string | null,
    replace: boolean,
  ) => {
    // Cancel any older in-flight request — the chip might have changed mid-flight.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (replace) setLoading(true)
    else         setMore(true)
    setError(null)

    try {
      const page = await getMedia(forType, forCursor, PAGE_SIZE)
      if (controller.signal.aborted) return
      setItems(prev => replace ? page.items : [...prev, ...page.items])
      setCursor(page.nextCursor)
      setHasMore(page.nextCursor != null)
    } catch (e) {
      if (controller.signal.aborted) return
      const msg = e instanceof Error ? e.message : 'Failed to load media'
      setError(msg)
      if (!replace) toast.error(msg)
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        setMore(false)
      }
    }
  }, [toast])

  // Initial load + reload on chip change
  useEffect(() => {
    setItems([])
    setCursor(null)
    setHasMore(true)
    fetchPage(type, null, true)
    // Stop tracking the previous abortable request when unmounting.
    return () => abortRef.current?.abort()
  }, [type, fetchPage])

  // ── Infinite scroll sentinel ──────────────────────────
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loading || loadingMore) return

    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) fetchPage(type, cursor, false)
    }, { rootMargin: SENTINEL_ROOT_MARGIN })

    observer.observe(el)
    return () => observer.disconnect()
  }, [cursor, hasMore, loading, loadingMore, type, fetchPage])

  // ── Group items by month for sticky headers ───────────
  // Memoized so re-renders during loading don't re-walk the array.
  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: MediaResponse[] }[] = []
    const indexByKey = new Map<string, number>()
    for (const it of items) {
      const key = monthKey(it.sourceDate)
      const idx = indexByKey.get(key)
      if (idx == null) {
        indexByKey.set(key, groups.length)
        groups.push({ key, label: monthLabel(it.sourceDate), items: [it] })
      } else {
        groups[idx].items.push(it)
      }
    }
    return groups
  }, [items])

  // ── Lightbox plumbing ─────────────────────────────────
  // The lightbox shows all currently-loaded items in order so prev/next works
  // across month boundaries. Index maps directly into `items`.
  const lightboxItems = useMemo<LightboxItem[]>(
    () => items.map(it => ({ type: it.type, url: it.url })),
    [items]
  )

  const lightboxMetas = useMemo<LightboxMeta[]>(
    () => items.map(it => ({
      date: formatFullDate(it.sourceDate),
      title: it.sourceTitle,
      href: sourceHref(it),
    })),
    [items]
  )

  function handleViewSource(href: string) {
    setLb(null)
    navigate(href)
  }

  // ── Render ────────────────────────────────────────────
  const isFirstLoad = loading && items.length === 0
  const isEmpty     = !loading && items.length === 0 && !error

  return (
    <div className="media-page">

      <PageTopBar
        title="Media"
        actions={
          <div className="media-chips">
            {(['ALL', 'IMAGE', 'VIDEO'] as MediaTypeFilter[]).map(t => (
              <button
                key={t}
                className={`media-chip${type === t ? ' media-chip--active' : ''}`}
                onClick={() => { if (type !== t) setType(t) }}
                aria-pressed={type === t}
              >
                {t === 'ALL' ? 'All' : t === 'IMAGE' ? 'Photos' : 'Videos'}
              </button>
            ))}
          </div>
        }
      />

      <div className="media-inner">

        {isFirstLoad && (
          <div className="media-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="media-tile-skeleton" />
            ))}
          </div>
        )}

        {/* Total empty — no media at all, regardless of filter */}
        {isEmpty && type === 'ALL' && (
          <EmptyState
            illustration={<EmptyMedia />}
            title="Your media library is empty"
            subtitle="Photos and videos from your journal entries and Space posts will appear here."
            action={
              <div className="media-empty-actions">
                <button className="media-btn media-btn--primary" onClick={() => navigate('/journal/new')}>
                  Write an entry
                </button>
                <button className="media-btn" onClick={() => navigate('/spaces')}>
                  Browse Spaces
                </button>
              </div>
            }
          />
        )}

        {/* Filter-empty — has media but none in this chip */}
        {isEmpty && type !== 'ALL' && (
          <p className="media-filter-empty">
            {type === 'IMAGE' ? 'No photos yet.' : 'No videos yet.'}
          </p>
        )}

        {/* Loaded grid */}
        {!isFirstLoad && grouped.length > 0 && (
          <>
            {grouped.map(group => (
              <section key={group.key} className="media-month">
                <h2 className="media-month-title">{group.label}</h2>
                <div className="media-grid">
                  {group.items.map(item => {
                    // Global index across all loaded items — what the lightbox uses
                    const globalIndex = items.indexOf(item)
                    const thumb = item.type === 'VIDEO'
                      ? videoThumbnail(item.url)
                      : item.url
                    return (
                      <button
                        key={item.id}
                        className="media-tile"
                        onClick={() => setLb(globalIndex)}
                        aria-label={`Open ${item.sourceTitle || 'media'}`}
                      >
                        <img
                          src={thumb}
                          alt=""
                          loading="lazy"
                          className="media-tile-img"
                          onError={e => {
                            // Mark broken-image tiles so the gray fallback shows.
                            (e.currentTarget as HTMLImageElement).classList.add('media-tile-img--broken')
                          }}
                        />
                        {item.type === 'VIDEO' && (
                          <span className="media-tile-play" aria-hidden="true">
                            <Icon name="video" size={16} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}

            {/* Infinite scroll sentinel + load-more spinner */}
            {hasMore && (
              <div ref={sentinelRef} className="media-sentinel">
                {loadingMore && <span className="media-spinner" aria-label="Loading" />}
              </div>
            )}
          </>
        )}

        {/* Page-level error after first load */}
        {error && items.length === 0 && (
          <div className="media-error">
            <p>{error}</p>
            <button
              className="media-btn media-btn--primary"
              onClick={() => fetchPage(type, null, true)}
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Shared lightbox — extended with video + meta strip support */}
      <Lightbox
        items={lightboxItems}
        metas={lightboxMetas}
        index={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLb(null)}
        onIndexChange={setLb}
        onViewSource={handleViewSource}
      />
    </div>
  )
}
