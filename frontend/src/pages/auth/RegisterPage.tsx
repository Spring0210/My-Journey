import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { sendRegistrationCode, register } from '@/api/auth'
import Icon from '@/components/ui/Icon'
import './Auth.css'

// ─────────────────────────────────────────────────────────
// RegisterPage — two-step registration.
// Step 1 is framed as "Create account" — the verification step
// is presented as the final confirmation, not as a barrier.
// Step 2 uses a 6-box OTP input that auto-submits when filled.
// ─────────────────────────────────────────────────────────

const EMAIL_PATTERN = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const RESEND_COOLDOWN = 60 // seconds
const CODE_LENGTH = 6

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

  // Step 2 fields — 6 separate digit slots
  const [codeDigits, setCodeDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(''))
  const [step2Error, setStep2Error] = useState('')
  const [step2Loading, setStep2Loading] = useState(false)
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([])

  // Resend cooldown
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // Focus the first code box when entering step 2
  useEffect(() => {
    if (step === 2) codeInputRefs.current[0]?.focus()
  }, [step])

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
      setCodeDigits(Array(CODE_LENGTH).fill(''))
      codeInputRefs.current[0]?.focus()
      startCooldown()
    } catch (err) {
      setStep2Error(err instanceof Error ? err.message : 'Failed to resend code')
    }
  }

  // ── Step 2: submit the code ───────────────────────────
  async function submitCode(code: string) {
    setStep2Error('')
    setStep2Loading(true)
    try {
      await register(username.trim(), email.trim(), password, code)
      navigate('/login', { replace: true })
    } catch (err) {
      setStep2Error(err instanceof Error ? err.message : 'Registration failed')
      // Clear digits so the user can retype after an error
      setCodeDigits(Array(CODE_LENGTH).fill(''))
      codeInputRefs.current[0]?.focus()
    } finally {
      setStep2Loading(false)
    }
  }

  function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault()
    const code = codeDigits.join('')
    if (code.length === CODE_LENGTH) submitCode(code)
  }

  // ── OTP input handlers ────────────────────────────────
  // Accept one digit, auto-advance, auto-submit when filled
  function handleDigitChange(index: number, value: string) {
    // Only keep the last digit if user types fast or pastes more than one char
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...codeDigits]
    next[index] = digit
    setCodeDigits(next)
    setStep2Error('')

    if (digit && index < CODE_LENGTH - 1) {
      codeInputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 are filled
    if (digit && index === CODE_LENGTH - 1) {
      const filled = next.join('')
      if (filled.length === CODE_LENGTH && !next.includes('')) {
        submitCode(filled)
      }
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    // Backspace on empty box jumps to previous box and clears it
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      e.preventDefault()
      const next = [...codeDigits]
      next[index - 1] = ''
      setCodeDigits(next)
      codeInputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      codeInputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      codeInputRefs.current[index + 1]?.focus()
    }
  }

  // Handle paste of a full 6-digit code into any box
  function handleDigitPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (!pasted) return
    e.preventDefault()
    const next = Array(CODE_LENGTH).fill('').map((_, i) => pasted[i] ?? '')
    setCodeDigits(next)
    setStep2Error('')
    // Focus the next empty box, or the last one if all filled
    const firstEmpty = next.findIndex(d => !d)
    const focusIdx = firstEmpty === -1 ? CODE_LENGTH - 1 : firstEmpty
    codeInputRefs.current[focusIdx]?.focus()
    if (pasted.length === CODE_LENGTH) submitCode(pasted)
  }

  // ── Render ────────────────────────────────────────────
  return (
    <div className="auth-card">

      {step === 1 && <h1 className="auth-title">Create account</h1>}
      {step === 2 && <h1 className="auth-title">Verify your email</h1>}

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
              {step1Loading ? 'Creating account...' : 'Create account'}
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

      {/* Step 2 — verify email with 6-box OTP */}
      {step === 2 && (
        <>
          <p className="auth-subtitle">
            Almost done! We sent a 6-digit code to <strong>{email}</strong>. Enter it below to finish setting up your account.
          </p>

          <form className="auth-form" onSubmit={handleStep2Submit} noValidate>
            {step2Error && <p className="auth-error-banner">{step2Error}</p>}

            {/* 6 separate digit boxes — auto-advance, paste-friendly, auto-submit */}
            <div className="auth-otp" role="group" aria-label="Verification code">
              {codeDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { codeInputRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  className={`auth-otp-box${step2Error ? ' auth-input--error' : ''}`}
                  value={digit}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleDigitKeyDown(i, e)}
                  onPaste={handleDigitPaste}
                  onFocus={e => e.target.select()}
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
                  disabled={step2Loading}
                />
              ))}
            </div>

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={step2Loading || codeDigits.join('').length !== CODE_LENGTH}
            >
              {step2Loading ? 'Creating account...' : 'Create account'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <button
                type="button"
                className="auth-btn-resend"
                onClick={handleResend}
                disabled={cooldown > 0}
              >
                {cooldown > 0 ? `Resend code (${cooldown}s)` : "Didn't get it? Resend code"}
              </button>
            </div>
          </form>

          <p className="auth-bottom">
            <button
              type="button"
              className="auth-bottom-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => {
                setStep(1)
                setCodeDigits(Array(CODE_LENGTH).fill(''))
                setStep2Error('')
              }}
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
