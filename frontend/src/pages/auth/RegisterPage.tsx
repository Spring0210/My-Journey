import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { sendRegistrationCode, register } from '@/api/auth'
import Icon from '@/components/ui/Icon'
import './Auth.css'

// ─────────────────────────────────────────────────────────
// RegisterPage — two-step registration flow.
// Step 1: fill in username, email, and password, then send
//         a 6-digit verification code to the email address.
// Step 2: enter the code to confirm the email and create
//         the account.
// ─────────────────────────────────────────────────────────

const EMAIL_PATTERN = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const RESEND_COOLDOWN = 60 // seconds

export default function RegisterPage() {
  const navigate = useNavigate()

  // ── Shared state ──────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 fields
  const [username, setUsername]               = useState('')
  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword]       = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)
  const [step1Error, setStep1Error]           = useState('')
  const [step1Loading, setStep1Loading]       = useState(false)

  // Step 2 fields
  const [code, setCode]             = useState('')
  const [step2Error, setStep2Error] = useState('')
  const [step2Loading, setStep2Loading] = useState(false)

  // Resend cooldown
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN)
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  // ── Step 1: validate and send code ───────────────────
  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setStep1Error('')

    if (!EMAIL_PATTERN.test(email)) {
      setStep1Error('Please enter a valid email address.')
      return
    }
    if (password !== confirmPassword) {
      setStep1Error('Passwords do not match.')
      return
    }

    setStep1Loading(true)
    try {
      await sendRegistrationCode(username.trim(), email.trim())
      setStep(2)
      startCooldown()
    } catch (err) {
      setStep1Error(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setStep1Loading(false)
    }
  }

  // ── Resend code ───────────────────────────────────────
  async function handleResend() {
    setStep2Error('')
    try {
      await sendRegistrationCode(username.trim(), email.trim())
      setCode('')
      startCooldown()
    } catch (err) {
      setStep2Error(err instanceof Error ? err.message : 'Failed to resend code')
    }
  }

  // ── Step 2: verify code and create account ────────────
  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setStep2Error('')
    setStep2Loading(true)
    try {
      await register(username.trim(), email.trim(), password, code.trim())
      navigate('/login', { replace: true })
    } catch (err) {
      setStep2Error(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setStep2Loading(false)
    }
  }

  // ── Render ────────────────────────────────────────────
  return (
    <div className="auth-card">
      <h1 className="auth-title">Create account</h1>

      {/* Step 1 — fill in details */}
      {step === 1 && (
        <>
          <p className="auth-subtitle">Start your journey today</p>

          <form className="auth-form" onSubmit={handleStep1} noValidate>
            {step1Error && <p className="auth-error-banner">{step1Error}</p>}

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

            <div className="auth-field">
              <label className="auth-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="auth-input"
                value={email}
                onChange={e => { setEmail(e.target.value); setStep1Error('') }}
                autoComplete="email"
                required
              />
            </div>

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

            <div className="auth-field">
              <label className="auth-label" htmlFor="confirmPassword">Confirm password</label>
              <div className="auth-input-wrap">
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  className="auth-input"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setStep1Error('') }}
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
            </div>

            <button type="submit" className="auth-btn-primary" disabled={step1Loading}>
              {step1Loading ? 'Sending...' : 'Send verification code'}
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>

          <a href="/oauth2/authorization/google" className="auth-btn-google">
            <Icon name="google" size={18} />
            Continue with Google
          </a>

          <p className="auth-bottom">
            Already have an account?{' '}
            <NavLink to="/login" className="auth-bottom-link">Sign in</NavLink>
          </p>
        </>
      )}

      {/* Step 2 — enter verification code */}
      {step === 2 && (
        <>
          <p className="auth-subtitle">
            A 6-digit code was sent to <strong>{email}</strong>. It expires in 10 minutes.
          </p>

          <form className="auth-form" onSubmit={handleStep2} noValidate>
            {step2Error && <p className="auth-error-banner">{step2Error}</p>}

            <div className="auth-field">
              <label className="auth-label" htmlFor="code">Verification code</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                className="auth-input"
                value={code}
                onChange={e => { setCode(e.target.value); setStep2Error('') }}
                placeholder="6-digit code"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </div>

            <button type="submit" className="auth-btn-primary" disabled={step2Loading}>
              {step2Loading ? 'Creating account...' : 'Create account'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <button
                type="button"
                className="auth-btn-resend"
                onClick={handleResend}
                disabled={cooldown > 0}
              >
                {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
              </button>
            </div>
          </form>

          <p className="auth-bottom">
            <button
              type="button"
              className="auth-bottom-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => { setStep(1); setCode(''); setStep2Error('') }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="arrow-left" size={14} />
                Back
              </span>
            </button>
          </p>
        </>
      )}
    </div>
  )
}
