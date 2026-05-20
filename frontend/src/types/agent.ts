// ─────────────────────────────────────────────────────────
// Internal agent (web chat) types. Mirrors com.myjourney.dto.agent
// on the Spring side.
// ─────────────────────────────────────────────────────────

export interface AgentConversation {
  id: number
  spaceId: number
  title: string
  createdAt: string
  updatedAt: string
}

// A single persisted turn. `content` shape varies by role:
//   USER:      [{ type:'text', text }, ...image/document blocks...]
//   ASSISTANT: [{ type:'text', text } | { type:'tool_use', ... } | ...]
//   TOOL:      [{ type:'tool_result', tool_use_id, content, is_error }]
export interface AgentMessage {
  id: number
  role: 'USER' | 'ASSISTANT' | 'TOOL'
  content: unknown
  createdAt: string
}

export interface AgentChatRequest {
  spaceId: number
  conversationId?: number
  message: string
  attachmentUrls?: string[]
}

// SSE event payloads emitted by POST /api/agent/chat.
export interface AgentChatMeta  { conversationId: number }
export interface AgentChatDelta { text: string }
export interface AgentChatError { message: string }
