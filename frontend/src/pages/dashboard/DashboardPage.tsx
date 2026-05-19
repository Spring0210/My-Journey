import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEntries } from '@/api/journal'
import { useAuth } from '@/context/AuthContext'
import type { JournalEntry } from '@/types/api'
import Icon from '@/components/ui/Icon'
import PageTopBar from '@/components/ui/PageTopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import EmptyJournal from '@/components/ui/illustrations/EmptyJournal'
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

// MONTH + day split, for the date pill on each recent entry row
function dateParts(s: string): { month: string; day: string } {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return {
    month: dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(dt.getDate()),
  }
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

      <PageTopBar title="Dashboard" />

      <div className="dash-inner">
        {loading ? (
          <DashboardSkeleton />
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
                  {/* Icon + title on same row */}
                  <div className="dash-today-cta-header">
                    <div className="dash-today-cta-icon">
                      <Icon name="edit" size={20} />
                    </div>
                    <p className="dash-today-cta-title">Write today's entry</p>
                  </div>
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

            {/* Explore shortcuts — Journal + Spaces quick navigation */}
            <section className="dash-explore">
              <span className="dash-section-label">Explore</span>
              <div className="dash-explore-grid">
                <button
                  className="dash-explore-card dash-explore-card--journal"
                  onClick={() => navigate('/journal')}
                >
                  <div className="dash-explore-card-icon">
                    <Icon name="journal" size={22} />
                  </div>
                  <p className="dash-explore-card-title">My Journal</p>
                  <p className="dash-explore-card-sub">View all entries</p>
                </button>
                <button
                  className="dash-explore-card dash-explore-card--spaces"
                  onClick={() => navigate('/spaces')}
                >
                  <div className="dash-explore-card-icon">
                    <Icon name="spaces" size={22} />
                  </div>
                  <p className="dash-explore-card-title">Spaces</p>
                  <p className="dash-explore-card-sub">Discover communities</p>
                </button>
              </div>
            </section>

            {/* Recent entries */}
            {recentFour.length > 0 && (
              <section className="dash-recent">
                <div className="dash-recent-header">
                  <span className="dash-section-label">Recent</span>
                  <button
                    className="dash-recent-all"
                    onClick={() => navigate('/journal')}
                  >
                    View all
                    <Icon name="chevron-right" size={13} />
                  </button>
                </div>

                <div className="dash-entry-list">
                  {recentFour.map((entry, i) => {
                    const { month, day } = dateParts(entry.entryDate)
                    return (
                      <button
                        key={entry.id}
                        className={`dash-entry-row${i < recentFour.length - 1 ? ' dash-entry-row--border' : ''}`}
                        onClick={() => navigate(`/journal/${entry.id}`)}
                      >
                        <div className="dash-entry-row-pill">
                          <span className="dash-entry-row-pill-month">{month}</span>
                          <span className="dash-entry-row-pill-day">{day}</span>
                        </div>
                        <div className="dash-entry-row-inner">
                          <p className="dash-entry-row-title">{entry.title}</p>
                          {entry.content && (
                            <p className="dash-entry-row-excerpt">{entry.content}</p>
                          )}
                        </div>
                        {entry.imagePathList[0] && (
                          <img
                            src={entry.imagePathList[0]}
                            alt=""
                            className="dash-entry-row-thumb"
                          />
                        )}
                        <Icon name="chevron-right" size={15} className="dash-entry-row-arrow" />
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* First-time empty state */}
            {entries.length === 0 && (
              <EmptyState
                illustration={<EmptyJournal />}
                title="Your journal is empty"
                subtitle="Write your first entry to get started."
                action={
                  <button
                    className="dash-empty-btn"
                    onClick={() => navigate('/journal/new')}
                  >
                    <Icon name="edit" size={15} />
                    Write first entry
                  </button>
                }
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// DashboardSkeleton — placeholder shapes that mirror the
// loaded layout: greeting, today card, explore grid, recent rows.
// ─────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <>
      {/* Greeting */}
      <div className="dash-greeting">
        <Skeleton width={260} height={28} radius={8} />
        <Skeleton width={180} height={15} style={{ marginTop: 4 }} />
      </div>

      {/* Today card */}
      <Skeleton width="100%" height={120} radius={22} />

      {/* Explore section */}
      <div className="dash-explore">
        <Skeleton width={80} height={13} />
        <div className="dash-explore-grid" style={{ marginTop: 12 }}>
          <Skeleton height={100} radius={18} />
          <Skeleton height={100} radius={18} />
        </div>
      </div>

      {/* Recent rows */}
      <div className="dash-recent">
        <div className="dash-recent-header">
          <Skeleton width={70} height={13} />
          <Skeleton width={60} height={13} />
        </div>
        <div className="dash-entry-list" style={{ marginTop: 12 }}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`dash-entry-row${i < 3 ? ' dash-entry-row--border' : ''}`}
              style={{ pointerEvents: 'none' }}
            >
              <Skeleton width={48} height={56} radius={12} />
              <div style={{ flex: 1, marginLeft: 12 }}>
                <Skeleton width="70%" height={15} />
                <Skeleton width="90%" height={13} style={{ marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
