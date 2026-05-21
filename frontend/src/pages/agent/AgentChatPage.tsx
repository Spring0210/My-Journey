import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ChatPanel from '@/pages/agent/ChatPanel'
import PageTopBar from '@/components/ui/PageTopBar'
import { getSpaceDetail } from '@/api/spaces'
import type { SpaceDetailResponse } from '@/types/api'

// ─────────────────────────────────────────────────────────
// Full-page chat used on mobile (< 768 px). Desktop keeps the drawer in
// SpaceDetailPage. Both surfaces share ChatPanel; only the chrome differs.
// ─────────────────────────────────────────────────────────

export default function AgentChatPage() {
  const { id } = useParams<{ id: string }>()
  const [space, setSpace] = useState<SpaceDetailResponse | null>(null)

  useEffect(() => {
    if (!id) return
    getSpaceDetail(Number(id))
      .then(setSpace)
      .catch(() => setSpace(null))
  }, [id])

  if (!id) return null

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PageTopBar
        title={space?.name ?? 'Ask AI'}
        backTo={`/spaces/${id}`}
        backLabel="Space"
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatPanel spaceId={Number(id)} spaceName={space?.name ?? 'this space'} />
      </div>
    </div>
  )
}
