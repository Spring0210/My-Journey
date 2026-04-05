import { useState, useEffect, useCallback } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  getEntries, searchEntries, aiSearch, aiRecap, aiPrompts,
} from '@/api/journal'
import type { JournalEntry } from '@/types/api'
import Icon from '@/components/ui/Icon'
import PageTopBar from '@/components/ui/PageTopBar'
import './JournalList.css'

// ─────────────────────────────────────────────────────────
// JournalListPage — paginated entry list with keyword/date
// search, AI search, writing prompts, and monthly recap.
// ─────────────────────────────────────────────────────────

const PAGE_SIZE = 9

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function JournalListPage() {
  const { userId } = useAuth()
  const [searchParams] = useSearchParams()

  // ── Entry list state ──────────────────────────────────
  const [entries, setEntries]     = useState<JournalEntry[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages]   = useState(0)
  const [loading, setLoading]         = useState(true)
  const [isSearchMode, setIsSearchMode] = useState(false)

  // ── Search state ──────────────────────────────────────
  const [keyword, setKeyword] = useState('')
  const [date, setDate]       = useState('')

  // ── AI search state ───────────────────────────────────
  const [aiQuery, setAiQuery]     = useState('')
  const [aiMeta, setAiMeta]       = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // ── Mobile collapsible panel states ──────────────────
  const [searchOpen, setSearchOpen] = useState(false)
  const [aiOpen, setAiOpen]         = useState(false)

  // ── Modal state ───────────────────────────────────────
  const [showPrompts, setShowPrompts]     = useState(false)
  const [prompts, setPrompts]             = useState<string[]>([])
  const [promptsLoading, setPromptsLoading] = useState(false)
  const [promptsError, setPromptsError]   = useState('')

  const [showRecap, setShowRecap]         = useState(false)
  const [recapYear, setRecapYear]         = useState(new Date().getFullYear())
  const [recapMonth, setRecapMonth]       = useState(new Date().getMonth() + 1)
  const [recapText, setRecapText]         = useState('')
  const [recapLoading, setRecapLoading]   = useState(false)

  // ── Load entries ──────────────────────────────────────
  const loadEntries = useCallback(async (page: number) => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getEntries(userId, page, PAGE_SIZE)
      setEntries(data.content)
      setCurrentPage(data.currentPage)
      setTotalPages(data.totalPages)
      setIsSearchMode(false)
      setAiMeta('')
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Pre-filter by date from calendar navigation
  useEffect(() => {
    const dateParam = searchParams.get('date')
    if (dateParam && userId) {
      setDate(dateParam)
      setIsSearchMode(true)
      setLoading(true)
      searchEntries(userId, '', dateParam)
        .then(results => { setEntries(results); setTotalPages(0) })
        .catch(() => setEntries([]))
        .finally(() => setLoading(false))
    } else {
      loadEntries(0)
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyword / date search ──────────────────────────────
  function handleSearch() {
    if (!userId) return
    setIsSearchMode(true)
    setAiMeta('')
    setLoading(true)
    searchEntries(userId, keyword, date)
      .then(results => { setEntries(results); setTotalPages(0) })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }

  function handleClear() {
    setKeyword('')
    setDate('')
    setAiQuery('')
    setAiMeta('')
    loadEntries(0)
  }

  // ── AI search ─────────────────────────────────────────
  async function handleAiSearch() {
    if (!aiQuery.trim()) return
    setAiLoading(true)
    setIsSearchMode(true)
    setAiMeta('')
    setEntries([])
    try {
      const data = await aiSearch(aiQuery.trim())
      if (data.keywords?.length) {
        setAiMeta(`Matched keywords: ${data.keywords.join(', ')}`)
      }
      setEntries(data.entries ?? [])
      setTotalPages(0)
    } catch {
      setEntries([])
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

  const years = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - i,
  )

  // ── Render ────────────────────────────────────────────
  return (
    <div className="jlist-page">

      <PageTopBar
        title="My Journal"
        actions={
          <>
            <button className="jlist-btn jlist-btn--topbar" onClick={() => { setShowRecap(true); setRecapText('') }}>
              <Icon name="ai" size={16} />
              <span className="jlist-btn-label">Monthly Recap</span>
            </button>
            <button className="jlist-btn jlist-btn--topbar" onClick={openPrompts}>
              <Icon name="journal" size={16} />
              <span className="jlist-btn-label">Writing Prompts</span>
            </button>
            <NavLink to="/journal/new" className="jlist-btn jlist-btn--primary jlist-btn--topbar">
              <Icon name="plus" size={16} />
              New entry
            </NavLink>
          </>
        }
      />

      <div className="jlist-inner">

        {/* ── Desktop: search toolbar + AI row ──────────── */}
        <div className="jlist-desktop-bar">
          <div className="jlist-toolbar">
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
            <div className="jlist-toolbar-btns">
              <button className="jlist-btn" onClick={handleSearch}>Search</button>
              <button className="jlist-btn" onClick={handleClear}>Clear</button>
            </div>
          </div>

          <div className="jlist-ai-row">
            <input
              className="jlist-ai-input"
              type="text"
              placeholder='AI search — try "entries about my mom"'
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
            />
            <button className="jlist-btn" onClick={handleAiSearch} disabled={aiLoading}>
              <Icon name="ai" size={15} />
              {aiLoading ? 'Searching...' : 'AI Search'}
            </button>
          </div>
        </div>

        {/* ── Mobile layout ──────────────────────────────── */}
        <div className="jlist-mobile-bar">

          {/* 4-icon quick action grid — icon + label, each with a distinct color */}
          <div className="jlist-quick-actions">
            <button
              className={`jlist-qa jlist-qa--search${searchOpen ? ' jlist-qa--active' : ''}`}
              onClick={() => { setSearchOpen(v => !v); setAiOpen(false) }}
            >
              <div className="jlist-qa-icon"><Icon name="search" size={20} /></div>
              <span className="jlist-qa-label">Search</span>
            </button>
            <button
              className="jlist-qa jlist-qa--recap"
              onClick={() => { setShowRecap(true); setRecapText('') }}
            >
              <div className="jlist-qa-icon"><Icon name="calendar" size={20} /></div>
              <span className="jlist-qa-label">Recap</span>
            </button>
            <button className="jlist-qa jlist-qa--prompts" onClick={openPrompts}>
              <div className="jlist-qa-icon"><Icon name="journal" size={20} /></div>
              <span className="jlist-qa-label">Prompts</span>
            </button>
            <button
              className={`jlist-qa jlist-qa--ai${aiOpen ? ' jlist-qa--active' : ''}`}
              onClick={() => { setAiOpen(v => !v); setSearchOpen(false) }}
            >
              <div className="jlist-qa-icon"><Icon name="ai" size={20} /></div>
              <span className="jlist-qa-label">AI Search</span>
            </button>
          </div>

          {/* Collapsible: keyword + date search */}
          {searchOpen && (
            <div className="jlist-mobile-filters">
              <input
                className="jlist-mobile-input"
                type="text"
                placeholder="Search by keyword..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <div className="jlist-filter-row">
                <input
                  className="jlist-input jlist-date-input"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
                <button className="jlist-search-btn" onClick={handleSearch}>Search</button>
                <button className="jlist-clear-btn" onClick={handleClear}>Clear</button>
              </div>
            </div>
          )}

          {/* Collapsible: AI search */}
          {aiOpen && (
            <div className="jlist-mobile-filters">
              <div className="jlist-filter-row">
                <input
                  className="jlist-ai-input"
                  type="text"
                  placeholder='e.g. "entries about my mom"'
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
                />
                <button className="jlist-filter-btn" onClick={handleAiSearch} disabled={aiLoading}>
                  <Icon name="ai" size={15} />
                  {aiLoading ? '...' : 'Search'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI match metadata — shown on both desktop and mobile */}
        {aiMeta && <p className="jlist-ai-meta">{aiMeta}</p>}

        {/* Entry grid */}
        {loading ? (
          <div className="jlist-empty">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="jlist-empty">
            {isSearchMode ? 'No entries found.' : 'No entries yet. Write your first one!'}
          </div>
        ) : (
          <div className="jlist-grid">
            {entries.map(entry => (
              <NavLink
                key={entry.id}
                to={`/journal/${entry.id}`}
                className="jlist-card"
              >
                <span className="jlist-card-date">{formatDate(entry.entryDate)}</span>
                <span className="jlist-card-title">{entry.title}</span>
                {entry.content && (
                  <span className="jlist-card-excerpt">{entry.content}</span>
                )}
                {entry.imagePathList?.length > 0 && (
                  <div className="jlist-card-thumbs">
                    {entry.imagePathList.slice(0, 3).map((url, i) => (
                      <img key={i} src={url} alt="" className="jlist-card-thumb" />
                    ))}
                    {entry.imagePathList.length > 3 && (
                      <div className="jlist-card-thumb-more">
                        +{entry.imagePathList.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isSearchMode && totalPages > 1 && (
          <div className="jlist-pagination">
            <button
              className="jlist-btn"
              disabled={currentPage === 0}
              onClick={() => loadEntries(currentPage - 1)}
            >
              Previous
            </button>
            <span className="jlist-page-info">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              className="jlist-btn"
              disabled={currentPage >= totalPages - 1}
              onClick={() => loadEntries(currentPage + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>

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
                  <NavLink
                    key={i}
                    to={`/journal/new?prompt=${encodeURIComponent(prompt)}`}
                    className="jlist-prompt-card"
                    onClick={() => setShowPrompts(false)}
                  >
                    <p className="jlist-prompt-text">{prompt}</p>
                    <span className="jlist-prompt-cta">Write now</span>
                  </NavLink>
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
              <button
                className="jlist-btn jlist-btn--primary"
                onClick={handleGenerateRecap}
                disabled={recapLoading}
                style={{ height: 36 }}
              >
                {recapLoading ? 'Generating...' : 'Generate'}
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
