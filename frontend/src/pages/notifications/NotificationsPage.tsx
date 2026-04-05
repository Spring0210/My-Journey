import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getNotifications,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
} from '@/api/notifications'
import type { Notification } from '@/types/api'
import Icon from '@/components/ui/Icon'
import PageTopBar from '@/components/ui/PageTopBar'
import { useAppLayout } from '@/context/AppLayoutContext'
import './Notifications.css'

// ─────────────────────────────────────────────────────────
// NotificationsPage — inbox-style list of all notifications.
// ─────────────────────────────────────────────────────────

// Notification type → human-readable sentence fragment
function describeType(type: string): string {
  if (type === 'NEW_POST')    return 'posted in'
  if (type === 'NEW_COMMENT') return 'commented in'
  return 'activity in'
}

// Format ISO datetime to relative time string
function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { refreshNotifCount } = useAppLayout()

  const [notifs, setNotifs]   = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const unreadCount = notifs.filter(n => !n.read).length

  // ── Load notifications on mount ───────────────────────
  useEffect(() => {
    getNotifications()
      .then(setNotifs)
      .catch(() => setNotifs([]))
      .finally(() => setLoading(false))
  }, [])

  // ── Mark all as read ──────────────────────────────────
  async function handleMarkAllRead() {
    try {
      await markAllRead()
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
      refreshNotifCount() // update sidebar badge
    } catch {
      // Silently ignore — list still visible
    }
  }

  // ── Delete single notification ─────────────────────────
  async function handleDelete(id: number, e: React.MouseEvent) {
    // Prevent the row click from firing
    e.stopPropagation()
    try {
      await deleteNotification(id)
      setNotifs(prev => prev.filter(n => n.id !== id))
      refreshNotifCount() // update sidebar badge
    } catch {
      // Silently ignore
    }
  }

  // ── Delete all notifications ───────────────────────────
  async function handleDeleteAll() {
    if (!confirm('Clear all notifications?')) return
    try {
      await deleteAllNotifications()
      setNotifs([])
      refreshNotifCount() // update sidebar badge
    } catch {
      // Silently ignore
    }
  }

  // ── Click a notification row ───────────────────────────
  // Mark it read locally and navigate to the space
  async function handleRowClick(notif: Notification) {
    if (!notif.read) {
      // Optimistically mark this one read and refresh sidebar badge
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
      refreshNotifCount()
    }
    navigate(`/spaces/${notif.spaceId}`)
  }

  return (
    <div className="notif-page">

      <PageTopBar
        title="Notifications"
        actions={
          <>
            {unreadCount > 0 && (
              <span className="notif-topbar-badge">{unreadCount}</span>
            )}
            {unreadCount > 0 && (
              <button className="notif-btn notif-btn--topbar" onClick={handleMarkAllRead}>
                <Icon name="check" size={14} />
                <span className="notif-btn-label">Mark all read</span>
              </button>
            )}
            {notifs.length > 0 && (
              <button className="notif-btn notif-btn--topbar" onClick={handleDeleteAll}>
                <Icon name="trash" size={14} />
                <span className="notif-btn-label">Clear all</span>
              </button>
            )}
          </>
        }
      />

      <div className="notif-inner">


        {/* Notification list */}
        {loading ? (
          <div className="notif-empty">Loading...</div>
        ) : notifs.length === 0 ? (
          <div className="notif-empty">
            <div className="notif-empty-icon">
              <Icon name="bell" size={36} />
            </div>
            <p className="notif-empty-title">No notifications</p>
            <p className="notif-empty-sub">You're all caught up.</p>
          </div>
        ) : (
          <ul className="notif-list">
            {notifs.map(notif => (
              <li key={notif.id} className={`notif-item${notif.read ? '' : ' notif-item--unread'}`}>
                <button
                  className="notif-row"
                  onClick={() => handleRowClick(notif)}
                >
                  {/* Unread dot */}
                  <span className="notif-dot" aria-hidden="true" />

                  {/* Actor avatar */}
                  <div className="notif-avatar">
                    {notif.actorAvatar
                      ? <img src={notif.actorAvatar} alt="" />
                      : notif.actorUsername.charAt(0).toUpperCase()
                    }
                  </div>

                  {/* Text content */}
                  <div className="notif-body">
                    <p className="notif-text">
                      <span className="notif-actor">@{notif.actorUsername}</span>
                      {' '}
                      {describeType(notif.type)}
                      {' '}
                      <span className="notif-space">{notif.spaceName}</span>
                    </p>
                    <p className="notif-time">{formatTime(notif.createdAt)}</p>
                  </div>

                  {/* Notification type icon */}
                  <div className="notif-type-icon">
                    {notif.type === 'NEW_COMMENT'
                      ? <Icon name="send" size={13} />
                      : <Icon name="spaces" size={13} />
                    }
                  </div>
                </button>

                {/* Delete button — outside the main row button */}
                <button
                  className="notif-delete-btn"
                  onClick={e => handleDelete(notif.id, e)}
                  aria-label="Delete notification"
                >
                  <Icon name="close" size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
