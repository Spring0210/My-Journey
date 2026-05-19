import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { updateProfile, sendChangePasswordCode, changePassword } from '@/api/user'
import { apiRequest } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import Icon from '@/components/ui/Icon'
import PageTopBar from '@/components/ui/PageTopBar'
import { useToast } from '@/components/feedback'
import './Profile.css'

// ─────────────────────────────────────────────────────────
// ProfilePage — iOS Settings-style grouped list layout.
// Hero: avatar + username.
// Account section: username inline-edit.
// Security section: change password expandable row.
// Footer: standalone sign-out button.
// ─────────────────────────────────────────────────────────

// Password strength: returns 0–3 based on length and variety
function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length === 0) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw) || /[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score++
  return Math.min(score, 3) as 0 | 1 | 2 | 3
}

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Strong']
const STRENGTH_CLASS = ['', 'prof-pw-bar--weak', 'prof-pw-bar--fair', 'prof-pw-bar--strong']

export default function ProfilePage() {
  const { userId, username, avatarUrl, updateUsername, updateAvatar, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  // ── Avatar state ──────────────────────────────────────
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarSaving, setAvatarSaving]   = useState(false)
  const [heroMsg, setHeroMsg]             = useState('')  // '' | 'saved' | error text
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Username edit state ───────────────────────────────
  const [editingUsername, setEditingUsername] = useState(false)
  const [nameVal, setNameVal]                 = useState(username ?? '')
  const [nameSaving, setNameSaving]           = useState(false)

  // ── Password state ────────────────────────────────────
  // 'idle' → 'code' (code sent) → 'done' (success)
  const [pwOpen, setPwOpen]         = useState(false)
  const [pwStep, setPwStep]         = useState<'idle' | 'code' | 'done'>('idle')
  const [sending, setSending]       = useState(false)
  const [codeVal, setCodeVal]       = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [showNewPw, setShowNewPw]   = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [pwError, setPwError]       = useState('')

  const pwStrength = passwordStrength(newPw)

  // ── Avatar: auto-save on file select ─────────────────
  async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file || !userId) return
    const preview = URL.createObjectURL(file)
    setAvatarPreview(preview)
    e.target.value = ''
    setAvatarSaving(true)
    setHeroMsg('')
    try {
      const result = await updateProfile(userId, null, file)
      if (result.avatar) updateAvatar(result.avatar)
      setHeroMsg('saved')
      setTimeout(() => setHeroMsg(''), 2500)
    } catch (err) {
      setHeroMsg(err instanceof Error ? err.message : 'Failed to update photo.')
    } finally {
      setAvatarSaving(false)
      URL.revokeObjectURL(preview)
      setAvatarPreview(null)
    }
  }

  // ── Username: save inline ─────────────────────────────
  async function handleSaveUsername() {
    if (!userId || !nameVal.trim()) return
    setNameSaving(true)
    try {
      const result = await updateProfile(userId, nameVal.trim(), null)
      updateUsername(result.username)
      setEditingUsername(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save username.')
    } finally {
      setNameSaving(false)
    }
  }

  function cancelEditUsername() {
    setEditingUsername(false)
    setNameVal(username ?? '')
  }

  // ── Send change-password code ─────────────────────────
  async function handleSendCode() {
    setSending(true)
    setPwError('')
    try {
      await sendChangePasswordCode()
      setPwStep('code')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to send code.')
    } finally {
      setSending(false)
    }
  }

  // ── Submit new password ───────────────────────────────
  async function handleChangePw() {
    if (!codeVal.trim())    { setPwError('Enter the verification code.'); return }
    if (newPw.length < 6)   { setPwError('Password must be at least 6 characters.'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    setChangingPw(true)
    setPwError('')
    try {
      await changePassword(codeVal.trim(), newPw)
      setPwStep('done')
      setCodeVal(''); setNewPw(''); setConfirmPw('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password.')
    } finally {
      setChangingPw(false)
    }
  }

  function closePw() {
    setPwOpen(false)
    if (pwStep !== 'done') {
      setPwStep('idle')
      setCodeVal(''); setNewPw(''); setConfirmPw(''); setPwError('')
    }
  }

  // ── Logout ────────────────────────────────────────────
  async function handleLogout() {
    const refreshToken = localStorage.getItem('refreshToken')
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      })
    } catch { /* ignore — still clear local state */ }
    logout()
    navigate('/login', { replace: true })
  }

  const displayAvatar = avatarPreview ?? avatarUrl

  return (
    <div className="prof-page">

      <PageTopBar title="Profile" />

      <div className="prof-inner">

        {/* ── Hero card: avatar + username ──────────────── */}
        <div className="prof-hero">
          {/* Clickable avatar with camera badge */}
          <div
            className="prof-hero-avatar"
            style={avatarSaving ? { opacity: 0.5, cursor: 'default' } : undefined}
            onClick={() => !avatarSaving && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            aria-label="Change profile photo"
          >
            {displayAvatar
              ? <img src={displayAvatar} alt="Avatar" />
              : <div className="prof-hero-avatar-initial">
                  {(username ?? 'U').charAt(0).toUpperCase()}
                </div>
            }
            <div className="prof-hero-avatar-badge" aria-hidden="true">
              <Icon name="image" size={13} />
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarSelect}
          />

          <p className="prof-hero-username">@{username}</p>

          {/* Save/error feedback */}
          {heroMsg === 'saved' && (
            <span className="prof-hero-feedback prof-hero-feedback--ok">
              <Icon name="check" size={13} /> Saved
            </span>
          )}
          {heroMsg && heroMsg !== 'saved' && (
            <span className="prof-hero-feedback prof-hero-feedback--err">{heroMsg}</span>
          )}
        </div>

        {/* ── Account section ───────────────────────────── */}
        <div className="prof-section">
          <p className="prof-section-label">Account</p>
          <div className="prof-rows-card">

            {/* Username row */}
            {editingUsername ? (
              /* Edit mode — column form: label / input / actions */
              <div className="prof-row prof-row--editing">
                <span className="prof-row-edit-label">Username</span>
                <input
                  className="prof-row-edit-input"
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  maxLength={30}
                  autoFocus
                  autoComplete="username"
                  onKeyDown={e => {
                    if (e.key === 'Enter')  handleSaveUsername()
                    if (e.key === 'Escape') cancelEditUsername()
                  }}
                />
                <div className="prof-row-edit-actions">
                  <button className="prof-btn prof-btn--ghost"
                    onClick={cancelEditUsername}>
                    Cancel
                  </button>
                  <button
                    className="prof-btn prof-btn--primary"
                    onClick={handleSaveUsername}
                    disabled={nameSaving || !nameVal.trim()}
                  >
                    {nameSaving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            ) : (
              /* Display mode — label / value / edit icon */
              <div className="prof-row">
                <span className="prof-row-label">Username</span>
                <span className="prof-row-value">@{username}</span>
                <button
                  className="prof-row-icon-btn"
                  onClick={() => setEditingUsername(true)}
                  aria-label="Edit username"
                >
                  <Icon name="edit" size={15} />
                </button>
              </div>
            )}

          </div>
        </div>

        {/* ── Security section ──────────────────────────── */}
        <div className="prof-section">
          <p className="prof-section-label">Security</p>
          <div className="prof-rows-card">

            {/* Change Password row — tap header to open; locked while filling the form */}
            <div
              className={`prof-row prof-row--expandable${pwOpen ? ' prof-row--open' : ''}`}
              // Only toggle when closed or in idle state — lock the header while user is
              // filling in the code+password form to prevent accidental data loss
              onClick={() => {
                if (!pwOpen) setPwOpen(true)
                else if (pwStep === 'idle' || pwStep === 'done') closePw()
              }}
              style={pwOpen && pwStep === 'code' ? { cursor: 'default' } : undefined}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key !== 'Enter') return
                if (!pwOpen) setPwOpen(true)
                else if (pwStep === 'idle' || pwStep === 'done') closePw()
              }}
            >
              <span style={{ flex: 1, fontSize: 15, color: 'var(--label-primary)' }}>
                Change Password
              </span>
              <Icon name="chevron-right" size={16} className="prof-row-chevron" />
            </div>

            {/* Expanded password form */}
            {pwOpen && (
              <div className="prof-pw-expand">
                {pwStep === 'done' ? (
                  <div className="prof-pw-success">
                    <Icon name="check" size={16} />
                    Password changed successfully.
                  </div>
                ) : pwStep === 'idle' ? (
                  /* Idle — single prominent "Send code" button, no redundant Cancel */
                  <>
                    <p className="prof-pw-hint">
                      A 6-digit verification code will be sent to your registered email address.
                    </p>
                    {pwError && <p className="prof-error">{pwError}</p>}
                    <button
                      className="prof-btn prof-btn--primary prof-pw-send-btn"
                      onClick={handleSendCode}
                      disabled={sending}
                    >
                      {sending ? 'Sending...' : 'Send verification code'}
                    </button>
                  </>
                ) : (
                  /* Step: code + new password form */
                  <>
                    <p className="prof-code-hint">
                      Code sent to your email. Enter it below with your new password.
                    </p>

                    <div className="prof-field">
                      <label className="prof-label" htmlFor="prof-code">Verification Code</label>
                      <input
                        id="prof-code"
                        className="prof-input prof-input--code"
                        type="text"
                        placeholder="6-digit code"
                        value={codeVal}
                        onChange={e => { setCodeVal(e.target.value); setPwError('') }}
                        maxLength={6}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                      />
                    </div>

                    <div className="prof-field">
                      <label className="prof-label" htmlFor="prof-newpw">New Password</label>
                      <div className="prof-pw-wrap">
                        <input
                          id="prof-newpw"
                          className="prof-input"
                          type={showNewPw ? 'text' : 'password'}
                          placeholder="At least 6 characters"
                          value={newPw}
                          onChange={e => { setNewPw(e.target.value); setPwError('') }}
                          autoComplete="new-password"
                        />
                        <button
                          className="prof-pw-toggle"
                          type="button"
                          onClick={() => setShowNewPw(v => !v)}
                          aria-label={showNewPw ? 'Hide password' : 'Show password'}
                        >
                          <Icon name={showNewPw ? 'eye-off' : 'eye'} size={16} />
                        </button>
                      </div>
                      {newPw.length > 0 && (
                        <div className="prof-pw-strength">
                          <div className={`prof-pw-bar ${STRENGTH_CLASS[pwStrength]}`}>
                            <div
                              className="prof-pw-bar-fill"
                              style={{ width: `${(pwStrength / 3) * 100}%` }}
                            />
                          </div>
                          <span className="prof-pw-strength-label">
                            {STRENGTH_LABEL[pwStrength]}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="prof-field">
                      <label className="prof-label" htmlFor="prof-confirmpw">Confirm Password</label>
                      <input
                        id="prof-confirmpw"
                        className="prof-input"
                        type="password"
                        placeholder="Re-enter new password"
                        value={confirmPw}
                        onChange={e => { setConfirmPw(e.target.value); setPwError('') }}
                        autoComplete="new-password"
                      />
                    </div>

                    {pwError && <p className="prof-error">{pwError}</p>}

                    {/* Cancel on left, Change password on right — standard form footer */}
                    <div className="prof-pw-actions">
                      <button className="prof-btn prof-btn--ghost"
                        onClick={closePw}>
                        Cancel
                      </button>
                      <button
                        className="prof-btn prof-btn--primary"
                        onClick={handleChangePw}
                        disabled={changingPw}
                      >
                        {changingPw ? 'Changing...' : 'Change password'}
                      </button>
                    </div>

                    <button
                      className="prof-resend-btn"
                      onClick={handleSendCode}
                      disabled={sending}
                    >
                      {sending ? 'Sending...' : 'Resend code'}
                    </button>
                  </>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ── Sign out — standalone danger button ────────── */}
        <button className="prof-signout-btn" onClick={handleLogout}>
          <Icon name="logout" size={16} />
          Sign out
        </button>

      </div>
    </div>
  )
}
