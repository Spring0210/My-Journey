// ─────────────────────────────────────────────────────────
// Agent chat API — typed wrappers for /api/agent + SSE helper.
//
// The non-streaming endpoints go through the shared apiRequest helper
// (auth header, 401 → refresh). The streaming chat endpoint can't use
// EventSource because that's GET-only; we POST a JSON body and read the
// response stream by hand, parsing SSE frames as they arrive.
// ─────────────────────────────────────────────────────────

import { apiRequest } from './client'
import type {
  AgentConversation,
  AgentMessage,
  AgentChatRequest,
  AgentChatMeta,
  AgentChatDelta,
  AgentChatError,
} from '@/types/agent'

export function listAgentConversations(spaceId: number): Promise<AgentConversation[]> {
  return apiRequest(`/agent/conversations?spaceId=${spaceId}`)
}

export function getAgentMessages(conversationId: number): Promise<AgentMessage[]> {
  return apiRequest(`/agent/conversations/${conversationId}/messages`)
}

export interface ChatStreamHandlers {
  onMeta?:  (m: AgentChatMeta)  => void
  onDelta?: (d: AgentChatDelta) => void
  onDone?:  () => void
  onError?: (e: AgentChatError) => void
}

// Opens an SSE stream for one assistant turn. Returns the AbortController
// so the caller can cancel mid-stream (e.g. on unmount). Caller is
// responsible for the loading state -- this helper only emits events.
export function streamAgentChat(
  req: AgentChatRequest,
  handlers: ChatStreamHandlers,
): AbortController {
  const ctrl = new AbortController()
  const token = localStorage.getItem('token') || ''

  void (async () => {
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(req),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) {
        handlers.onError?.({ message: `HTTP ${res.status}` })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      // SSE frames are separated by a blank line (\n\n). We parse
      // incrementally so partial frames don't get dropped on read boundaries.
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let idx: number
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          dispatchFrame(frame, handlers)
        }
      }
      handlers.onDone?.()
    } catch (err: unknown) {
      const name = (err as { name?: string } | null)?.name
      if (name !== 'AbortError') {
        const message = err instanceof Error ? err.message : String(err)
        handlers.onError?.({ message })
      }
    }
  })()

  return ctrl
}

// Parse one SSE frame and dispatch to the matching handler. Exported for
// unit testing -- the streaming logic above is hard to test directly, but
// the frame parser is pure.
export function dispatchFrame(frame: string, handlers: ChatStreamHandlers): void {
  const event = parseSseFrame(frame)
  if (!event) return
  let data: unknown
  try {
    data = JSON.parse(event.data)
  } catch {
    return
  }
  if (event.name === 'meta')  handlers.onMeta?.(data as AgentChatMeta)
  if (event.name === 'delta') handlers.onDelta?.(data as AgentChatDelta)
  if (event.name === 'done')  handlers.onDone?.()
  if (event.name === 'error') handlers.onError?.(data as AgentChatError)
}

// SSE frame format: `event: <name>\n` (optional) followed by one or more
// `data: <chunk>` lines. Multiple data lines are joined with newlines per
// the spec; we keep that behaviour faithful.
export function parseSseFrame(frame: string): { name: string; data: string } | null {
  const lines = frame.split('\n')
  let name = 'message'
  const dataLines: string[] = []
  for (const line of lines) {
    if (line.startsWith('event:')) name = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }
  if (dataLines.length === 0) return null
  return { name, data: dataLines.join('\n') }
}
