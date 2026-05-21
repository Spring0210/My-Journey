import ChatPanel from '@/pages/agent/ChatPanel'
import PageTopBar from '@/components/ui/PageTopBar'

// ─────────────────────────────────────────────────────────
// AiAssistantPage — global "AI Assistant" entry reached from the
// sidebar nav (and /ai directly). Renders ChatPanel in cross-space
// mode so the agent searches across every space the user belongs to.
//
// The same component serves both desktop and mobile -- on desktop the
// sidebar stays visible alongside the page; on mobile the sidebar
// drawer closes when the user navigates here. No drawer overlay is
// needed because this is a route, not an in-page toggle.
// ─────────────────────────────────────────────────────────

export default function AiAssistantPage() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PageTopBar title="AI Assistant" />
      <div style={{ flex: 1, minHeight: 0 }}>
        {/* spaceId=null triggers cross-space mode -- ChatPanel resolves the
            user's personal space as the conversation anchor and tells the
            backend to use the cross-space system prompt. */}
        <ChatPanel spaceId={null} spaceName="" />
      </div>
    </div>
  )
}
