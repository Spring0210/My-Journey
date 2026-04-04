import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { register } from '@/api/auth'
import Icon from '@/components/ui/Icon'
import './Auth.css'

// ─────────────────────────────────────────────────────────
// RegisterPage — create a new account with username,
// email, and password.
// ─────────────────────────────────────────────────────────

const EMAIL_PATTERN = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export default function RegisterPage() {
  const navigate = useNavigate()

  const [username, setUsername]               = useState('')
  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword]       = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)

  // Field-level errors
  const [emailError, setEmailError]     = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [globalError, setGlobalError]   = useState('')
  const [loading, setLoading]           = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailError('')
    setPasswordError('')
    setGlobalError('')

    // Client-side validation
    if (!EMAIL_PATTERN.test(email)) {
      setEmailError('Please enter a valid email address.')
      return
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await register(username.trim(), email.trim(), password)
      navigate('/login', { replace: true })
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <h1 className="auth-title">Create account</h1>
      <p className="auth-subtitle">Start your journey today</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {/* Global error banner */}
        {globalError && <p className="auth-error-banner">{globalError}</p>}

        {/* Username */}
        <div className="auth-field">
          <label className="auth-label" htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            className="auth-input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </div>

        {/* Email */}
        <div className="auth-field">
          <label className="auth-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className={`auth-input${emailError ? ' auth-input--error' : ''}`}
            value={email}
            onChange={e => { setEmail(e.target.value); setEmailError('') }}
            autoComplete="email"
            required
          />
          {emailError && <span className="auth-field-error">{emailError}</span>}
        </div>

        {/* Password */}
        <div className="auth-field">
          <label className="auth-label" htmlFor="password">Password</label>
          <div className="auth-input-wrap">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="auth-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
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
        </div>

        {/* Confirm password */}
        <div className="auth-field">
          <label className="auth-label" htmlFor="confirmPassword">Confirm password</label>
          <div className="auth-input-wrap">
            <input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              className={`auth-input${passwordError ? ' auth-input--error' : ''}`}
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setPasswordError('') }}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="auth-input-icon-btn"
              onClick={() => setShowConfirm(v => !v)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              <Icon name={showConfirm ? 'eye-off' : 'eye'} size={18} />
            </button>
          </div>
          {passwordError && <span className="auth-field-error">{passwordError}</span>}
        </div>

        <button type="submit" className="auth-btn-primary" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      {/* Divider */}
      <div className="auth-divider"><span>or</span></div>

      {/* Google OAuth2 */}
      <a href="/oauth2/authorization/google" className="auth-btn-google">
        <Icon name="google" size={18} />
        Continue with Google
      </a>

      <p className="auth-bottom">
        Already have an account?{' '}
        <NavLink to="/login" className="auth-bottom-link">Sign in</NavLink>
      </p>
    </div>
  )
}
