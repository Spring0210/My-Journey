import { NavLink } from 'react-router-dom'

// ─────────────────────────────────────────────────────────
// Footer — shown on all public pages.
// Copyright year: 2026. Contact entity: Ben X.
// ─────────────────────────────────────────────────────────

export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        <span style={styles.copy}>
          Copyright &copy; 2026 Ben X. All rights reserved.
        </span>
        <nav aria-label="Legal">
          <ul style={styles.links}>
            <li><NavLink to="/privacy" style={styles.link}>Privacy Policy</NavLink></li>
            <li><NavLink to="/terms"   style={styles.link}>Terms of Service</NavLink></li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    borderTop: '1px solid var(--separator)',
    background: 'var(--surface-secondary)',
    padding: '32px 24px',
  },
  inner: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  copy: {
    fontSize: 13,
    color: 'var(--label-tertiary)',
  },
  links: {
    display: 'flex',
    gap: 20,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  link: {
    fontSize: 13,
    color: 'var(--label-secondary)',
    textDecoration: 'none',
    transition: 'color 150ms ease',
  },
}
