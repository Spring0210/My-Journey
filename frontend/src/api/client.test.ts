import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest } from './client'

// Covers the silent-refresh path of apiRequest. Refresh tokens are rotated on
// use server-side, so concurrent 401s must share ONE refresh call; a second
// refresh would present the already-deleted token and log the user out.

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === null ? '' : JSON.stringify(body), { status })
}

describe('apiRequest silent refresh', () => {
  let refreshCalls: number

  beforeEach(() => {
    refreshCalls = 0
    localStorage.setItem('token', 'expired-access')
    localStorage.setItem('refreshToken', 'refresh-v1')

    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/refresh') {
        refreshCalls++
        const sent = JSON.parse(String(init?.body)).refreshToken
        // Simulate rotation: only the current refresh token is accepted.
        if (sent !== 'refresh-v1') return jsonResponse(401, { error: 'Invalid refresh token' })
        // Resolve asynchronously so concurrent callers overlap with this refresh.
        await new Promise(r => setTimeout(r, 10))
        return jsonResponse(200, { token: 'fresh-access', refreshToken: 'refresh-v2' })
      }
      const auth = (init?.headers as Record<string, string>)['Authorization']
      return auth === 'Bearer fresh-access'
        ? jsonResponse(200, { ok: url })
        : jsonResponse(401, { error: 'expired' })
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shares one refresh across concurrent 401s and retries every request', async () => {
    const results = await Promise.all([
      apiRequest<{ ok: string }>('/a'),
      apiRequest<{ ok: string }>('/b'),
      apiRequest<{ ok: string }>('/c'),
    ])

    expect(refreshCalls).toBe(1)
    expect(results.map(r => r.ok)).toEqual(['/api/a', '/api/b', '/api/c'])
    expect(localStorage.getItem('token')).toBe('fresh-access')
    expect(localStorage.getItem('refreshToken')).toBe('refresh-v2')
  })

  it('starts a new refresh after the previous one has settled', async () => {
    await apiRequest('/first')
    // Access token expires again later; the rotated refresh token is now v2,
    // which this fake server rejects, so the second refresh must actually run.
    localStorage.setItem('token', 'expired-again')
    await expect(apiRequest('/second')).rejects.toThrow('Session expired')
    expect(refreshCalls).toBe(2)
  })
})
