import type { ReactNode } from 'react'
import './EmptyState.css'

// ─────────────────────────────────────────────────────────
// EmptyState — centered illustration + title + subtitle
// + optional action button.  Renders inside any container.
// ─────────────────────────────────────────────────────────

interface EmptyStateProps {
  illustration: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function EmptyState({
  illustration, title, subtitle, action,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-illustration">{illustration}</div>
      <p className="empty-state-title">{title}</p>
      {subtitle && <p className="empty-state-subtitle">{subtitle}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}
