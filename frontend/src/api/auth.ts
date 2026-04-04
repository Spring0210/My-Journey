// ─────────────────────────────────────────────────────────
// Auth API — unauthenticated endpoints (login, register,
// password reset). These bypass the apiRequest wrapper
// because they don't carry an Authorization header.
// ─────────────────────────────────────────────────────────

import type { AuthResponse } from '@/types/api'

// POST /api/login
// Returns full auth state on success; throws with backend error message on failure.
export async function login(identifier: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Login failed')
  }
  return data as AuthResponse
}

// POST /api/register
// Backend returns plain text on success or JSON error via GlobalExceptionHandler.
export async function register(
  username: string,
  email: string,
  password: string,
): Promise<void> {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  const text = await res.text()
  if (!res.ok) {
    // GlobalExceptionHandler returns JSON { "error": "..." } on 4xx
    try {
      const json = JSON.parse(text)
      throw new Error(json.error || text)
    } catch {
      throw new Error(text || 'Registration failed')
    }
  }
  if (!text.toLowerCase().includes('successful')) {
    throw new Error(text || 'Registration failed')
  }
}

// POST /api/forgot-password
// Backend returns the string "Code sent" on success.
export async function sendResetCode(username: string, email: string): Promise<void> {
  const res = await fetch('/api/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email }),
  })
  const text = await res.text()
  if (!res.ok || text !== 'Code sent') {
    try {
      const json = JSON.parse(text)
      throw new Error(json.error || text)
    } catch {
      throw new Error(text || 'Failed to send code')
    }
  }
}

// POST /api/reset-password
// Backend returns "Password reset successful" on success.
export async function resetPassword(
  username: string,
  code: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch('/api/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, code, newPassword }),
  })
  const text = await res.text()
  if (!res.ok || text !== 'Password reset successful') {
    try {
      const json = JSON.parse(text)
      throw new Error(json.error || text)
    } catch {
      throw new Error(text || 'Reset failed')
    }
  }
}
