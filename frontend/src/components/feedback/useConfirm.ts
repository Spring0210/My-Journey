import { useContext } from 'react'
import { ConfirmContext } from './ConfirmProvider'

// ─────────────────────────────────────────────────────────
// useConfirm — hook returning the async confirm() function.
// Usage:
//   const confirm = useConfirm()
//   const ok = await confirm({ title: 'Delete?', danger: true })
//   if (ok) { ... }
// Throws if used outside <ConfirmProvider>.
// ─────────────────────────────────────────────────────────

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>')
  }
  return ctx.confirm
}
