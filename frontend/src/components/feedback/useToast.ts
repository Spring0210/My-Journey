import { useContext, useMemo } from 'react'
import { ToastContext } from './ToastProvider'

// ─────────────────────────────────────────────────────────
// useToast — convenience hook over ToastContext.
// Returns three shorthand methods + raw `show` for custom calls.
// Throws if used outside <ToastProvider>.
//
// The returned object is memoized on showToast (which is itself
// stable via useCallback in ToastProvider), so callers can safely
// use the result as a useEffect/useCallback dependency without
// triggering infinite re-render loops.
// ─────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }

  const { showToast } = ctx

  return useMemo(() => ({
    success: (message: string, durationMs?: number) =>
      showToast({ message, variant: 'success', durationMs }),
    error: (message: string, durationMs?: number) =>
      showToast({ message, variant: 'error', durationMs }),
    info: (message: string, durationMs?: number) =>
      showToast({ message, variant: 'info', durationMs }),
    show: showToast,
  }), [showToast])
}
