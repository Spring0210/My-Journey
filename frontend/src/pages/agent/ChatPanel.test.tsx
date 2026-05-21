import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ChatPanel, { renderTextWithCitations } from './ChatPanel'

// The api module is mocked so the component never hits fetch. streamAgentChat
// is the trickiest one -- we expose the handlers it was called with so tests
// can drive the meta/delta/done lifecycle synchronously.
vi.mock('@/api/agent', () => {
  const mocks = {
    listAgentConversations: vi.fn(),
    getAgentMessages: vi.fn(),
    streamAgentChat: vi.fn(),
  }
  return mocks
})

// Cross-space mode resolves the user's personal space via this helper.
vi.mock('@/api/spaces', () => ({
  getPersonalSpace: vi.fn(),
}))

// Re-import the mocked modules so tests can configure return values per case.
import * as agentApi from '@/api/agent'
import * as spacesApi from '@/api/spaces'

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ChatPanel', () => {
  it('renders the empty state when the space has no prior conversation', async () => {
    vi.mocked(agentApi.listAgentConversations).mockResolvedValue([])

    renderWithRouter(<ChatPanel spaceId={1} spaceName="Team" />)

    expect(await screen.findByText(/Ask me anything/i)).toBeInTheDocument()
    expect(screen.getByText(/Searching: Team/i)).toBeInTheDocument()
    expect(agentApi.listAgentConversations).toHaveBeenCalledWith(1)
  })

  it('loads and renders the most recent conversation on mount', async () => {
    vi.mocked(agentApi.listAgentConversations).mockResolvedValue([
      {
        id: 7,
        spaceId: 1,
        title: 't',
        createdAt: '2026-05-20T00:00:00Z',
        updatedAt: '2026-05-20T00:00:00Z',
      },
    ])
    vi.mocked(agentApi.getAgentMessages).mockResolvedValue([
      {
        id: 1,
        role: 'USER',
        content: [{ type: 'text', text: 'hi' }],
        createdAt: '2026-05-20T00:00:00Z',
      },
      {
        id: 2,
        role: 'ASSISTANT',
        content: [{ type: 'text', text: 'hello back' }],
        createdAt: '2026-05-20T00:00:01Z',
      },
      {
        id: 3,
        role: 'TOOL',
        content: [{ type: 'tool_result', tool_use_id: 't', content: 'x' }],
        createdAt: '2026-05-20T00:00:02Z',
      },
    ])

    renderWithRouter(<ChatPanel spaceId={1} spaceName="Team" />)

    expect(await screen.findByText('hi')).toBeInTheDocument()
    expect(await screen.findByText('hello back')).toBeInTheDocument()
    // TOOL turn is internal and must not surface to the UI.
    expect(screen.queryByText(/tool_result/)).not.toBeInTheDocument()
  })

  it('sends a message on Enter and streams the delta into the assistant bubble', async () => {
    vi.mocked(agentApi.listAgentConversations).mockResolvedValue([])
    vi.mocked(agentApi.streamAgentChat).mockImplementation((_req, handlers) => {
      // Synchronously drive the SSE lifecycle: meta first, then a single
      // delta, then done.
      handlers.onMeta?.({ conversationId: 42 })
      handlers.onDelta?.({ text: 'Sure, here you go.' })
      handlers.onDone?.()
      return new AbortController()
    })

    renderWithRouter(<ChatPanel spaceId={1} spaceName="Team" />)

    const textarea = await screen.findByLabelText(/chat message/i)
    fireEvent.change(textarea, { target: { value: 'what about onboarding?' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(agentApi.streamAgentChat).toHaveBeenCalledTimes(1)
    const [req] = vi.mocked(agentApi.streamAgentChat).mock.calls[0]
    expect(req).toEqual({
      spaceId: 1,
      conversationId: undefined,
      message: 'what about onboarding?',
    })

    expect(await screen.findByText('what about onboarding?')).toBeInTheDocument()
    expect(await screen.findByText('Sure, here you go.')).toBeInTheDocument()
  })

  it('does not send on Shift+Enter (allows newline)', async () => {
    vi.mocked(agentApi.listAgentConversations).mockResolvedValue([])
    renderWithRouter(<ChatPanel spaceId={1} spaceName="Team" />)

    const textarea = await screen.findByLabelText(/chat message/i)
    fireEvent.change(textarea, { target: { value: 'wip' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(agentApi.streamAgentChat).not.toHaveBeenCalled()
  })

  it('disables the Send button when the input is empty', async () => {
    vi.mocked(agentApi.listAgentConversations).mockResolvedValue([])
    renderWithRouter(<ChatPanel spaceId={1} spaceName="Team" />)

    const send = await screen.findByRole('button', { name: /send/i })
    expect(send).toBeDisabled()
  })

  it('shows an error message in the assistant bubble when the stream fails', async () => {
    vi.mocked(agentApi.listAgentConversations).mockResolvedValue([])
    vi.mocked(agentApi.streamAgentChat).mockImplementation((_, handlers) => {
      handlers.onError?.({ message: 'HTTP 500' })
      return new AbortController()
    })

    renderWithRouter(<ChatPanel spaceId={1} spaceName="Team" />)
    const textarea = await screen.findByLabelText(/chat message/i)
    fireEvent.change(textarea, { target: { value: 'die' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText(/something went wrong: HTTP 500/i)).toBeInTheDocument()
    })
  })

  it('invokes onClose when the close button is clicked', async () => {
    vi.mocked(agentApi.listAgentConversations).mockResolvedValue([])
    const onClose = vi.fn()

    renderWithRouter(<ChatPanel spaceId={1} spaceName="Team" onClose={onClose} />)

    fireEvent.click(await screen.findByLabelText(/close chat/i))
    expect(onClose).toHaveBeenCalledOnce()
  })

  // -- Cross-space mode (spaceId=null) ---------------------------------

  it('cross-space: scope chip reads "All my spaces", spaceName is ignored', async () => {
    vi.mocked(spacesApi.getPersonalSpace).mockResolvedValue({
      id: 99, name: 'Personal', description: null, coverImage: null,
      inviteCode: "", role: 'OWNER', ownerUsername: 'alice', isPersonal: true,
    })
    vi.mocked(agentApi.listAgentConversations).mockResolvedValue([])

    renderWithRouter(<ChatPanel spaceId={null} spaceName="Ignored" />)

    expect(await screen.findByText(/All my spaces/i)).toBeInTheDocument()
    expect(screen.queryByText(/Ignored/)).not.toBeInTheDocument()
  })

  it('cross-space: resolves personal space and lists conversations under it', async () => {
    vi.mocked(spacesApi.getPersonalSpace).mockResolvedValue({
      id: 99, name: 'Personal', description: null, coverImage: null,
      inviteCode: "", role: 'OWNER', ownerUsername: 'alice', isPersonal: true,
    })
    vi.mocked(agentApi.listAgentConversations).mockResolvedValue([])

    renderWithRouter(<ChatPanel spaceId={null} spaceName="" />)

    await waitFor(() => {
      expect(spacesApi.getPersonalSpace).toHaveBeenCalledTimes(1)
      expect(agentApi.listAgentConversations).toHaveBeenCalledWith(99)
    })
  })

  it('cross-space: send includes crossSpace=true and anchors at personal space id', async () => {
    vi.mocked(spacesApi.getPersonalSpace).mockResolvedValue({
      id: 99, name: 'Personal', description: null, coverImage: null,
      inviteCode: "", role: 'OWNER', ownerUsername: 'alice', isPersonal: true,
    })
    vi.mocked(agentApi.listAgentConversations).mockResolvedValue([])
    vi.mocked(agentApi.streamAgentChat).mockImplementation((_req, handlers) => {
      handlers.onDelta?.({ text: 'cross-space reply' })
      handlers.onDone?.()
      return new AbortController()
    })

    renderWithRouter(<ChatPanel spaceId={null} spaceName="" />)

    // Wait for personal space to resolve before typing.
    await waitFor(() => expect(agentApi.listAgentConversations).toHaveBeenCalled())

    const textarea = await screen.findByLabelText(/chat message/i)
    fireEvent.change(textarea, { target: { value: 'what did I write last week?' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => expect(agentApi.streamAgentChat).toHaveBeenCalled())
    const [req] = vi.mocked(agentApi.streamAgentChat).mock.calls[0]
    expect(req).toEqual({
      spaceId: 99,
      conversationId: undefined,
      message: 'what did I write last week?',
      crossSpace: true,
    })
  })
})

describe('renderTextWithCitations', () => {
  it('renders [doc:42] as a clickable span', () => {
    const onClick = vi.fn()
    const parts = renderTextWithCitations('See [doc:42] for context.', onClick)
    // Mix of strings and spans -- assert by length + types rather than DOM,
    // since we're testing the pure function.
    expect(parts).toHaveLength(3)
    expect(parts[0]).toBe('See ')
    expect(parts[2]).toBe(' for context.')
  })

  it('returns plain text unchanged when no citations are present', () => {
    const parts = renderTextWithCitations('No citations here.', vi.fn())
    expect(parts).toEqual(['No citations here.'])
  })
})
