import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, vi, beforeEach, expect } from 'vitest'

import McpAccessPage from './McpAccessPage'
import { ToastProvider } from '@/components/feedback'
import * as mcpApi from '@/api/mcp'

// The page uses useToast() (for error/success toasts on async failures);
// ToastProvider lives in AppLayout in production but the test renders the
// page in isolation, so we wrap explicitly here.
function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <McpAccessPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

vi.mock('@/api/mcp')

// PageTopBar's hamburger uses AppLayoutContext.openSidebar -- provide a
// minimal stub so render doesn't crash on screens where the sidebar shell
// would normally be present.
vi.mock('@/context/AppLayoutContext', () => ({
  useAppLayout: () => ({ openSidebar: vi.fn() }),
}))

describe('McpAccessPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('renders the user tokens in a list', async () => {
    vi.mocked(mcpApi.listMcpTokens).mockResolvedValue([
      {
        id: 1,
        name: 'Claude Desktop',
        prefix: 'mj_abcde',
        createdAt: '2026-05-20T12:00:00Z',
        lastUsedAt: null,
        expiredAt: '2026-06-19T12:00:00Z',
      },
    ])
    vi.mocked(mcpApi.listMcpActivity).mockResolvedValue([])

    renderPage()

    // "Claude Desktop" also appears as a tab label in the Connect-your-client
     // section, so scope this match to the token row (a <div>, not a button).
    await waitFor(() => {
      expect(screen.getByText('Claude Desktop', { selector: 'div' })).toBeInTheDocument()
      expect(screen.getByText(/mj_abcde/)).toBeInTheDocument()
    })
  })

  it('reveals the raw token only once after creation', async () => {
    vi.mocked(mcpApi.listMcpTokens).mockResolvedValue([])
    vi.mocked(mcpApi.listMcpActivity).mockResolvedValue([])
    vi.mocked(mcpApi.createMcpToken).mockResolvedValue({
      token: {
        id: 99,
        name: 'My Mac',
        prefix: 'mj_xyz12',
        createdAt: '2026-05-21T10:00:00Z',
        lastUsedAt: null,
        expiredAt: '2026-06-20T10:00:00Z',
      },
      rawToken: 'mj_xyz12_RAW_SECRET',
    })

    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /new token/i }))
    await userEvent.type(screen.getByLabelText(/name/i), 'My Mac')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))

    expect(await screen.findByText('mj_xyz12_RAW_SECRET')).toBeInTheDocument()

    // Dismiss the reveal panel; the raw token should no longer be in the DOM
    await userEvent.click(screen.getByRole('button', { name: /i've copied it/i }))
    expect(screen.queryByText('mj_xyz12_RAW_SECRET')).not.toBeInTheDocument()
  })

  it('switches the connection snippet when changing client type', async () => {
    vi.mocked(mcpApi.listMcpTokens).mockResolvedValue([])
    vi.mocked(mcpApi.listMcpActivity).mockResolvedValue([])

    renderPage()

    // Default tab is Claude Desktop — JSON snippet should be visible
    await screen.findByRole('tab', { name: /claude desktop/i })
    expect(screen.getByText(/"mcpServers"/)).toBeInTheDocument()

    // Switch to Claude Code — CLI command appears, JSON gone
    await userEvent.click(screen.getByRole('tab', { name: /claude code/i }))
    expect(screen.getByText(/claude mcp add --transport http/)).toBeInTheDocument()
    expect(screen.queryByText(/"mcpServers"/)).not.toBeInTheDocument()

    // Switch to Test — curl command appears
    await userEvent.click(screen.getByRole('tab', { name: /^test$/i }))
    expect(
      screen.getByText(/curl -sS https:\/\/myjourneycloud\.com\/mcp/),
    ).toBeInTheDocument()
  })

  it('revokes a token when the revoke button is clicked', async () => {
    vi.mocked(mcpApi.listMcpTokens)
      .mockResolvedValueOnce([
        {
          id: 7, name: 'Old', prefix: 'mj_old123',
          createdAt: '2026-05-01T00:00:00Z', lastUsedAt: null,
          expiredAt: '2026-05-31T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce([])
    vi.mocked(mcpApi.listMcpActivity).mockResolvedValue([])
    vi.mocked(mcpApi.revokeMcpToken).mockResolvedValue(undefined as unknown as void)

    renderPage()

    // Open the confirm modal (row button uses aria-label="Revoke token")
    await userEvent.click(await screen.findByRole('button', { name: /revoke token/i }))
    await userEvent.click(await screen.findByRole('button', { name: /yes, revoke/i }))

    await waitFor(() => expect(mcpApi.revokeMcpToken).toHaveBeenCalledWith(7))
  })
})
