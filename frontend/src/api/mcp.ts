// API wrappers for the MCP token management endpoints under /api/profile/mcp.
// Mirrors the typed-fetch convention from api/client.ts.

import { apiRequest } from './client'

export interface McpToken {
  id: number
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  expiredAt: string
}

export interface McpTokenCreated {
  token: McpToken
  rawToken: string  // shown ONCE to the user, never stored
}

export interface McpAccessLogEntry {
  tokenName: string
  prefix: string
  toolName: string
  calledAt: string
  success: boolean
}

export function listMcpTokens() {
  return apiRequest<McpToken[]>('/profile/mcp/tokens')
}

export function createMcpToken(name: string, expiryDays: 30 | 90 | 365) {
  return apiRequest<McpTokenCreated>('/profile/mcp/tokens', {
    method: 'POST',
    body: JSON.stringify({ name, expiryDays }),
  })
}

export function revokeMcpToken(id: number) {
  return apiRequest<void>(`/profile/mcp/tokens/${id}`, { method: 'DELETE' })
}

export function listMcpActivity() {
  return apiRequest<McpAccessLogEntry[]>('/profile/mcp/activity')
}
