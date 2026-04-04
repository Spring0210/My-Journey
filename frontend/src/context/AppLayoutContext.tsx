import { createContext, useContext } from 'react'

// ─────────────────────────────────────────────────────────
// AppLayoutContext — lets pages trigger the mobile sidebar
// drawer from within <PageTopBar> without prop-drilling.
// ─────────────────────────────────────────────────────────

interface AppLayoutCtx {
  openSidebar: () => void
}

export const AppLayoutContext = createContext<AppLayoutCtx>({
  openSidebar: () => {},
})

export function useAppLayout() {
  return useContext(AppLayoutContext)
}
