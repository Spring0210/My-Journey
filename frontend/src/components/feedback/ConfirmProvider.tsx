import { createContext, useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import ConfirmDialog from './ConfirmDialog'
import type { ConfirmOptions } from './ConfirmDialog'

// ─────────────────────────────────────────────────────────
// ConfirmProvider — single shared confirm dialog.
// Provides async confirm() via context for useConfirm() hook.
// Returns a Promise<boolean>:  true = confirmed, false = cancelled.
// Only one dialog can be shown at a time.
// ─────────────────────────────────────────────────────────

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

export const ConfirmContext = createContext<ConfirmContextValue | null>(null)

const EXIT_ANIMATION_MS = 180

interface Props {
  children: ReactNode
}

export default function ConfirmProvider({ children }: Props) {
  const [open, setOpen]       = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    // If a dialog is already open, resolve the old one as cancelled first
    if (resolverRef.current) {
      resolverRef.current(false)
      resolverRef.current = null
    }
    setOptions(opts)
    setLeaving(false)
    setOpen(true)
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve
    })
  }, [])

  // Play exit animation, then unmount and resolve the promise
  const close = useCallback((result: boolean) => {
    setLeaving(true)
    window.setTimeout(() => {
      setOpen(false)
      setLeaving(false)
      setOptions(null)
      if (resolverRef.current) {
        resolverRef.current(result)
        resolverRef.current = null
      }
    }, EXIT_ANIMATION_MS)
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        open={open}
        leaving={leaving}
        options={options}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  )
}
