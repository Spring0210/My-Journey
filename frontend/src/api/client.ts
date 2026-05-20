// ─────────────────────────────────────────────────────────
// API client — typed fetch wrapper.
// Mirrors the existing apiRequest / apiRequestWithFile pattern
// from the vanilla JS api.js, with TypeScript generics.
// All components call these functions; never use raw fetch.
// ─────────────────────────────────────────────────────────

const BASE = '/api'

// Retrieve the current JWT access token from localStorage
function getToken(): string | null {
  return localStorage.getItem('token')
}

// Attempt a silent token refresh using the stored refresh token.
// Returns the new access token on success, or null on failure.
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) return null

  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null

    const data = await res.json()
    localStorage.setItem('token',        data.token)
    localStorage.setItem('refreshToken', data.refreshToken)
    return data.token
  } catch {
    return null
  }
}

// Core typed fetch wrapper with automatic 401 → refresh → retry
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res = await fetch(`${BASE}${path}`, { ...options, headers })

  // On 401, attempt silent refresh and retry once
  if (res.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(`${BASE}${path}`, { ...options, headers })
    } else {
      // Refresh failed — clear auth and redirect to login
      ;['token', 'refreshToken', 'userId', 'username', 'avatarUrl'].forEach(k =>
        localStorage.removeItem(k)
      )
      window.location.href = '/login'
      throw new Error('Session expired')
    }
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed: ${res.status}`)
  }

  // Parse body: return null for empty/no-content responses, JSON otherwise
  const text = await res.text()
  if (!text.trim()) return null as T
  return JSON.parse(text) as T
}

// Fetch wrapper for multipart/form-data uploads (images, videos)
export async function apiRequestWithFile<T>(
  path: string,
  formData: FormData,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: formData,
  })

  if (res.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(`${BASE}${path}`, { method, headers, body: formData })
    } else {
      ;['token', 'refreshToken', 'userId', 'username', 'avatarUrl'].forEach(k =>
        localStorage.removeItem(k)
      )
      window.location.href = '/login'
      throw new Error('Session expired')
    }
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed: ${res.status}`)
  }

  const text2 = await res.text()
  if (!text2.trim()) return null as T
  return JSON.parse(text2) as T
}

// XHR-based multipart upload with progress callback.
// fetch() doesn't expose upload progress, so we drop down to XHR
// when the UI needs a per-file progress bar (attachment uploads).
// Retries once on 401 after a silent token refresh.
export async function apiUploadWithProgress<T>(
  path: string,
  formData: FormData,
  opts: { onProgress?: (pct: number) => void; method?: 'POST' | 'PUT' } = {},
): Promise<T> {
  const method = opts.method ?? 'POST'

  function send(token: string | null): Promise<XMLHttpRequest> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(method, `${BASE}${path}`)
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable && opts.onProgress) {
          opts.onProgress(Math.round((e.loaded / e.total) * 100))
        }
      })
      xhr.onload  = () => resolve(xhr)
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.send(formData)
    })
  }

  let xhr = await send(getToken())
  if (xhr.status === 401) {
    const newToken = await refreshAccessToken()
    if (!newToken) {
      ;['token', 'refreshToken', 'userId', 'username', 'avatarUrl']
        .forEach(k => localStorage.removeItem(k))
      window.location.href = '/login'
      throw new Error('Session expired')
    }
    xhr = await send(newToken)
  }

  if (xhr.status < 200 || xhr.status >= 300) {
    throw new Error(xhr.responseText || `Request failed: ${xhr.status}`)
  }
  const text = xhr.responseText
  if (!text.trim()) return null as T
  return JSON.parse(text) as T
}
