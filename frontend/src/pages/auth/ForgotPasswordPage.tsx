import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { sendResetCode, resetPassword } from '@/api/auth'
import Icon from '@/components/ui/Icon'
import './Auth.css'

// ─────────────────────────────────────────────────────────
// ForgotPasswordPage — two-step password reset flow.
// Step 1: enter username + email to receive a 6-digit code.
// Step 2: enter code + new password to complete the reset.
// ─────────────────────────────────────────────────────────

const RESEND_COOLDOWN = 60 // seconds

export default function ForgotPasswordPage() {
  const navigate = useNavigate()

  // ── Shared state ──────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 fields
  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [step1Error, setStep1Error] = useState('')
  const [step1Loading, setStep1Loading] = useState(false)

  // Step 2 fields
  const [code, setCode]                       = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew]                 = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)
  const [step2Error, setStep2Error]           = useState('')
  const [step2Loading, setStep2Loading]       = useState(false)

  // Resend cooldown
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Clean up interval on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN)
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // ── Step 1: send code ─────────────────────────────────
  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setStep1Error('')
    setStep1Loading(true)
    try {
      await sendResetCode(username.trim(), email.trim())
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
      await sendResetCode(username.trim(), email.trim())
      setCode('')
      startCooldown()
    } catch (err) {
      setStep2Error(err instanceof Error ? err.message : 'Failed to resend code')
    }
  }

  // ── Step 2: reset password ────────────────────────────
  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setStep2Error('')

    if (newPassword !== confirmPassword) {
      setStep2Error('Passwords do not match.')
      return
    }

    setStep2Loading(true)
    try {
      await resetPassword(username.trim(), code.trim(), newPassword)
      navigate('/login', { replace: true })
    } catch (err) {
      setStep2Error(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setStep2Loading(false)
    }
  }

  // ── Render ────────────────────────────────────────────
  return (
    <div className="auth-card">
      <h1 className="auth-title">Reset password</h1>

      {/* Step 1 — request code */}
      {step === 1 && (
        <>
          <p className="auth-subtitle">
            Enter your username and email to receive a reset code.
          </p>
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
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <button type="submit" className="auth-btn-primary" disabled={step1Loading}>
              {step1Loading ? 'Sending...' : 'Send code'}
            </button>
          </form>
        </>
      )}

      {/* Step 2 — enter code and new password */}
      {step === 2 && (
        <>
          <p className="auth-subtitle">
            A 6-digit code was sent to {email}. It expires in 10 minutes.
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
                onChange={e => setCode(e.target.value)}
                placeholder="6-digit code"
                maxLength={6}
                autoComplete="one-time-code"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="newPassword">New password</label>
              <div className="auth-input-wrap">
                <input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  className="auth-input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="auth-input-icon-btn"
                  onClick={() => setShowNew(v => !v)}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showNew ? 'eye-off' : 'eye'} size={18} />
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
                  onChange={e => setConfirmPassword(e.target.value)}
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

            <button type="submit" className="auth-btn-primary" disabled={step2Loading}>
              {step2Loading ? 'Resetting...' : 'Reset password'}
            </button>

            {/* Resend code row */}
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
        </>
      )}

      {/* Back to sign in */}
      <p className="auth-bottom">
        <NavLink to="/login" className="auth-bottom-link">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="arrow-left" size={14} />
            Back to sign in
          </span>
        </NavLink>
      </p>
    </div>
  )
}
