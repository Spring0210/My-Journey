import { useNavigate } from 'react-router-dom'
import Icon from '@/components/ui/Icon'
import { useAppLayout } from '@/context/AppLayoutContext'
import './PageTopBar.css'

// ─────────────────────────────────────────────────────────
// PageTopBar — shared sticky top bar for all app pages.
//
// Behavior:
//   • Always sticky + frosted glass (mobile + desktop).
//   • backTo provided → show ← back button (all sizes).
//   • backTo absent   → show hamburger (mobile only).
//   • actions         → rendered on the right side.
// ─────────────────────────────────────────────────────────

interface PageTopBarProps {
  title: string
  // If provided, shows a ← back button that navigates to this path.
  backTo?: string
  // Optional right-side action buttons.
  actions?: React.ReactNode
  // Optional label next to the back chevron (defaults to "Back").
  backLabel?: string
}

export default function PageTopBar({
  title,
  backTo,
  actions,
  backLabel = 'Back',
}: PageTopBarProps) {
  const navigate = useNavigate()
  const { openSidebar } = useAppLayout()

  return (
    <div className="page-topbar">
      <div className="page-topbar-inner">

        {/* Left button */}
        <div className="page-topbar-left">
          {backTo ? (
            // Back button — visible on all screen sizes
            <button
              className="page-topbar-back"
              onClick={() => navigate(backTo)}
              aria-label="Go back"
            >
              <Icon name="chevron-left" size={20} />
              <span className="page-topbar-back-label">{backLabel}</span>
            </button>
          ) : (
            // Hamburger — CSS hides it on desktop (≥769px)
            <button
              className="page-topbar-icon-btn page-topbar-hamburger"
              onClick={openSidebar}
              aria-label="Open menu"
            >
              <Icon name="menu" size={20} />
            </button>
          )}
        </div>

        {/* Page title */}
        <h1 className="page-topbar-title">{title}</h1>

        {/* Right-side actions */}
        {actions && (
          <div className="page-topbar-right">
            {actions}
          </div>
        )}

      </div>
    </div>
  )
}
