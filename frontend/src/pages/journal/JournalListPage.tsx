import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getPersonalSpace } from '@/api/spaces'
import { listDocuments } from '@/api/documents'
import type {
  SpaceSummaryResponse, DocumentSummaryResponse,
} from '@/types/api'
import Icon from '@/components/ui/Icon'
import PageTopBar from '@/components/ui/PageTopBar'
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import EmptyJournal from '@/components/ui/illustrations/EmptyJournal'
import { formatEntryDate, stripMarkdown } from '@/pages/spaces/docCardUtils'
import '@/pages/spaces/SpaceDetail.css'   // reuse .sdetail-doc-card styling
import './JournalList.css'

// ─────────────────────────────────────────────────────────
// JournalListPage — the user's journal feed.
// Backed by the unified Document model: lists JOURNAL docs
// from the user's auto-created personal space. Date click
// from Calendar / Heatmap drills in via ?date=YYYY-MM-DD.
//
// Legacy search / AI search / recap / prompts UI was removed
// with the doc model pivot — those features depend on the
// /api/entries endpoints, which are scheduled to migrate to
// the document model in a follow-up PR.
// ─────────────────────────────────────────────────────────

const PAGE_SIZE = 9

export default function JournalListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const dateFilter = searchParams.get('date') || ''

  const [personalSpace, setPersonalSpace] = useState<SpaceSummaryResponse | null>(null)
  const [docs, setDocs]                   = useState<DocumentSummaryResponse[]>([])
  const [currentPage, setCurrentPage]     = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [loading, setLoading]             = useState(true)
  const [loadingMore, setLoadingMore]     = useState(false)

  // Fetch the personal space once on mount; subsequent fetches reuse it.
  useEffect(() => {
    getPersonalSpace()
      .then(setPersonalSpace)
      .catch(() => setPersonalSpace(null))
  }, [])

  // (Re)load the doc list when the personal space resolves or the date filter changes.
  useEffect(() => {
    if (!personalSpace) return
    setLoading(true)
    listDocuments(personalSpace.id, {
      type: 'JOURNAL',
      date: dateFilter || undefined,
      page: 0,
      size: PAGE_SIZE,
    })
      .then(page => {
        setDocs(page.content)
        setCurrentPage(page.currentPage)
        setTotalPages(page.totalPages)
      })
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [personalSpace?.id, dateFilter])

  async function loadMore() {
    if (!personalSpace || loadingMore || currentPage + 1 >= totalPages) return
    setLoadingMore(true)
    try {
      const next = await listDocuments(personalSpace.id, {
        type: 'JOURNAL',
        date: dateFilter || undefined,
        page: currentPage + 1,
        size: PAGE_SIZE,
      })
      setDocs(prev => [...prev, ...next.content])
      setCurrentPage(next.currentPage)
    } finally {
      setLoadingMore(false)
    }
  }

  function clearDateFilter() {
    setSearchParams({})
  }

  function newEntryPath(): string | null {
    return personalSpace ? `/spaces/${personalSpace.id}/documents/new` : null
  }

  function entryPath(docId: number): string {
    return `/spaces/${personalSpace!.id}/documents/${docId}`
  }

  return (
    <div className="jlist-page">

      <PageTopBar
        title="Journal"
        actions={
          <button
            className="jlist-btn jlist-btn--primary jlist-btn--topbar"
            onClick={() => {
              const path = newEntryPath()
              if (path) navigate(path)
            }}
            disabled={!personalSpace}
          >
            <Icon name="plus" size={16} />
            New entry
          </button>
        }
      />

      <div className="jlist-inner">

        {dateFilter && (
          <div className="jlist-filter-pill">
            <Icon name="calendar" size={13} />
            <span>Showing entries from {formatEntryDate(dateFilter)}</span>
            <button
              type="button"
              className="jlist-filter-clear"
              onClick={clearDateFilter}
              aria-label="Clear date filter"
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        )}

        {loading ? (
          <JournalListSkeleton />
        ) : docs.length === 0 ? (
          <EmptyState
            illustration={<EmptyJournal />}
            title={dateFilter ? 'No entries on this day' : 'No journal entries yet'}
            subtitle={dateFilter
              ? 'Try a different date or clear the filter to see everything.'
              : 'Start writing — the first entry is always the hardest.'}
            action={dateFilter ? undefined : (
              <button
                className="jlist-btn jlist-btn--primary"
                onClick={() => {
                  const path = newEntryPath()
                  if (path) navigate(path)
                }}
                disabled={!personalSpace}
              >
                <Icon name="plus" size={16} />
                Write your first entry
              </button>
            )}
          />
        ) : (
          <div className="sdetail-doc-list">
            {docs.map(doc => {
              const cleanSnippet = stripMarkdown(doc.snippet)
              const truncated = doc.snippet.length >= 200
              const dateLabel = doc.entryDate ? formatEntryDate(doc.entryDate) : ''
              return (
                <article
                  key={doc.id}
                  className="sdetail-doc-card"
                  onClick={() => navigate(entryPath(doc.id))}
                  role="link"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(entryPath(doc.id))
                    }
                  }}
                >
                  <h3 className="sdetail-doc-title">{doc.title}</h3>

                  {cleanSnippet && (
                    <p className="sdetail-doc-snippet">
                      {cleanSnippet}{truncated ? '…' : ''}
                    </p>
                  )}

                  {doc.imageUrls.length > 0 && (
                    <div className="sdetail-doc-thumbs">
                      {doc.imageUrls.map((url, i) => (
                        <div key={i} className="sdetail-doc-thumb">
                          <img src={url} alt="" loading="lazy" />
                        </div>
                      ))}
                    </div>
                  )}

                  {doc.tags.length > 0 && (
                    <div className="sdetail-doc-tags">
                      {doc.tags.slice(0, 6).map(t => (
                        <span key={t} className="sdetail-doc-tag">#{t}</span>
                      ))}
                      {doc.tags.length > 6 && (
                        <span className="sdetail-doc-tag sdetail-doc-tag--more">
                          +{doc.tags.length - 6}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="sdetail-doc-meta">
                    <div className="sdetail-doc-avatar">
                      {doc.authorAvatar
                        ? <img src={doc.authorAvatar} alt="" />
                        : doc.authorUsername.charAt(0).toUpperCase()
                      }
                    </div>
                    <span className="sdetail-doc-author">@{doc.authorUsername}</span>
                    {dateLabel && (
                      <>
                        <span className="sdetail-doc-dot">·</span>
                        <span className="sdetail-doc-time">{dateLabel}</span>
                      </>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {!loading && currentPage + 1 < totalPages && (
          <button
            className="jlist-load-more"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load more entries'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Three doc-card placeholders while the personal space + first
// page of journal docs load.
// ─────────────────────────────────────────────────────────
function JournalListSkeleton() {
  return (
    <div className="sdetail-doc-list">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="sdetail-doc-card"
          style={{ pointerEvents: 'none' }}
        >
          <Skeleton width="60%" height={18} />
          <Skeleton width="100%" height={13} style={{ marginTop: 10 }} />
          <Skeleton width="90%" height={13} style={{ marginTop: 6 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
            <SkeletonCircle size={24} />
            <Skeleton width={100} height={11} />
          </div>
        </div>
      ))}
    </div>
  )
}
