// ─────────────────────────────────────────────────────────
// Auth API — unauthenticated endpoints (login, register,
// password reset). These bypass the apiRequest wrapper
// because they don't carry an Authorization header.
// ─────────────────────────────────────────────────────────

import type { AuthResponse } from '@/types/api'

// Convert any backend error response body into a user-facing message.
// Handles three shapes:
//   - Plain-text business errors  ("Email already in use") → show as-is
//   - Spring default 5xx JSON     ({"error":"Internal Server Error",...}) → generic msg
//   - JSON with .message field    ({"message":"..."}) → use .message
// `fallback` is shown when nothing else is suitable.
function parseAuthError(body: string, fallback: string): string {
  const trimmed = body.trim()
  if (!trimmed) return fallback
  // Not JSON: backend returned a plain-text business error
  if (!trimmed.startsWith('{')) return trimmed
  try {
    const json = JSON.parse(trimmed) as { status?: number; error?: string; message?: string }
    // Spring's default 5xx envelope — never show "Internal Server Error" to users
    if (typeof json.status === 'number' && json.status >= 500) {
      return 'Something went wrong on our end. Please try again in a moment.'
    }
    if (typeof json.message === 'string' && json.message) return json.message
    if (typeof json.error === 'string' && json.error && json.error !== 'Internal Server Error') {
      return json.error
    }
    return fallback
  } catch {
    return fallback
  }
}

// POST /api/login
// Returns full auth state on success; throws with backend error message on failure.
export async function login(identifier: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(parseAuthError(text, 'Login failed'))
  }
  try {
    return JSON.parse(text) as AuthResponse
  } catch {
    throw new Error('Login failed')
  }
}

// POST /api/register/send-code
// Step 1: validate fields and send a 6-digit verification code to the email.
// Backend returns "Code sent" on success, or a plain-text error message.
export async function sendRegistrationCode(username: string, email: string): Promise<void> {
  const res = await fetch('/api/register/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email }),
  })
  const text = await res.text()
  if (!res.ok || text !== 'Code sent') {
    throw new Error(parseAuthError(text, 'Failed to send code'))
  }
}

// POST /api/register
// Step 2: verify the code and create the account.
// Backend returns "Registration successful" on success, or a plain-text error message.
export async function register(
  username: string,
  email: string,
  password: string,
  code: string,
): Promise<void> {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, code }),
  })
  const text = await res.text()
  if (!res.ok || !text.toLowerCase().includes('successful')) {
    throw new Error(parseAuthError(text, 'Registration failed'))
  }
}

// POST /api/forgot-password
// Backend always returns "Code sent" — including when the email isn't registered
// (privacy: prevents account enumeration). The user is told to check their inbox
// either way.
export async function sendResetCode(email: string): Promise<void> {
  const res = await fetch('/api/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const text = await res.text()
  if (!res.ok || text !== 'Code sent') {
    throw new Error(parseAuthError(text, 'Failed to send code'))
  }
}

// POST /api/reset-password
// Backend returns "Password reset successful" on success.
export async function resetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch('/api/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword }),
  })
  const text = await res.text()
  if (!res.ok || text !== 'Password reset successful') {
    throw new Error(parseAuthError(text, 'Reset failed'))
  }
}
