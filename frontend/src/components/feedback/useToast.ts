import { useContext } from 'react'
import { ToastContext } from './ToastProvider'

// ─────────────────────────────────────────────────────────
// useToast — convenience hook over ToastContext.
// Returns three shorthand methods + raw `show` for custom calls.
// Throws if used outside <ToastProvider>.
// ─────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }

  return {
    success: (message: string, durationMs?: number) =>
      ctx.showToast({ message, variant: 'success', durationMs }),
    error: (message: string, durationMs?: number) =>
      ctx.showToast({ message, variant: 'error', durationMs }),
    info: (message: string, durationMs?: number) =>
      ctx.showToast({ message, variant: 'info', durationMs }),
    show: ctx.showToast,
  }
}
