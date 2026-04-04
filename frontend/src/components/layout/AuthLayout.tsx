import { Outlet } from 'react-router-dom'
import { useTheme } from '@/context/ThemeContext'
import Icon from '@/components/ui/Icon'

// ─────────────────────────────────────────────────────────
// AuthLayout — centered card shell for Login, Register,
// Forgot Password. No sidebar, no full nav bar.
// ─────────────────────────────────────────────────────────

export default function AuthLayout() {
  const { theme, toggle } = useTheme()

  return (
    <div style={styles.bg}>
      {/* Minimal header with brand + theme toggle */}
      <header style={styles.header}>
        <a href="/" style={styles.brand}>
          My<span style={{ color: 'var(--accent)' }}>Journey</span>
        </a>
        <button
          style={styles.themeBtn}
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18} />
        </button>
      </header>

      {/* Centered content card */}
      <main style={styles.main}>
        <Outlet />
      </main>

      {/* Minimal footer */}
      <footer style={styles.footer}>
        <span style={styles.copy}>
          Copyright &copy; 2026 Ben X.
        </span>
        <span style={styles.dot} aria-hidden>·</span>
        <a href="/privacy" style={styles.link}>Privacy</a>
        <span style={styles.dot} aria-hidden>·</span>
        <a href="/terms"   style={styles.link}>Terms</a>
      </footer>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--surface-secondary)',
    // Subtle radial glow at the top — same pattern as the landing page hero
    backgroundImage: 'var(--gradient-hero-glow)',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '100% 60%',
    backgroundPosition: 'center top',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--label-primary)',
    textDecoration: 'none',
  },
  themeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: '50%',
    color: 'var(--label-secondary)',
    cursor: 'pointer',
    background: 'var(--surface-tertiary)',
  },
  main: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px 48px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '20px 24px',
  },
  copy: {
    fontSize: 12,
    color: 'var(--label-tertiary)',
  },
  dot: {
    fontSize: 12,
    color: 'var(--label-tertiary)',
  },
  link: {
    fontSize: 12,
    color: 'var(--label-secondary)',
    textDecoration: 'none',
  },
}
