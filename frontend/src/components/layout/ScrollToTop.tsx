import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Scrolls the window to the top on every pathname change.
// Mounted inside <BrowserRouter> in App.tsx. Renders nothing.
//
// Why behavior: 'instant':
//   tokens.css declares `html { scroll-behavior: smooth }`. Without an explicit
//   'instant' override, every route change would visibly slow-scroll to top,
//   which looks broken. The `as ScrollBehavior` cast is needed because some
//   lib.dom typings still omit 'instant' from the enum even though all current
//   browsers support it.
//
// Why depend only on pathname:
//   Listening to the full location object would re-fire on hash changes too,
//   which would break in-page anchor links (e.g. /docs#section).
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])

  return null
}
