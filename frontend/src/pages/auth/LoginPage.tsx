import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { login } from '@/api/auth'
import Icon from '@/components/ui/Icon'
import './Auth.css'

// ─────────────────────────────────────────────────────────
// LoginPage — sign in with username/email + password,
// or via Google OAuth2.
// ─────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login: setAuth } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Show error if redirected back from a failed Google OAuth2 attempt
  useEffect(() => {
    if (searchParams.get('error') === 'oauth2') {
      setError('Google sign-in failed. Please try again.')
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(identifier.trim(), password)
      setAuth({
        token: data.token,
        refreshToken: data.refreshToken,
        userId: data.userId,
        username: data.username,
        avatarUrl: data.avatar,
      })
      navigate('/journal', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <h1 className="auth-title">Sign in</h1>
      <p className="auth-subtitle">Welcome back to MyJourney</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {/* Global error banner */}
        {error && <p className="auth-error-banner">{error}</p>}

        {/* Username or email */}
        <div className="auth-field">
          <label className="auth-label" htmlFor="identifier">
            Username or email
          </label>
          <input
            id="identifier"
            type="text"
            className="auth-input"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </div>

        {/* Password with show/hide toggle */}
        <div className="auth-field">
          <label className="auth-label" htmlFor="password">
            Password
          </label>
          <div className="auth-input-wrap">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="auth-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="auth-input-icon-btn"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
            </button>
          </div>
          <NavLink to="/forgot-password" className="auth-forgot">
            Forgot password?
          </NavLink>
        </div>

        <button type="submit" className="auth-btn-primary" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      {/* Divider */}
      <div className="auth-divider"><span>or</span></div>

      {/* Google OAuth2 — Spring Security handles the redirect */}
      <a href="/oauth2/authorization/google" className="auth-btn-google">
        <Icon name="google" size={18} />
        Continue with Google
      </a>

      <p className="auth-bottom">
        Don't have an account?{' '}
        <NavLink to="/register" className="auth-bottom-link">Create one</NavLink>
      </p>
    </div>
  )
}
