import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Icon from '@/components/ui/Icon'
import './Feedback.css'

// ─────────────────────────────────────────────────────────
// ToastProvider — global toast queue.
// Provides showToast() via context for useToast() hook.
// Desktop: anchored bottom-right.  Mobile (≤768): anchored top.
// ─────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastOptions {
  message: string
  variant?: ToastVariant
  durationMs?: number   // default 3000
}

interface ToastItem extends ToastOptions {
  id: number
  leaving: boolean      // true while exit animation plays
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

const MOBILE_BREAKPOINT = 768
const MAX_VISIBLE_TOASTS = 3
const EXIT_ANIMATION_MS = 180

interface Props {
  children: ReactNode
}

export default function ToastProvider({ children }: Props) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT)
  const nextId = useRef(0)
  const timers = useRef<Map<number, number>>(new Map())

  // Track viewport for mobile vs desktop stack position
  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach(window.clearTimeout)
      timers.current.clear()
    }
  }, [])

  // Start the exit animation, then remove from state after it finishes
  const dismissToast = useCallback((id: number) => {
    setToasts(prev =>
      prev.map(t => t.id === id ? { ...t, leaving: true } : t)
    )
    // Schedule final removal after exit animation completes
    const removeTimer = window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timers.current.delete(id)
    }, EXIT_ANIMATION_MS)
    timers.current.set(id, removeTimer)
  }, [])

  const showToast = useCallback((opts: ToastOptions) => {
    const id = nextId.current++
    const duration = opts.durationMs ?? 3000

    setToasts(prev => {
      const next = [...prev, { ...opts, id, leaving: false }]
      // Drop oldest if exceeding cap; only count non-leaving items toward cap
      const visible = next.filter(t => !t.leaving)
      if (visible.length > MAX_VISIBLE_TOASTS) {
        const oldest = visible[0]
        // Mark oldest as leaving (don't remove inline — let animation play)
        return next.map(t => t.id === oldest.id ? { ...t, leaving: true } : t)
      }
      return next
    })

    // Auto-dismiss after duration
    const dismissTimer = window.setTimeout(() => dismissToast(id), duration)
    timers.current.set(id, dismissTimer)
  }, [dismissToast])

  // Pause auto-dismiss while hovered (desktop nicety)
  const pauseToast = useCallback((id: number) => {
    const t = timers.current.get(id)
    if (t != null) {
      window.clearTimeout(t)
      timers.current.delete(id)
    }
  }, [])

  const resumeToast = useCallback((id: number) => {
    // Resume with default remaining duration (1500ms) — simple, no precise tracking
    if (timers.current.has(id)) return
    const t = window.setTimeout(() => dismissToast(id), 1500)
    timers.current.set(id, t)
  }, [dismissToast])

  const stackClass = isMobile
    ? 'feedback-toast-stack feedback-toast-stack--mobile'
    : 'feedback-toast-stack feedback-toast-stack--desktop'

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={stackClass} role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`feedback-toast feedback-toast--${t.variant ?? 'info'}${t.leaving ? ' feedback-toast--leaving' : ''}`}
            onMouseEnter={() => pauseToast(t.id)}
            onMouseLeave={() => resumeToast(t.id)}
            role="status"
          >
            <span className="feedback-toast-icon" aria-hidden="true">
              <Icon
                name={t.variant === 'error' ? 'close' : t.variant === 'info' ? 'info' : 'check'}
                size={18}
              />
            </span>
            <span className="feedback-toast-body">{t.message}</span>
            <button
              className="feedback-toast-close"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
