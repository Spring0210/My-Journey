import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, beforeEach, expect, vi } from 'vitest'

import LandingPage from './LandingPage'

// useFadeInOnScroll relies on IntersectionObserver, which jsdom does not
// implement. Stub a no-op so the component renders without throwing.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
}

describe('LandingPage', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  })

  it('leads with the knowledge-base + AI headline', () => {
    renderPage()
    // Headline is split across lines, so match the fragments.
    expect(screen.getByText(/The knowledge base/)).toBeInTheDocument()
    expect(screen.getByText(/your AI can use\./)).toBeInTheDocument()
  })

  it('renders all four core value props', () => {
    renderPage()
    expect(screen.getByText('Personal & team spaces')).toBeInTheDocument()
    expect(screen.getByText('Write & organize docs')).toBeInTheDocument()
    expect(screen.getByText('In-app AI chat')).toBeInTheDocument()
    expect(screen.getByText('Reachable by any AI')).toBeInTheDocument()
  })

  it('highlights the in-app agent generating a document', () => {
    renderPage()
    // Hero shows the agent invoking create_document and the resulting doc.
    expect(screen.getByText('create_document')).toBeInTheDocument()
    expect(screen.getByText(/Created "Launch Plan"/)).toBeInTheDocument()
  })

  it('shows the MCP section with an external AI updating a document', () => {
    renderPage()
    expect(
      screen.getByText('Reachable from the tools you already use'),
    ).toBeInTheDocument()
    // External Claude updates real document content via update_document.
    expect(screen.getByText('update_document')).toBeInTheDocument()
    // The status row still exposes the public MCP endpoint.
    expect(screen.getByText(/myjourneycloud\.com\/mcp/)).toBeInTheDocument()
  })

  it('no longer uses the legacy journaling copy', () => {
    renderPage()
    expect(screen.queryByText(/Your journal\./)).not.toBeInTheDocument()
    expect(screen.queryByText('Private Journal')).not.toBeInTheDocument()
  })

  it('points the primary calls-to-action at registration', () => {
    renderPage()
    const getStarted = screen.getByRole('link', { name: /get started free/i })
    expect(getStarted).toHaveAttribute('href', '/register')
    const createAccount = screen.getByRole('link', { name: /create your account/i })
    expect(createAccount).toHaveAttribute('href', '/register')
  })
})
