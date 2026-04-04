import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Icon from '@/components/ui/Icon'
import { apiRequest } from '@/api/client'

// ─────────────────────────────────────────────────────────
// AppLayout — shell for all authenticated pages.
// Desktop: fixed sidebar (260px) + scrollable main content.
// Mobile (≤768px): hidden sidebar, hamburger button in
// a top bar opens it as a slide-in overlay drawer.
// ─────────────────────────────────────────────────────────

const MOBILE_BREAKPOINT = 768

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile]       = useState(window.innerWidth <= MOBILE_BREAKPOINT)
  const [notifCount, setNotifCount]   = useState(0)

  // Detect viewport size changes
  useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(false) // auto-close drawer when going wide
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Fetch unread notification count for the sidebar badge
  useEffect(() => {
    apiRequest<{ unreadCount: number }>('/notifications/unread-count')
      .then(data => setNotifCount(data.unreadCount))
      .catch(() => { /* ignore — badge stays at 0 */ })
  }, [])

  return (
    <div style={styles.shell}>
      {/* Sidebar — hidden on mobile unless sidebarOpen */}
      {!isMobile && (
        <Sidebar
          isOpen={false}
          onClose={() => {}}
          notificationCount={notifCount}
        />
      )}

      {/* Mobile drawer overlay */}
      {isMobile && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          notificationCount={notifCount}
        />
      )}

      {/* Main content area */}
      <div style={styles.main}>
        {/* Mobile top bar with hamburger */}
        {isMobile && (
          <div style={styles.mobileTopBar}>
            <button
              style={styles.hamburger}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" size={20} />
            </button>
            <span style={styles.mobileBrand}>
              My<span style={{ color: 'var(--accent)' }}>Journey</span>
            </span>
            {/* Spacer to keep brand centered */}
            <div style={{ width: 36 }} />
          </div>
        )}

        {/* Page content — each page renders via <Outlet /> */}
        <main style={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--surface-primary)',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0, // prevent flex overflow
    overflowX: 'hidden',
  },
  mobileTopBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    padding: '0 16px',
    background: 'var(--nav-bg)',
    backdropFilter: 'saturate(180%) blur(20px)',
    WebkitBackdropFilter: 'saturate(180%) blur(20px)',
    borderBottom: '1px solid var(--separator)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  hamburger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 8,
    color: 'var(--label-primary)',
    cursor: 'pointer',
  },
  mobileBrand: {
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--label-primary)',
  },
  content: {
    // No padding or maxWidth here — each page component controls its own
    // padding, background color, and content width.
    flex: 1,
    minWidth: 0,  // prevent flex overflow on narrow screens
    overflowX: 'hidden',
  },
}
