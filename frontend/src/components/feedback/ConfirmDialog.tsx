import { useEffect } from 'react'
import './Feedback.css'

// ─────────────────────────────────────────────────────────
// ConfirmDialog — single dialog rendered by ConfirmProvider.
// Not used directly; access via useConfirm() hook.
// ─────────────────────────────────────────────────────────

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface Props {
  open: boolean
  leaving: boolean
  options: ConfirmOptions | null
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open, leaving, options, onConfirm, onCancel,
}: Props) {

  // ESC cancels the dialog whenever it's open
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open || !options) return null

  const {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel  = 'Cancel',
    danger       = false,
  } = options

  const confirmClass = danger
    ? 'feedback-confirm-btn feedback-confirm-btn--danger'
    : 'feedback-confirm-btn feedback-confirm-btn--confirm'

  return (
    <div
      className={`feedback-confirm-overlay${leaving ? ' feedback-confirm-overlay--leaving' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-confirm-title"
    >
      <div className={`feedback-confirm${leaving ? ' feedback-confirm--leaving' : ''}`}>
        <p id="feedback-confirm-title" className="feedback-confirm-title">{title}</p>
        {message && <p className="feedback-confirm-message">{message}</p>}
        <div className="feedback-confirm-actions">
          <button
            className="feedback-confirm-btn feedback-confirm-btn--cancel"
            onClick={onCancel}
            autoFocus
          >
            {cancelLabel}
          </button>
          <button className={confirmClass} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
