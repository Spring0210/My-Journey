import { useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import Icon from '@/components/ui/Icon'

// ─────────────────────────────────────────────────────────
// Sidebar — main app navigation.
// Desktop: fixed left panel (260px).
// Mobile: off-canvas drawer controlled by `isOpen` prop.
// ─────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  notificationCount?: number
}

interface NavItem {
  to: string
  icon: React.ComponentProps<typeof Icon>['name']
  label: string
  badge?: number
}

export default function Sidebar({ isOpen, onClose, notificationCount = 0 }: SidebarProps) {
  const { username, avatarUrl, logout } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const sidebarRef = useRef<HTMLElement>(null)

  // Close drawer when clicking the backdrop on mobile
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  // Close drawer on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const navItems: NavItem[] = [
    { to: '/journal',       icon: 'journal',  label: 'Journal' },
    { to: '/calendar',      icon: 'calendar', label: 'Calendar' },
    { to: '/spaces',        icon: 'spaces',   label: 'Spaces' },
    {
      to: '/notifications',
      icon: 'bell',
      label: 'Notifications',
      badge: notificationCount > 0 ? notificationCount : undefined,
    },
  ]

  const sidebarContent = (
    <aside ref={sidebarRef} style={styles.sidebar}>
      {/* Brand */}
      <div style={styles.header}>
        <span style={styles.brand}>
          My<span style={{ color: 'var(--accent)' }}>Journey</span>
        </span>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        <p style={styles.sectionLabel}>Personal</p>
        <ul style={styles.navList}>
          {navItems.slice(0, 2).map(item => (
            <NavItem key={item.to} item={item} onClose={onClose} />
          ))}
        </ul>

        <p style={styles.sectionLabel}>Social</p>
        <ul style={styles.navList}>
          {navItems.slice(2).map(item => (
            <NavItem key={item.to} item={item} onClose={onClose} />
          ))}
        </ul>
      </nav>

      {/* Bottom: user info + theme toggle + logout */}
      <div style={styles.bottom}>
        <div style={styles.divider} />

        {/* Theme toggle */}
        <button style={styles.themeRow} onClick={toggleTheme} aria-label="Toggle theme">
          <div style={styles.themeIconWrap}>
            <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={16} />
          </div>
          <span style={styles.themeLabel}>
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          <div style={styles.themeToggleTrack} data-on={theme === 'dark'}>
            <div style={thumbStyle(theme === 'dark')} />
          </div>
        </button>

        {/* User row */}
        <NavLink to="/profile" style={{ textDecoration: 'none' }} onClick={onClose}>
          {({ isActive }) => (
            <div style={{ ...styles.userRow, ...(isActive ? styles.userRowActive : {}) }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={username ?? ''} style={styles.avatar} />
              ) : (
                <div style={styles.avatarPlaceholder}>
                  <Icon name="user" size={16} />
                </div>
              )}
              <span style={styles.username}>{username}</span>
              <button
                style={styles.logoutBtn}
                onClick={e => { e.preventDefault(); handleLogout() }}
                aria-label="Sign out"
                title="Sign out"
              >
                <Icon name="logout" size={16} />
              </button>
            </div>
          )}
        </NavLink>
      </div>
    </aside>
  )

  // Mobile: render as overlay drawer; desktop: render inline
  return (
    <>
      {/* Desktop sidebar — hidden on mobile via .sidebar-desktop-wrapper CSS rule */}
      <div className="sidebar-desktop-wrapper" style={styles.desktopWrapper}>
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div style={styles.mobileOverlay} onClick={handleBackdropClick}>
          <div style={styles.mobileDrawer}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}

// ── NavItem sub-component ─────────────────────────────────

function NavItem({ item, onClose }: { item: NavItem; onClose: () => void }) {
  return (
    <li>
      <NavLink
        to={item.to}
        onClick={onClose}
        style={({ isActive }) => ({
          ...styles.navLink,
          ...(isActive ? styles.navLinkActive : {}),
        })}
      >
        <Icon name={item.icon} size={18} strokeWidth={isActive(item.to) ? 2 : 1.5} />
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.badge !== undefined && (
          <span style={styles.badge}>{item.badge > 99 ? '99+' : item.badge}</span>
        )}
      </NavLink>
    </li>
  )
}

// Tiny helper — NavLink isActive is only available inside the render prop
function isActive(_to: string): boolean { return false }

// ── Dynamic style helpers ─────────────────────────────────

function thumbStyle(on: boolean): React.CSSProperties {
  return {
    position: 'absolute',
    top: 2,
    left: on ? 18 : 2,
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: on ? 'var(--accent)' : 'var(--label-tertiary)',
    transition: 'left 200ms ease, background 200ms ease',
  }
}

// ── Inline styles ─────────────────────────────────────────
// Using inline styles so the sidebar works with CSS variables
// without needing to escape Tailwind's dark: variant for everything.

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 260,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--surface-secondary)',
    padding: '12px 8px',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px 12px',
  },
  brand: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--label-primary)',
  },
  nav: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--label-tertiary)',
    padding: '12px 12px 4px',
  },
  navList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 400,
    color: 'var(--label-secondary)',
    textDecoration: 'none',
    marginBottom: 2,
    transition: 'background var(--ease-micro), color var(--ease-micro)',
  },
  navLinkActive: {
    // macOS Finder style: subtle tint background + accent text — not solid blue fill
    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  badge: {
    background: 'var(--system-red)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: 980,
    marginLeft: 'auto',
  },
  bottom: {
    marginTop: 'auto',
    paddingTop: 8,
  },
  divider: {
    height: 1,
    background: 'var(--separator)',
    margin: '8px 12px 12px',
  },
  themeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '8px 12px',
    borderRadius: 10,
    fontSize: 14,
    color: 'var(--label-secondary)',
    cursor: 'pointer',
    marginBottom: 4,
    transition: 'background 150ms ease',
  },
  themeIconWrap: {
    width: 22,
    display: 'flex',
    justifyContent: 'center',
    color: 'var(--label-secondary)',
  },
  themeLabel: {
    flex: 1,
    textAlign: 'left' as const,
    fontSize: 14,
    color: 'var(--label-secondary)',
  },
  themeToggleTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    background: 'var(--surface-tertiary)',
    border: '1px solid var(--separator)',
    position: 'relative' as const,
    flexShrink: 0,
    transition: 'background 200ms ease',
  },
  // themeToggleThumb is a dynamic function — see thumbStyle() above
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'background 150ms ease',
    textDecoration: 'none',
  },
  userRowActive: {
    background: 'var(--surface-tertiary)',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    objectFit: 'cover' as const,
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--surface-tertiary)',
    border: '1px solid var(--separator)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--label-secondary)',
    flexShrink: 0,
  },
  username: {
    flex: 1,
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--label-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 8,
    color: 'var(--label-tertiary)',
    cursor: 'pointer',
    transition: 'color 150ms ease',
    flexShrink: 0,
  },
  desktopWrapper: {
    display: 'flex',
    height: '100vh',
    position: 'sticky' as const,
    top: 0,
    flexShrink: 0,
  },
  mobileOverlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 200,
    background: 'rgba(0,0,0,0.40)',
    // No display:none — visibility is controlled by conditional {isOpen && ...} rendering
  },
  mobileDrawer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    background: 'var(--surface-secondary)',
    boxShadow: 'var(--shadow-floating)',
    animation: 'drawer-in 250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
}
