import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listAgentConversations,
  getAgentMessages,
  streamAgentChat,
} from '@/api/agent'
import { getPersonalSpace } from '@/api/spaces'
import type { AgentConversation, AgentMessage } from '@/types/agent'
import './ChatPanel.css'

// ─────────────────────────────────────────────────────────
// ChatPanel — the actual chat UI. Used by both the desktop drawer
// (mounted from SpaceDetailPage) and the mobile full-page route
// (/spaces/:id/chat). The parent owns the chrome (drawer overlay vs
// PageTopBar); this component owns the conversation thread + composer.
//
// Pass spaceId={null} to render in "all my spaces" cross-space mode --
// the panel resolves the user's personal space as the conversation
// anchor and sets crossSpace=true on the wire so the agent switches its
// system prompt accordingly. spaceName is then ignored.
// ─────────────────────────────────────────────────────────

interface Props {
  spaceId: number | null
  spaceName: string
  // Optional close callback. The drawer wires this; the full-page mobile
  // wrapper leaves it undefined and uses PageTopBar's back button instead.
  onClose?: () => void
}

interface UiMessage {
  role: 'USER' | 'ASSISTANT'
  text: string
}

export default function ChatPanel({ spaceId, spaceName, onClose }: Props) {
  const navigate = useNavigate()
  const crossSpace = spaceId === null
  // In cross-space mode the conversation row still needs a real space anchor;
  // we resolve the user's personal space once and reuse it. anchorSpaceId is
  // undefined until that resolution completes (so we don't fire half-formed
  // requests against an unknown space).
  const [anchorSpaceId, setAnchorSpaceId] = useState<number | undefined>(
    crossSpace ? undefined : (spaceId as number),
  )
  const [conversationId, setConversationId] = useState<number | undefined>()
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const ctrlRef   = useRef<AbortController | null>(null)

  // In cross-space mode, resolve the user's personal space once.
  useEffect(() => {
    if (!crossSpace) return
    let cancelled = false
    getPersonalSpace()
      .then(s => { if (!cancelled) setAnchorSpaceId(s.id) })
      .catch(() => { /* leave undefined; sends are guarded below */ })
    return () => { cancelled = true }
  }, [crossSpace])

  // Load the most recent conversation for the anchor space on mount.
  useEffect(() => {
    if (anchorSpaceId === undefined) return
    let cancelled = false
    listAgentConversations(anchorSpaceId)
      .then(async (convs: AgentConversation[]) => {
        if (cancelled || convs.length === 0) return
        const c = convs[0]
        setConversationId(c.id)
        const msgs: AgentMessage[] = await getAgentMessages(c.id)
        const ui: UiMessage[] = []
        for (const m of msgs) {
          if (m.role === 'TOOL') continue // TOOL turns are internal -- hide from UI
          const text = extractText(m.content)
          if (text) ui.push({ role: m.role as 'USER' | 'ASSISTANT', text })
        }
        if (!cancelled) setMessages(ui)
      })
      .catch(() => {
        // No prior conversation or network error -- silent: a fresh chat is
        // the right fallback, the user can still send a message.
      })
    return () => {
      cancelled = true
      ctrlRef.current?.abort()
    }
  }, [anchorSpaceId])

  // Auto-scroll to bottom on new messages. `scrollTo` is missing in jsdom
  // (where unit tests run), so guard the call to keep the test environment
  // happy without altering real-browser behaviour.
  useEffect(() => {
    const el = scrollRef.current
    if (el?.scrollTo) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, sending])

  function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    if (anchorSpaceId === undefined) return  // cross-space mode still resolving
    setInput('')
    // Optimistically append the user turn AND an empty assistant placeholder
    // that gets filled as deltas stream in.
    setMessages(m => [...m, { role: 'USER', text }, { role: 'ASSISTANT', text: '' }])
    setSending(true)

    let assistantBuf = ''
    ctrlRef.current?.abort()
    ctrlRef.current = streamAgentChat(
      {
        spaceId: anchorSpaceId,
        conversationId,
        message: text,
        crossSpace: crossSpace ? true : undefined,
      },
      {
        onMeta:  m => setConversationId(m.conversationId),
        onDelta: d => {
          assistantBuf += d.text
          setMessages(prev => {
            const copy = [...prev]
            copy[copy.length - 1] = { role: 'ASSISTANT', text: assistantBuf }
            return copy
          })
        },
        onDone:  () => setSending(false),
        onError: e => {
          setMessages(prev => {
            const copy = [...prev]
            copy[copy.length - 1] = {
              role: 'ASSISTANT',
              text: `Sorry, something went wrong: ${e.message}`,
            }
            return copy
          })
          setSending(false)
        },
      },
    )
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel__topbar">
        <span className="chat-panel__scope">
          Searching: {crossSpace ? 'All my spaces' : spaceName}
        </span>
        {onClose && (
          <button
            type="button"
            className="chat-panel__close"
            onClick={onClose}
            aria-label="Close chat"
          >
            ×
          </button>
        )}
      </div>

      <div className="chat-panel__history" ref={scrollRef}>
        {messages.length === 0 && !sending && (
          <div className="chat-panel__empty">
            Ask me anything about the documents in this space.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`chat-panel__msg chat-panel__msg--${m.role === 'USER' ? 'user' : 'assistant'}`}
          >
            {renderTextWithCitations(m.text, docId => navigate(`/journal/${docId}`))}
          </div>
        ))}
        {sending && messages[messages.length - 1]?.text === '' && (
          <div className="chat-panel__typing">Thinking…</div>
        )}
      </div>

      <div className="chat-panel__composer">
        <textarea
          className="chat-panel__textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Ask anything about this space..."
          rows={1}
          aria-label="Chat message"
        />
        <button
          type="button"
          className="chat-panel__send"
          onClick={handleSend}
          disabled={sending || !input.trim()}
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

// Walks the persisted Anthropic content block array and returns concatenated
// text from text blocks. Other block types (tool_use, image, document) are
// skipped because the agent never surfaces them to the user as plain text.
function extractText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  let out = ''
  for (const b of content as Array<{ type?: string; text?: string }>) {
    if (b?.type === 'text' && typeof b.text === 'string') out += b.text
  }
  return out
}

// Find [doc:<digits>] patterns and render them as clickable spans.
// Exported for unit testing.
export function renderTextWithCitations(
  text: string,
  onClick: (id: number) => void,
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\[doc:(\d+)\]/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const id = Number(match[1])
    parts.push(
      <span
        key={key++}
        className="chat-panel__cite"
        role="link"
        onClick={() => onClick(id)}
      >
        #{id}
      </span>,
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
