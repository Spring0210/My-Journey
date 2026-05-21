import './ChatDrawer.css'

// ─────────────────────────────────────────────────────────
// ChatDrawer — right-side slide-in overlay used by every module-scoped
// "Ask AI" entry (SpaceDetailPage, JournalListPage today). Owns the
// backdrop dismissal behaviour and visual chrome; the caller passes in
// a ChatPanel as children and the onClose callback used by both the
// backdrop click and the ChatPanel's own close button.
//
// Hidden via CSS on mobile -- mobile entries navigate to a dedicated
// route instead of opening this drawer, so this component is desktop-only
// in practice.
// ─────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
  children: React.ReactNode
}

export default function ChatDrawer({ onClose, children }: Props) {
  return (
    <div
      className="chat-drawer-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="presentation"
    >
      <aside className="chat-drawer-aside" aria-label="AI chat">
        {children}
      </aside>
    </div>
  )
}
