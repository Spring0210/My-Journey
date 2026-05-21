import { useEffect, useState } from 'react'
import ChatPanel from '@/pages/agent/ChatPanel'
import PageTopBar from '@/components/ui/PageTopBar'
import { getPersonalSpace } from '@/api/spaces'
import type { SpaceSummaryResponse } from '@/types/api'

// ─────────────────────────────────────────────────────────
// JournalChatPage — mobile full-page chat scoped to the user's personal
// space. Reached from /journal's "Ask AI" topbar button at < 768 px;
// desktop opens an in-place drawer instead. The chat is scoped to the
// personal space (not cross-space), so the agent sees only the user's
// journal/personal docs -- matching the module-specific intent of the
// entry point.
// ─────────────────────────────────────────────────────────

export default function JournalChatPage() {
  const [personal, setPersonal] = useState<SpaceSummaryResponse | null>(null)

  useEffect(() => {
    getPersonalSpace()
      .then(setPersonal)
      .catch(() => setPersonal(null))
  }, [])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PageTopBar title="Journal AI" backTo="/journal" backLabel="Journal" />
      <div style={{ flex: 1, minHeight: 0 }}>
        {personal && (
          <ChatPanel spaceId={personal.id} spaceName={personal.name} />
        )}
      </div>
    </div>
  )
}
