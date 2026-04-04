import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { apiRequest } from '@/api/client'
import { AppLayoutContext } from '@/context/AppLayoutContext'

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
    apiRequest<{ count: number }>('/notifications/unread-count')
      .then(data => setNotifCount(data.count))
      .catch(() => { /* ignore — badge stays at 0 */ })
  }, [])

  return (
    // Provide openSidebar to all pages so PageTopBar can trigger the mobile drawer
    <AppLayoutContext.Provider value={{ openSidebar: () => setSidebarOpen(true) }}>
      <div style={styles.shell}>
        {/* Desktop sidebar — always visible */}
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

        {/* Main content area — PageTopBar inside each page handles the top bar */}
        <div style={styles.main}>
          <main style={styles.content}>
            <Outlet />
          </main>
        </div>
      </div>
    </AppLayoutContext.Provider>
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
    height: '100vh',        // constrain height so sticky works within this scroll container
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,            // prevent flex overflow
    overflowX: 'hidden',
    overflowY: 'auto',      // explicit scroll container — required for position:sticky in pages
  },
  content: {
    // Each page controls its own padding, background, and content width.
    flex: 1,
    minWidth: 0,
  },
}
