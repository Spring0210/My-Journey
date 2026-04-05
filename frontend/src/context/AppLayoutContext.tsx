import { createContext, useContext } from 'react'

// ─────────────────────────────────────────────────────────
// AppLayoutContext — lets pages trigger the mobile sidebar
// drawer from within <PageTopBar> without prop-drilling.
// ─────────────────────────────────────────────────────────

interface AppLayoutCtx {
  openSidebar: () => void
  // Call this after any action that changes unread notification count
  refreshNotifCount: () => void
}

export const AppLayoutContext = createContext<AppLayoutCtx>({
  openSidebar: () => {},
  refreshNotifCount: () => {},
})

export function useAppLayout() {
  return useContext(AppLayoutContext)
}
