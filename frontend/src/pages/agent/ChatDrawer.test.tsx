import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChatDrawer from './ChatDrawer'

describe('ChatDrawer', () => {
  it('renders children inside the aside', () => {
    render(
      <ChatDrawer onClose={() => {}}>
        <div data-testid="child">inner</div>
      </ChatDrawer>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByLabelText('AI chat')).toBeInTheDocument()
  })

  it('calls onClose when the overlay backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <ChatDrawer onClose={onClose}>
        <div data-testid="child">x</div>
      </ChatDrawer>,
    )
    // Click the overlay itself (the role=presentation wrapper).
    const overlay = screen.getByRole('presentation')
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT call onClose when a click bubbles up from inside the aside', () => {
    const onClose = vi.fn()
    render(
      <ChatDrawer onClose={onClose}>
        <button data-testid="inner-btn">x</button>
      </ChatDrawer>,
    )
    fireEvent.click(screen.getByTestId('inner-btn'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
