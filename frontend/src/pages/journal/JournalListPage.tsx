import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { aiRecap, aiPrompts } from '@/api/journal'
import { getPersonalSpace } from '@/api/spaces'
import { listDocuments, aiSearchDocuments } from '@/api/documents'
import type {
  SpaceSummaryResponse, DocumentSummaryResponse,
} from '@/types/api'
import Icon from '@/components/ui/Icon'
import PageTopBar from '@/components/ui/PageTopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import EmptyJournal from '@/components/ui/illustrations/EmptyJournal'
import EmptySearchResult from '@/components/ui/illustrations/EmptySearchResult'
import { stripMarkdown } from '@/pages/spaces/docCardUtils'
import './JournalList.css'

// ─────────────────────────────────────────────────────────
// JournalListPage — paginated journal feed with keyword/date
// search, AI search, writing prompts, and monthly recap.
//
// The default list, keyword search, and AI search all read from the
// unified Document model — JOURNAL docs in the user's personal space.
// Recap + prompts still hit the legacy /api/entries endpoints; those
// migrate onto Document in a later batch.
// ─────────────────────────────────────────────────────────

const PAGE_SIZE = 9
// Max image thumbs rendered on a card before we collapse the rest into a
// "+N" overflow tile. When total media (images + videos) exceeds this, the
// 4th slot becomes the overflow chip.
const MAX_VISIBLE_THUMBS = 3

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function JournalListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const dateFilter = searchParams.get('date') || ''

  // ── Personal space + default doc list ─────────────────
  const [personalSpace, setPersonalSpace] = useState<SpaceSummaryResponse | null>(null)
  const [docs, setDocs]                   = useState<DocumentSummaryResponse[]>([])
  const [currentPage, setCurrentPage]     = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [loading, setLoading]             = useState(true)

  // ── Search-mode state (documents) ─────────────────────
  // Both keyword search and AI search produce DocumentSummaryResponse[]
  // so a single render branch covers both. Pagination is not yet wired
  // for search results — searches return up to 50 matches in one shot.
  const [searchDocs, setSearchDocs]     = useState<DocumentSummaryResponse[]>([])
  const [isSearchMode, setIsSearchMode] = useState(false)

  // ── Search inputs ─────────────────────────────────────
  const [keyword, setKeyword] = useState('')
  const [date, setDate]       = useState('')

  // ── AI search state ───────────────────────────────────
  const [aiQuery, setAiQuery]     = useState('')
  const [aiMeta, setAiMeta]       = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // ── Desktop AI bar toggle ─────────────────────────────
  const [showAiBar, setShowAiBar] = useState(false)

  // ── Mobile bottom sheet states ────────────────────────
  const [searchOpen, setSearchOpen] = useState(false)
  const [aiOpen, setAiOpen]         = useState(false)

  // ── Modal state ───────────────────────────────────────
  const [showPrompts, setShowPrompts]       = useState(false)
  const [prompts, setPrompts]               = useState<string[]>([])
  const [promptsLoading, setPromptsLoading] = useState(false)
  const [promptsError, setPromptsError]     = useState('')

  const [showRecap, setShowRecap]       = useState(false)
  const [recapYear, setRecapYear]       = useState(new Date().getFullYear())
  const [recapMonth, setRecapMonth]     = useState(new Date().getMonth() + 1)
  const [recapText, setRecapText]       = useState('')
  const [recapLoading, setRecapLoading] = useState(false)

  // Personal space resolves once; reused for every doc-list fetch.
  useEffect(() => {
    getPersonalSpace()
      .then(setPersonalSpace)
      .catch(() => setPersonalSpace(null))
  }, [])

  // Load doc page from personal space.
  const loadDocs = useCallback(async (spaceId: number, page: number, dateParam: string) => {
    setLoading(true)
    try {
      const res = await listDocuments(spaceId, {
        type: 'JOURNAL',
        date: dateParam || undefined,
        page,
        size: PAGE_SIZE,
      })
      setDocs(res.content)
      setCurrentPage(res.currentPage)
      setTotalPages(res.totalPages)
      setIsSearchMode(false)
      setAiMeta('')
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Default load + react to ?date= URL param changes.
  useEffect(() => {
    if (!personalSpace) return
    loadDocs(personalSpace.id, 0, dateFilter)
  }, [personalSpace?.id, dateFilter, loadDocs])

  // ── Keyword / date search (Documents) ─────────────────
  // Both keyword and date are optional, but at least one must be set or
  // we'd just re-fetch the default page. Server caps page size at 50 to
  // keep search-result rendering snappy.
  function handleSearch() {
    if (!personalSpace) return
    if (!keyword.trim() && !date) return
    setIsSearchMode(true)
    setAiMeta('')
    setLoading(true)
    listDocuments(personalSpace.id, {
      type: 'JOURNAL',
      keyword: keyword.trim() || undefined,
      date: date || undefined,
      page: 0,
      size: 50,
    })
      .then(res => {
        setSearchDocs(res.content)
        setTotalPages(0)
      })
      .catch(() => setSearchDocs([]))
      .finally(() => setLoading(false))
  }

  function handleClear() {
    setKeyword('')
    setDate('')
    setAiQuery('')
    setAiMeta('')
    setSearchDocs([])
    if (dateFilter) setSearchParams({})
    if (personalSpace) loadDocs(personalSpace.id, 0, '')
  }

  // ── AI search (Documents) ─────────────────────────────
  async function handleAiSearch() {
    if (!aiQuery.trim() || !personalSpace) return
    setAiLoading(true)
    setIsSearchMode(true)
    setAiMeta('')
    setSearchDocs([])
    try {
      const data = await aiSearchDocuments(personalSpace.id, aiQuery.trim(), 'JOURNAL')
      if (data.keywords?.length) {
        setAiMeta(`Matched keywords: ${data.keywords.join(', ')}`)
      }
      setSearchDocs(data.results ?? [])
      setTotalPages(0)
    } catch {
      setSearchDocs([])
    } finally {
      setAiLoading(false)
    }
  }

  // ── Writing prompts ───────────────────────────────────
  async function openPrompts() {
    setShowPrompts(true)
    setPromptsError('')
    setPrompts([])
    setPromptsLoading(true)
    try {
      const data = await aiPrompts()
      if (data.error) { setPromptsError(data.error); return }
      setPrompts(data.prompts ?? [])
    } catch {
      setPromptsError('Failed to generate prompts. Please try again.')
    } finally {
      setPromptsLoading(false)
    }
  }

  // ── Monthly recap ─────────────────────────────────────
  async function handleGenerateRecap() {
    setRecapLoading(true)
    setRecapText('Generating...')
    try {
      const data = await aiRecap(recapYear, recapMonth)
      setRecapText(data.recap ?? data.error ?? 'Failed to generate.')
    } catch {
      setRecapText('Failed to generate recap. Please try again.')
    } finally {
      setRecapLoading(false)
    }
  }

  function goToPage(p: number) {
    if (!personalSpace) return
    loadDocs(personalSpace.id, p, dateFilter)
  }

  const years = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - i,
  )

  return (
    <div className="jlist-page">

      <PageTopBar
        title="Journal"
        actions={
          <button
            className="jlist-btn jlist-btn--primary jlist-btn--topbar"
            onClick={() => navigate('/journal/new')}
          >
            <Icon name="plus" size={16} />
            New entry
          </button>
        }
      />

      <div className="jlist-inner">

        {/* ── Desktop toolbar ─────────────────────────────── */}
        <div className="jlist-desktop-bar">
          <div className="jlist-search-card">

            <div className="jlist-toolbar-row">

              {/* Group 1: keyword + date + Search/Clear */}
              <div className="jlist-toolbar-search">
                <input
                  className="jlist-input jlist-input--keyword"
                  type="text"
                  placeholder="Search by keyword..."
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <input
                  className="jlist-input jlist-input--date"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
                <button className="jlist-btn" onClick={handleClear}>Clear</button>
                <button className="jlist-btn jlist-btn--primary" onClick={handleSearch}>
                  <Icon name="search" size={14} />
                  Search
                </button>
              </div>

              {/* Group 2: AI Search + Recap + Prompts — right side */}
              <div className="jlist-toolbar-tools">
                <button
                  className={`jlist-btn${showAiBar ? ' jlist-btn--active' : ''}`}
                  onClick={() => setShowAiBar(v => !v)}
                >
                  <Icon name="ai" size={14} />
                  AI Search
                </button>
                <button className="jlist-btn" onClick={() => { setShowRecap(true); setRecapText('') }}>
                  <Icon name="calendar" size={14} />
                  Recap
                </button>
                <button className="jlist-btn" onClick={openPrompts}>
                  <Icon name="journal" size={14} />
                  Prompts
                </button>
              </div>
            </div>

            {/* AI Search bar — expands below when toggled */}
            {showAiBar && (
              <div className="jlist-ai-bar">
                <input
                  className="jlist-ai-input"
                  type="text"
                  placeholder='Try "entries about my mom" or "times I felt proud"'
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
                  autoFocus
                />
                <button
                  className="jlist-btn jlist-btn--primary"
                  onClick={handleAiSearch}
                  disabled={aiLoading}
                >
                  <Icon name="ai" size={14} />
                  {aiLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            )}

          </div>
        </div>

        {/* ── Mobile chip row ─────────────────────────────── */}
        <div className="jlist-mobile-bar">
          <div className="jlist-chip-row">
            <button
              className={`jlist-chip${searchOpen ? ' jlist-chip--active' : ''}`}
              onClick={() => { setSearchOpen(v => !v); setAiOpen(false) }}
            >
              <Icon name="search" size={15} />
              Search
            </button>
            <button
              className={`jlist-chip${aiOpen ? ' jlist-chip--active' : ''}`}
              onClick={() => { setAiOpen(v => !v); setSearchOpen(false) }}
            >
              <Icon name="ai" size={15} />
              AI Search
            </button>
            <button
              className="jlist-chip"
              onClick={() => { setShowRecap(true); setRecapText('') }}
            >
              <Icon name="calendar" size={15} />
              Recap
            </button>
            <button className="jlist-chip" onClick={openPrompts}>
              <Icon name="journal" size={15} />
              Prompts
            </button>
          </div>
        </div>

        {/* Active filter banner — shows for both search results and ?date= drill-in */}
        {(isSearchMode || dateFilter) && (
          <div className="jlist-filter-banner">
            <Icon name={aiMeta ? 'ai' : 'search'} size={14} />
            <span className="jlist-filter-banner-text">
              {isSearchMode
                ? (aiMeta
                    ? `AI matched: ${aiQuery}`
                    : keyword || date
                      ? [keyword, date].filter(Boolean).join(' · ')
                      : 'Search results')
                : `Showing entries from ${formatDate(dateFilter)}`}
            </span>
            <button className="jlist-filter-banner-clear" onClick={handleClear}>
              Clear
              <Icon name="close" size={11} />
            </button>
          </div>
        )}

        {/* ── Entry grid ────────────────────────────────────
            Both default-list and search-result modes render the same
            DocumentSummaryResponse, so one card template covers both.
            displayDocs is empty in search mode until the response lands. */}
        {(() => {
          if (loading) return <JournalGridSkeleton />

          const displayDocs = isSearchMode ? searchDocs : docs

          if (displayDocs.length === 0) {
            if (isSearchMode) {
              return (
                <EmptyState
                  illustration={<EmptySearchResult />}
                  title="No entries found"
                  subtitle="Try a different keyword, date, or search query."
                />
              )
            }
            return (
              <EmptyState
                illustration={<EmptyJournal />}
                title={dateFilter ? 'No entries on this day' : 'No entries yet'}
                subtitle={dateFilter
                  ? 'Try a different date or clear the filter to see everything.'
                  : 'Start your journal with a single thought.'}
                action={dateFilter ? undefined : (
                  <button
                    className="jlist-btn jlist-btn--primary"
                    onClick={() => navigate('/journal/new')}
                  >
                    <Icon name="plus" size={15} />
                    Write your first entry
                  </button>
                )}
              />
            )
          }

          return (
            <div className="jlist-grid">
              {displayDocs.map(doc => {
                const excerpt = stripMarkdown(doc.snippet)
                // Total media = images + videos. Show up to MAX_VISIBLE_THUMBS
                // image thumbs; the rest (plus any videos) roll into a "+N" tile.
                const imageTotal = doc.imageCount && doc.imageCount > 0
                  ? doc.imageCount
                  : doc.imageUrls.length
                const total     = imageTotal + (doc.videoCount ?? 0)
                const thumbs    = doc.imageUrls.slice(0, MAX_VISIBLE_THUMBS)
                const overflows = total > thumbs.length
                return (
                  <a
                    key={doc.id}
                    className="jlist-card"
                    href={`/journal/${doc.id}`}
                    onClick={e => {
                      e.preventDefault()
                      navigate(`/journal/${doc.id}`)
                    }}
                  >
                    {doc.entryDate && (
                      <span className="jlist-card-date">{formatDate(doc.entryDate)}</span>
                    )}
                    <span className="jlist-card-title">{doc.title}</span>
                    {excerpt && (
                      <span className="jlist-card-excerpt">{excerpt}</span>
                    )}
                    {total > 0 && (
                      <div className="jlist-card-thumbs">
                        {thumbs.map((url, i) => (
                          <img key={i} src={url} alt="" className="jlist-card-thumb" loading="lazy" />
                        ))}
                        {overflows && (
                          <div className="jlist-card-thumb-more">
                            +{total - thumbs.length}
                          </div>
                        )}
                      </div>
                    )}
                  </a>
                )
              })}
            </div>
          )
        })()}

        {/* Pagination — only on the default doc list */}
        {!loading && !isSearchMode && totalPages > 1 && (
          <div className="jlist-pagination">
            <button
              className="jlist-btn"
              disabled={currentPage === 0}
              onClick={() => goToPage(currentPage - 1)}
            >
              Previous
            </button>
            <span className="jlist-page-info">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              className="jlist-btn"
              disabled={currentPage >= totalPages - 1}
              onClick={() => goToPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── Search bottom sheet (mobile) ──────────────────── */}
      {searchOpen && (
        <div className="jlist-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSearchOpen(false) }}>
          <div className="jlist-modal">
            <div className="jlist-modal-header">
              <h2 className="jlist-modal-title">Search</h2>
              <button className="jlist-modal-close" onClick={() => setSearchOpen(false)} aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="jlist-sheet-field">
              <label className="jlist-sheet-label">Keyword</label>
              <input
                className="jlist-sheet-input"
                type="text"
                placeholder="Search entries..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { handleSearch(); setSearchOpen(false) } }}
                autoFocus
              />
            </div>
            <div className="jlist-sheet-field">
              <label className="jlist-sheet-label">Date</label>
              <input
                className="jlist-sheet-input jlist-sheet-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <button className="jlist-sheet-primary-btn" onClick={() => { handleSearch(); setSearchOpen(false) }}>
              <Icon name="search" size={16} />
              Search
            </button>
            <button className="jlist-sheet-clear-link" onClick={() => { handleClear(); setSearchOpen(false) }}>
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* ── AI Search bottom sheet (mobile) ───────────────── */}
      {aiOpen && (
        <div className="jlist-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setAiOpen(false) }}>
          <div className="jlist-modal">
            <div className="jlist-modal-header">
              <h2 className="jlist-modal-title">AI Search</h2>
              <button className="jlist-modal-close" onClick={() => setAiOpen(false)} aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="jlist-sheet-field">
              <label className="jlist-sheet-label">Describe what you're looking for</label>
              <textarea
                className="jlist-sheet-input jlist-sheet-textarea"
                placeholder={'e.g. "entries about my mom"'}
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                rows={3}
                autoFocus
              />
            </div>
            <button
              className="jlist-sheet-primary-btn"
              onClick={() => { handleAiSearch(); setAiOpen(false) }}
              disabled={aiLoading}
            >
              <Icon name="ai" size={16} />
              {aiLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      )}

      {/* ── Writing Prompts Modal ─────────────────────────── */}
      {showPrompts && (
        <div className="jlist-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowPrompts(false) }}>
          <div className="jlist-modal">
            <div className="jlist-modal-header">
              <h2 className="jlist-modal-title">Writing Prompts</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="jlist-btn" onClick={openPrompts} disabled={promptsLoading} style={{ height: 32, padding: '0 12px', fontSize: 13 }}>
                  Refresh
                </button>
                <button className="jlist-modal-close" onClick={() => setShowPrompts(false)} aria-label="Close">
                  <Icon name="close" size={16} />
                </button>
              </div>
            </div>
            {promptsLoading && <p style={{ color: 'var(--label-tertiary)', fontSize: 14 }}>Generating prompts...</p>}
            {promptsError  && <p style={{ color: 'var(--label-tertiary)', fontSize: 14 }}>{promptsError}</p>}
            {!promptsLoading && prompts.length > 0 && (
              <div className="jlist-prompts-list">
                {prompts.map((prompt, i) => (
                  <a
                    key={i}
                    href={`/journal/new?prompt=${encodeURIComponent(prompt)}`}
                    className="jlist-prompt-card"
                    onClick={e => {
                      e.preventDefault()
                      setShowPrompts(false)
                      navigate(`/journal/new?prompt=${encodeURIComponent(prompt)}`)
                    }}
                  >
                    <span className="jlist-prompt-num">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="jlist-prompt-text">{prompt}</p>
                    <Icon name="chevron-right" size={16} className="jlist-prompt-chevron" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Monthly Recap Modal ───────────────────────────── */}
      {showRecap && (
        <div className="jlist-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowRecap(false) }}>
          <div className="jlist-modal">
            <div className="jlist-modal-header">
              <h2 className="jlist-modal-title">Monthly Recap</h2>
              <button className="jlist-modal-close" onClick={() => setShowRecap(false)} aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="jlist-recap-controls">
              <div className="jlist-recap-selects">
                <select
                  className="jlist-select"
                  value={recapYear}
                  onChange={e => setRecapYear(Number(e.target.value))}
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select
                  className="jlist-select"
                  value={recapMonth}
                  onChange={e => setRecapMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i).toLocaleString('en-US', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="jlist-btn jlist-btn--primary jlist-recap-generate"
                onClick={handleGenerateRecap}
                disabled={recapLoading}
              >
                <Icon name="ai" size={15} />
                {recapLoading ? 'Generating...' : 'Generate Recap'}
              </button>
            </div>
            {recapText && (
              <p className="jlist-recap-text">{recapText}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 9-card grid skeleton matching the entry card geometry while
// the personal space + first page of journal docs load.
function JournalGridSkeleton() {
  return (
    <div className="jlist-grid">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="jlist-card" style={{ pointerEvents: 'none' }}>
          <Skeleton width={90} height={13} />
          <Skeleton width="80%" height={17} style={{ marginTop: 8 }} />
          <Skeleton width="100%" height={13} style={{ marginTop: 6 }} />
          <Skeleton width="65%" height={13} style={{ marginTop: 4 }} />
        </div>
      ))}
    </div>
  )
}
