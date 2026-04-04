import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEntries } from '@/api/journal'
import { useAuth } from '@/context/AuthContext'
import type { JournalEntry } from '@/types/api'
import Icon from '@/components/ui/Icon'
import './Dashboard.css'

// ─────────────────────────────────────────────────────────
// DashboardPage — minimal single-column landing page.
// Focus: write today's entry + glance at recent entries.
// ─────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 21) return 'Good evening'
  return 'Good night'
}

function fmtDate(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { userId, username } = useAuth()

  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!userId) return
    getEntries(userId, 0, 10)
      .then(data => setEntries(data.content))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const todayEntry  = entries.find(e => e.entryDate === todayStr) ?? null
  const recentFour  = entries.filter(e => e.entryDate !== todayStr).slice(0, 4)

  const todayDisplay = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <div className="dash-page">

      {/* ── Desktop sticky top bar ─────────────────────── */}
      <header className="dash-topbar">
        <div className="dash-topbar-inner">
          <h1 className="dash-topbar-title">Dashboard</h1>
        </div>
      </header>

      <div className="dash-inner">
        {loading ? (
          <div className="dash-loading">Loading...</div>
        ) : (
          <>
            {/* Greeting */}
            <div className="dash-greeting">
              <p className="dash-greeting-line">
                {greeting()},{' '}
                <span className="dash-greeting-name">@{username}</span>
              </p>
              <p className="dash-greeting-date">{todayDisplay}</p>
            </div>

            {/* Today's entry */}
            {todayEntry ? (
              /* Already wrote today */
              <button
                className="dash-today dash-today--written"
                onClick={() => navigate(`/journal/${todayEntry.id}`)}
              >
                <div className="dash-today-written-meta">
                  <span className="dash-today-written-check">
                    <Icon name="check" size={13} />
                  </span>
                  <span className="dash-today-written-label">Today's entry</span>
                  <span className="dash-today-written-date">{fmtDate(todayEntry.entryDate)}</span>
                </div>
                <p className="dash-today-written-title">{todayEntry.title}</p>
                {todayEntry.content && (
                  <p className="dash-today-written-excerpt">{todayEntry.content}</p>
                )}
              </button>
            ) : (
              /* Nothing written yet */
              <div className="dash-today dash-today--cta">
                <div className="dash-today-cta-left">
                  <p className="dash-today-cta-title">Write today's entry</p>
                  <p className="dash-today-cta-sub">Capture your thoughts before the day ends.</p>
                </div>
                <button
                  className="dash-today-cta-btn"
                  onClick={() => navigate('/journal/new')}
                >
                  Start writing
                </button>
              </div>
            )}

            {/* Recent entries */}
            {recentFour.length > 0 && (
              <section className="dash-recent">
                <div className="dash-recent-header">
                  <span className="dash-recent-title">Recent</span>
                  <button
                    className="dash-recent-all"
                    onClick={() => navigate('/journal')}
                  >
                    View all
                    <Icon name="chevron-right" size={13} />
                  </button>
                </div>

                <div className="dash-entry-list">
                  {recentFour.map((entry, i) => (
                    <button
                      key={entry.id}
                      className={`dash-entry-row${i < recentFour.length - 1 ? ' dash-entry-row--border' : ''}`}
                      onClick={() => navigate(`/journal/${entry.id}`)}
                    >
                      <div className="dash-entry-row-inner">
                        <p className="dash-entry-row-date">{fmtDate(entry.entryDate)}</p>
                        <p className="dash-entry-row-title">{entry.title}</p>
                        {entry.content && (
                          <p className="dash-entry-row-excerpt">{entry.content}</p>
                        )}
                      </div>
                      <Icon name="chevron-right" size={15} className="dash-entry-row-arrow" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* First-time empty state */}
            {entries.length === 0 && (
              <div className="dash-empty">
                <p className="dash-empty-title">Your journal is empty</p>
                <p className="dash-empty-sub">Write your first entry to get started.</p>
                <button
                  className="dash-empty-btn"
                  onClick={() => navigate('/journal/new')}
                >
                  <Icon name="edit" size={15} />
                  Write first entry
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
