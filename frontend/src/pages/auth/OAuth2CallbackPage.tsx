import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

// ─────────────────────────────────────────────────────────
// OAuth2CallbackPage — handles the redirect from Spring
// Security's OAuth2 success handler.
//
// The backend redirects to /oauth2/callback with query params:
//   token, refreshToken, userId, username, avatar
//
// This page reads them, populates auth context, and
// navigates into the app. No visible UI is shown.
// ─────────────────────────────────────────────────────────

export default function OAuth2CallbackPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token        = params.get('token')
    const refreshToken = params.get('refreshToken')
    const userId       = Number(params.get('userId'))
    const username     = params.get('username')
    // Backend param name is "avatar" (not "avatarUrl")
    const avatarUrl    = params.get('avatar') || null

    if (token && refreshToken && userId && username) {
      login({ token, refreshToken, userId, username, avatarUrl })
      navigate('/dashboard', { replace: true })
    } else {
      // Missing params — treat as failed OAuth attempt
      navigate('/login?error=oauth2', { replace: true })
    }
  }, [])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--surface-secondary)',
    }}>
      <p style={{ fontSize: 15, color: 'var(--label-secondary)' }}>Signing in...</p>
    </div>
  )
}
