import { Outlet } from 'react-router-dom'
import NavBar from './NavBar'
import Footer from './Footer'

// ─────────────────────────────────────────────────────────
// PublicLayout — shell for public pages (Landing, Privacy,
// Terms of Service). Shows the top NavBar and Footer.
// ─────────────────────────────────────────────────────────

export default function PublicLayout() {
  return (
    <div style={styles.wrapper}>
      <NavBar />
      <main style={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: 'var(--surface-primary)',
  },
  main: {
    flex: 1,
  },
}
