import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { updateProfile, sendChangePasswordCode, changePassword } from '@/api/user'
import { apiRequest } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import Icon from '@/components/ui/Icon'
import './Profile.css'

// ─────────────────────────────────────────────────────────
// ProfilePage — edit username/avatar and change password.
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

const STRENGTH_LABEL  = ['', 'Weak', 'Fair', 'Strong']
const STRENGTH_CLASS  = ['', 'prof-pw-bar--weak', 'prof-pw-bar--fair', 'prof-pw-bar--strong']

export default function ProfilePage() {
  const { userId, username, avatarUrl, updateUsername, updateAvatar, logout } = useAuth()
  const navigate = useNavigate()

  // ── Profile info state ────────────────────────────────
  const [nameVal, setNameVal]         = useState(username ?? '')
  const [avatarFile, setAvatarFile]   = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [saveMsg, setSaveMsg]         = useState('')  // '' | 'saved' | error text
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Password change state ─────────────────────────────
  // 'idle' → 'code' (code sent) → 'done' (success)
  const [pwStep, setPwStep]           = useState<'idle' | 'code' | 'done'>('idle')
  const [sending, setSending]         = useState(false)
  const [codeVal, setCodeVal]         = useState('')
  const [newPw, setNewPw]             = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [showNewPw, setShowNewPw]     = useState(false)
  const [changingPw, setChangingPw]   = useState(false)
  const [pwError, setPwError]         = useState('')

  const pwStrength = passwordStrength(newPw)
  const profileChanged = nameVal.trim() !== (username ?? '') || !!avatarFile

  // ── Avatar file picker ────────────────────────────────
  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  // ── Save profile (username + avatar) ─────────────────
  async function handleSaveProfile() {
    if (!userId || !profileChanged) return
    setSaving(true)
    setSaveMsg('')
    try {
      const result = await updateProfile(
        userId,
        nameVal.trim() !== (username ?? '') ? nameVal.trim() : null,
        avatarFile,
      )
      // Sync auth context so sidebar avatar/username update immediately
      updateUsername(result.username)
      if (result.avatar) updateAvatar(result.avatar)
      // Reset dirty state
      setAvatarFile(null)
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview)
        setAvatarPreview(null)
      }
      setSaveMsg('saved')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  // ── Send change-password code ─────────────────────────
  async function handleSendCode() {
    setSending(true)
    setPwError('')
    try {
      await sendChangePasswordCode()
      setPwStep('code')
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Failed to send code.')
    } finally {
      setSending(false)
    }
  }

  // ── Submit new password ───────────────────────────────
  async function handleChangePw() {
    if (!codeVal.trim())           { setPwError('Enter the verification code.'); return }
    if (newPw.length < 6)          { setPwError('Password must be at least 6 characters.'); return }
    if (newPw !== confirmPw)        { setPwError('Passwords do not match.'); return }
    setChangingPw(true)
    setPwError('')
    try {
      await changePassword(codeVal.trim(), newPw)
      setPwStep('done')
      setCodeVal(''); setNewPw(''); setConfirmPw('')
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Failed to change password.')
    } finally {
      setChangingPw(false)
    }
  }

  // ── Logout ────────────────────────────────────────────
  async function handleLogout() {
    const refreshToken = localStorage.getItem('refreshToken')
    try {
      // Best-effort server-side token revocation
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      })
    } catch { /* ignore — still clear local state */ }
    logout()
    navigate('/login', { replace: true })
  }

  // Currently displayed avatar: preview > saved > initial letter
  const displayAvatar = avatarPreview ?? avatarUrl

  return (
    <div className="prof-page">

      {/* ── Desktop sticky top bar ─────────────────────── */}
      <header className="prof-topbar">
        <div className="prof-topbar-inner">
          <h1 className="prof-topbar-title">Profile</h1>
        </div>
      </header>

      <div className="prof-inner">

        {/* ── Profile Info card ──────────────────────────── */}
        <section className="prof-card">
          <h2 className="prof-card-title">Account Info</h2>

          {/* Avatar picker */}
          <div className="prof-avatar-wrap">
            <div className="prof-avatar">
              {displayAvatar
                ? <img src={displayAvatar} alt="Avatar" />
                : <span className="prof-avatar-initial">
                    {(username ?? 'U').charAt(0).toUpperCase()}
                  </span>
              }
              {/* Camera overlay — click to pick new image */}
              <button
                className="prof-avatar-overlay"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change avatar"
              >
                <Icon name="image" size={16} />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarSelect}
            />
          </div>

          {/* Username field */}
          <div className="prof-field">
            <label className="prof-label" htmlFor="prof-username">Username</label>
            <input
              id="prof-username"
              className="prof-input"
              type="text"
              value={nameVal}
              onChange={e => { setNameVal(e.target.value); setSaveMsg('') }}
              maxLength={30}
              autoComplete="username"
            />
          </div>

          {/* Save row */}
          <div className="prof-save-row">
            <button
              className="prof-btn prof-btn--primary"
              onClick={handleSaveProfile}
              disabled={saving || !profileChanged}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            {saveMsg === 'saved' && (
              <span className="prof-save-ok">
                <Icon name="check" size={14} />
                Saved
              </span>
            )}
            {saveMsg && saveMsg !== 'saved' && (
              <span className="prof-save-err">{saveMsg}</span>
            )}
          </div>
        </section>

        {/* ── Change Password card ───────────────────────── */}
        <section className="prof-card">
          <h2 className="prof-card-title">Change Password</h2>

          {pwStep === 'done' ? (
            <div className="prof-pw-success">
              <Icon name="check" size={16} />
              Password changed successfully.
            </div>
          ) : pwStep === 'idle' ? (
            <>
              <p className="prof-card-sub">
                A 6-digit verification code will be sent to your registered email address.
              </p>
              {pwError && <p className="prof-error">{pwError}</p>}
              <button
                className="prof-btn prof-btn--secondary"
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
                Code sent to your email. Enter it below along with your new password.
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
                {/* Strength bar */}
                {newPw.length > 0 && (
                  <div className="prof-pw-strength">
                    <div className={`prof-pw-bar ${STRENGTH_CLASS[pwStrength]}`}>
                      <div className="prof-pw-bar-fill" style={{ width: `${(pwStrength / 3) * 100}%` }} />
                    </div>
                    <span className="prof-pw-label">{STRENGTH_LABEL[pwStrength]}</span>
                  </div>
                )}
              </div>

              <div className="prof-field">
                <label className="prof-label" htmlFor="prof-confirmpw">Confirm New Password</label>
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

              <div className="prof-pw-actions">
                <button
                  className="prof-btn prof-btn--ghost"
                  onClick={() => { setPwStep('idle'); setPwError('') }}
                >
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
        </section>

        {/* ── Logout card ────────────────────────────────── */}
        <section className="prof-card prof-card--danger">
          <h2 className="prof-card-title">Sign Out</h2>
          <p className="prof-card-sub">You will be returned to the login screen.</p>
          <button className="prof-btn prof-btn--danger" onClick={handleLogout}>
            <Icon name="logout" size={15} />
            Sign out
          </button>
        </section>

      </div>
    </div>
  )
}
