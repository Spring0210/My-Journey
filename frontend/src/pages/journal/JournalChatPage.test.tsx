import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JournalChatPage from './JournalChatPage'

// Mock the underlying agent API + spaces API so ChatPanel doesn't try to
// hit fetch. The test verifies the page resolves the personal space and
// mounts ChatPanel scoped to it (single-space mode, scope chip shows the
// space name -- NOT "All my spaces").
vi.mock('@/api/agent', () => ({
  listAgentConversations: vi.fn().mockResolvedValue([]),
  getAgentMessages: vi.fn(),
  streamAgentChat: vi.fn(),
}))
vi.mock('@/api/spaces', () => ({
  getPersonalSpace: vi.fn(),
}))
vi.mock('@/context/AppLayoutContext', () => ({
  useAppLayout: () => ({ openSidebar: vi.fn() }),
}))

import * as spacesApi from '@/api/spaces'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('JournalChatPage', () => {
  it('resolves the personal space then mounts ChatPanel scoped to it', async () => {
    vi.mocked(spacesApi.getPersonalSpace).mockResolvedValue({
      id: 7, name: 'My Journal', description: null, coverImage: null,
      inviteCode: '', role: 'OWNER', ownerUsername: 'alice', isPersonal: true,
    })

    render(<MemoryRouter><JournalChatPage /></MemoryRouter>)

    // Topbar title shows immediately.
    expect(screen.getByText('Journal AI')).toBeInTheDocument()

    // ChatPanel mounts after the personal space resolves. The scope chip
    // shows the space name (single-space mode), NOT "All my spaces".
    await waitFor(() => {
      expect(screen.getByText(/Searching: My Journal/)).toBeInTheDocument()
    })
    expect(screen.queryByText(/All my spaces/)).not.toBeInTheDocument()
  })

  it('does not crash when personal space resolution fails', async () => {
    vi.mocked(spacesApi.getPersonalSpace).mockRejectedValue(new Error('network'))

    render(<MemoryRouter><JournalChatPage /></MemoryRouter>)

    // Topbar still renders; ChatPanel just doesn't mount.
    expect(screen.getByText('Journal AI')).toBeInTheDocument()
    await waitFor(() => {
      expect(spacesApi.getPersonalSpace).toHaveBeenCalled()
    })
    // No scope chip because ChatPanel never mounted.
    expect(screen.queryByText(/Searching:/)).not.toBeInTheDocument()
  })
})
