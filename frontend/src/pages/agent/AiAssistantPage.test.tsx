import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AiAssistantPage from './AiAssistantPage'

// Mock the agent + spaces APIs so the rendered ChatPanel inside the page
// doesn't try to hit fetch. The point of this test is just to verify the
// page's shape: title in the topbar, ChatPanel mounted in cross-space mode
// (scope chip "All my spaces"), personal space resolved.
vi.mock('@/api/agent', () => ({
  listAgentConversations: vi.fn().mockResolvedValue([]),
  getAgentMessages: vi.fn(),
  streamAgentChat: vi.fn(),
}))
vi.mock('@/api/spaces', () => ({
  getPersonalSpace: vi.fn().mockResolvedValue({
    id: 42, name: 'Personal', description: null, coverImage: null,
    inviteCode: '', role: 'OWNER', ownerUsername: 'alice', isPersonal: true,
  }),
}))

// PageTopBar's hamburger uses AppLayoutContext.openSidebar -- provide a
// minimal stub so render doesn't crash.
vi.mock('@/context/AppLayoutContext', () => ({
  useAppLayout: () => ({ openSidebar: vi.fn() }),
}))

import * as spacesApi from '@/api/spaces'

describe('AiAssistantPage', () => {
  it('renders the topbar title and mounts ChatPanel in cross-space mode', async () => {
    render(<MemoryRouter><AiAssistantPage /></MemoryRouter>)

    // Topbar title.
    expect(screen.getByText('AI Assistant')).toBeInTheDocument()

    // Cross-space mode scope chip (appears after personal space resolves
    // but the chip text itself is rendered immediately based on the
    // spaceId=null prop, so it should show without waiting).
    expect(screen.getByText(/All my spaces/i)).toBeInTheDocument()

    // Personal space resolution kicks off on mount.
    await waitFor(() => {
      expect(spacesApi.getPersonalSpace).toHaveBeenCalledTimes(1)
    })
  })
})
