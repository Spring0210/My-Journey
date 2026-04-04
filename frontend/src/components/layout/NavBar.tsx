import { NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import Icon from '@/components/ui/Icon'

// ─────────────────────────────────────────────────────────
// NavBar — frosted-glass top navigation for public pages
// (Landing, Privacy, Terms). Not shown inside the app shell.
// ─────────────────────────────────────────────────────────

export default function NavBar() {
  const { isAuthenticated } = useAuth()
  const { theme, toggle } = useTheme()

  return (
    <header style={styles.nav}>
      <div style={styles.inner}>
        {/* Brand */}
        <NavLink to="/" style={styles.brand}>
          My<span style={{ color: 'var(--accent)' }}>Journey</span>
        </NavLink>

        {/* Actions */}
        <div style={styles.actions}>
          {/* Theme toggle */}
          <button
            style={styles.iconBtn}
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18} />
          </button>

          {isAuthenticated ? (
            <NavLink to="/journal" style={styles.btnPrimary}>
              Open app
            </NavLink>
          ) : (
            <>
              <NavLink to="/login" style={styles.btnGhost}>
                Sign in
              </NavLink>
              <NavLink to="/register" style={styles.btnPrimary}>
                Get started
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    height: 52,
    background: 'var(--nav-bg)',
    backdropFilter: 'saturate(180%) blur(20px)',
    WebkitBackdropFilter: 'saturate(180%) blur(20px)',
    borderBottom: '1px solid var(--separator)',
  },
  inner: {
    maxWidth: 1100,
    margin: '0 auto',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--label-primary)',
    textDecoration: 'none',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: '50%',
    color: 'var(--label-secondary)',
    cursor: 'pointer',
    transition: 'background 150ms ease',
  },
  btnGhost: {
    padding: '7px 16px',
    borderRadius: 980,
    fontSize: 14,
    fontWeight: 400,
    color: 'var(--label-primary)',
    background: 'var(--surface-secondary)',
    border: '1px solid var(--separator)',
    textDecoration: 'none',
    transition: 'background 150ms ease',
  },
  btnPrimary: {
    padding: '7px 16px',
    borderRadius: 980,
    fontSize: 14,
    fontWeight: 400,
    color: '#ffffff',
    background: 'var(--accent)',
    textDecoration: 'none',
    transition: 'background 150ms ease',
  },
}
