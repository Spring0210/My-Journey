import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEntries } from '@/api/journal'
import { getMySpaces } from '@/api/spaces'
import { getNotifications } from '@/api/notifications'
import { useAuth } from '@/context/AuthContext'
import type { JournalEntry, SpaceSummaryResponse, Notification } from '@/types/api'
import Icon from '@/components/ui/Icon'
import './Dashboard.css'

// ─────────────────────────────────────────────────────────
// DashboardPage — landing page after login.
// Two-column layout: main feed (recent entries + spaces)
// and sidebar (stats + recent notifications).
// ─────────────────────────────────────────────────────────

// Time-of-day greeting
function greeting(): string {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 21) return 'Good evening'
  return 'Good night'
}

// Format "YYYY-MM-DD" to "Apr 4, 2026"
function fmtDate(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// Format ISO notification timestamp to relative string
function fmtTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// Calculate consecutive-day writing streak from a sorted entry list
function calcStreak(entries: JournalEntry[]): number {
  if (!entries.length) return 0
  // Collect unique entry dates in descending order
  const dates = [...new Set(entries.map(e => e.entryDate))].sort().reverse()
  const todayStr = new Date().toISOString().slice(0, 10)

  // Streak starts counting from today or yesterday (if nothing today)
  let streak  = 0
  let cursor  = new Date()
  // If the most recent entry is not today, start from that day
  if (dates[0] !== todayStr) {
    cursor = new Date(dates[0] + 'T12:00:00')
  }

  for (const date of dates) {
    const expected = cursor.toISOString().slice(0, 10)
    if (date === expected) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else if (date < expected) {
      break // gap found — streak ends
    }
  }
  return streak
}

// Gradient palette for space covers (cycles by space id)
const COVER_GRADIENTS = [
  'var(--gradient-icon-blue)',
  'var(--gradient-icon-purple)',
  'var(--gradient-icon-orange)',
  'var(--gradient-icon-green)',
  'var(--gradient-icon-teal)',
  'var(--gradient-icon-pink)',
  'var(--gradient-icon-indigo)',
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const { userId, username } = useAuth()

  const [entries, setEntries]       = useState<JournalEntry[]>([])
  const [spaces, setSpaces]         = useState<SpaceSummaryResponse[]>([])
  const [notifications, setNotifs]  = useState<Notification[]>([])
  const [loading, setLoading]       = useState(true)

  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!userId) return
    // Fetch 30 entries to get enough data for streak + recent display
    Promise.all([
      getEntries(userId, 0, 30),
      getMySpaces(),
      getNotifications(),
    ])
      .then(([entriesPage, spacesData, notifsData]) => {
        setEntries(entriesPage.content)
        setSpaces(spacesData)
        setNotifs(notifsData)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const streak      = calcStreak(entries)
  const todayEntry  = entries.find(e => e.entryDate === todayStr) ?? null
  const recentThree = entries.filter(e => e.entryDate !== todayStr).slice(0, 3)
  const unreadNotifs = notifications.filter(n => !n.read)

  // Today's full date string for display
  const todayDisplay = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
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
          <div className="dash-body">

            {/* ── Main column ─────────────────────────── */}
            <div className="dash-main">

              {/* Greeting */}
              <div className="dash-greeting">
                <p className="dash-greeting-text">
                  {greeting()}, <span className="dash-greeting-name">@{username}</span>
                </p>
                <p className="dash-greeting-date">{todayDisplay}</p>
              </div>

              {/* Today's entry: write CTA or preview */}
              {todayEntry ? (
                /* Already wrote today — show preview card */
                <button
                  className="dash-today-card dash-today-card--written"
                  onClick={() => navigate(`/journal/${todayEntry.id}`)}
                >
                  <div className="dash-today-written-header">
                    <span className="dash-eyebrow">Today's Entry</span>
                    <Icon name="check" size={14} />
                  </div>
                  <p className="dash-today-written-title">{todayEntry.title}</p>
                  {todayEntry.content && (
                    <p className="dash-today-written-excerpt">{todayEntry.content}</p>
                  )}
                </button>
              ) : (
                /* No entry yet — prominent write CTA */
                <div className="dash-today-card dash-today-card--cta">
                  <div className="dash-today-cta-icon">
                    <Icon name="edit" size={22} />
                  </div>
                  <div className="dash-today-cta-text">
                    <p className="dash-today-cta-title">Write today's entry</p>
                    <p className="dash-today-cta-sub">
                      Capture your thoughts before the day ends.
                    </p>
                  </div>
                  <button
                    className="dash-today-cta-btn"
                    onClick={() => navigate('/journal/new')}
                  >
                    Start writing
                  </button>
                </div>
              )}

              {/* Recent journal entries */}
              {recentThree.length > 0 && (
                <section className="dash-section">
                  <div className="dash-section-header">
                    <p className="dash-eyebrow">Journal</p>
                    <button
                      className="dash-section-more"
                      onClick={() => navigate('/journal')}
                    >
                      View all
                      <Icon name="chevron-right" size={13} />
                    </button>
                  </div>
                  <div className="dash-entries-list">
                    {recentThree.map(entry => (
                      <button
                        key={entry.id}
                        className="dash-entry-card"
                        onClick={() => navigate(`/journal/${entry.id}`)}
                      >
                        <div className="dash-entry-card-inner">
                          <p className="dash-entry-date">{fmtDate(entry.entryDate)}</p>
                          <p className="dash-entry-title">{entry.title}</p>
                          {entry.content && (
                            <p className="dash-entry-excerpt">{entry.content}</p>
                          )}
                        </div>
                        {/* Thumbnail if first image exists */}
                        {entry.imagePathList.length > 0 && (
                          <img
                            src={entry.imagePathList[0]}
                            alt=""
                            className="dash-entry-thumb"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* My Spaces */}
              {spaces.length > 0 && (
                <section className="dash-section">
                  <div className="dash-section-header">
                    <p className="dash-eyebrow">Spaces</p>
                    <button
                      className="dash-section-more"
                      onClick={() => navigate('/spaces')}
                    >
                      View all
                      <Icon name="chevron-right" size={13} />
                    </button>
                  </div>
                  <div className="dash-spaces-row">
                    {spaces.slice(0, 4).map(space => (
                      <button
                        key={space.id}
                        className="dash-space-card"
                        onClick={() => navigate(`/spaces/${space.id}`)}
                      >
                        <div
                          className="dash-space-cover"
                          style={space.coverImage
                            ? { backgroundImage: `url(${space.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                            : { background: COVER_GRADIENTS[space.id % COVER_GRADIENTS.length] }
                          }
                        >
                          {!space.coverImage && (
                            <span className="dash-space-initial">
                              {space.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="dash-space-name">{space.name}</p>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Empty state — no entries, no spaces */}
              {entries.length === 0 && spaces.length === 0 && (
                <div className="dash-empty">
                  <p className="dash-empty-title">Welcome to MyJourney</p>
                  <p className="dash-empty-sub">
                    Start by writing your first journal entry or joining a space.
                  </p>
                  <div className="dash-empty-actions">
                    <button
                      className="dash-btn dash-btn--primary"
                      onClick={() => navigate('/journal/new')}
                    >
                      <Icon name="edit" size={15} />
                      Write first entry
                    </button>
                    <button
                      className="dash-btn dash-btn--ghost"
                      onClick={() => navigate('/spaces')}
                    >
                      <Icon name="spaces" size={15} />
                      Explore spaces
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Sidebar ──────────────────────────────── */}
            <aside className="dash-sidebar">

              {/* Stats card */}
              <div className="dash-card">
                <p className="dash-eyebrow" style={{ marginBottom: 14 }}>Your Activity</p>
                <div className="dash-stats">
                  <div className="dash-stat">
                    <span className="dash-stat-value">{entries.length}</span>
                    <span className="dash-stat-label">
                      {entries.length === 1 ? 'Entry' : 'Entries'}
                    </span>
                  </div>
                  <div className="dash-stat-divider" />
                  <div className="dash-stat">
                    <span className="dash-stat-value">{spaces.length}</span>
                    <span className="dash-stat-label">
                      {spaces.length === 1 ? 'Space' : 'Spaces'}
                    </span>
                  </div>
                  <div className="dash-stat-divider" />
                  <div className="dash-stat">
                    <span className="dash-stat-value dash-stat-value--streak">
                      {streak}
                    </span>
                    <span className="dash-stat-label">Day streak</span>
                  </div>
                </div>
              </div>

              {/* Notifications card */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <p className="dash-eyebrow">Notifications</p>
                  {unreadNotifs.length > 0 && (
                    <span className="dash-notif-badge">{unreadNotifs.length}</span>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <p className="dash-card-empty">No notifications yet.</p>
                ) : (
                  <>
                    <ul className="dash-notif-list">
                      {notifications.slice(0, 4).map(n => (
                        <li
                          key={n.id}
                          className={`dash-notif-item${n.read ? '' : ' dash-notif-item--unread'}`}
                          onClick={() => navigate(`/spaces/${n.spaceId}`)}
                        >
                          <span className="dash-notif-dot" />
                          <div className="dash-notif-body">
                            <p className="dash-notif-text">
                              <span className="dash-notif-actor">@{n.actorUsername}</span>
                              {' '}
                              {n.type === 'NEW_COMMENT' ? 'commented in' : 'posted in'}
                              {' '}
                              <span className="dash-notif-space">{n.spaceName}</span>
                            </p>
                            <p className="dash-notif-time">{fmtTime(n.createdAt)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <button
                      className="dash-card-more"
                      onClick={() => navigate('/notifications')}
                    >
                      View all notifications
                      <Icon name="chevron-right" size={12} />
                    </button>
                  </>
                )}
              </div>

              {/* Quick actions card */}
              <div className="dash-card">
                <p className="dash-eyebrow" style={{ marginBottom: 12 }}>Quick Actions</p>
                <div className="dash-quick-actions">
                  <button
                    className="dash-quick-btn"
                    onClick={() => navigate('/journal/new')}
                  >
                    <span className="dash-quick-icon dash-quick-icon--blue">
                      <Icon name="edit" size={16} />
                    </span>
                    <span className="dash-quick-label">New Entry</span>
                  </button>
                  <button
                    className="dash-quick-btn"
                    onClick={() => navigate('/journal')}
                  >
                    <span className="dash-quick-icon dash-quick-icon--orange">
                      <Icon name="journal" size={16} />
                    </span>
                    <span className="dash-quick-label">Journal</span>
                  </button>
                  <button
                    className="dash-quick-btn"
                    onClick={() => navigate('/calendar')}
                  >
                    <span className="dash-quick-icon dash-quick-icon--green">
                      <Icon name="calendar" size={16} />
                    </span>
                    <span className="dash-quick-label">Calendar</span>
                  </button>
                  <button
                    className="dash-quick-btn"
                    onClick={() => navigate('/spaces')}
                  >
                    <span className="dash-quick-icon dash-quick-icon--purple">
                      <Icon name="spaces" size={16} />
                    </span>
                    <span className="dash-quick-label">Spaces</span>
                  </button>
                </div>
              </div>

            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
