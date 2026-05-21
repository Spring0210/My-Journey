import { describe, it, expect, vi } from 'vitest'
import { parseSseFrame, dispatchFrame } from './agent'
import type { ChatStreamHandlers } from './agent'

// Unit-level coverage of the SSE parser + dispatcher in api/agent.ts.
// The full streamAgentChat helper isn't tested here because it depends on
// fetch streaming semantics that aren't easily simulated -- the parser
// pieces it relies on are tested instead.

describe('parseSseFrame', () => {
  it('parses event + single data line', () => {
    const out = parseSseFrame('event: delta\ndata: {"text":"hi"}')
    expect(out).toEqual({ name: 'delta', data: '{"text":"hi"}' })
  })

  it('defaults the event name to "message" when no event line is present', () => {
    expect(parseSseFrame('data: {"x":1}')).toEqual({ name: 'message', data: '{"x":1}' })
  })

  it('joins multiple data lines with newlines per the spec', () => {
    const out = parseSseFrame('event: delta\ndata: line one\ndata: line two')
    expect(out).toEqual({ name: 'delta', data: 'line one\nline two' })
  })

  it('returns null for empty / data-less frames', () => {
    expect(parseSseFrame('event: ping')).toBeNull()
    expect(parseSseFrame('')).toBeNull()
  })
})

describe('dispatchFrame', () => {
  it('routes meta / delta / done / error to the matching handler', () => {
    const handlers: ChatStreamHandlers = {
      onMeta:  vi.fn(),
      onDelta: vi.fn(),
      onDone:  vi.fn(),
      onError: vi.fn(),
    }

    dispatchFrame('event: meta\ndata: {"conversationId":42}', handlers)
    dispatchFrame('event: delta\ndata: {"text":"hi"}', handlers)
    dispatchFrame('event: done\ndata: {}', handlers)
    dispatchFrame('event: error\ndata: {"message":"oops"}', handlers)

    expect(handlers.onMeta).toHaveBeenCalledWith({ conversationId: 42 })
    expect(handlers.onDelta).toHaveBeenCalledWith({ text: 'hi' })
    expect(handlers.onDone).toHaveBeenCalledTimes(1)
    expect(handlers.onError).toHaveBeenCalledWith({ message: 'oops' })
  })

  it('silently drops frames whose data is not valid JSON', () => {
    const onDelta = vi.fn()
    dispatchFrame('event: delta\ndata: not-json', { onDelta })
    expect(onDelta).not.toHaveBeenCalled()
  })

  it('ignores frames with no data section', () => {
    const onMeta = vi.fn()
    dispatchFrame('event: meta', { onMeta })
    expect(onMeta).not.toHaveBeenCalled()
  })
})
