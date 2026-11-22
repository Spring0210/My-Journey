// Vitest setup file. Loaded before every test via `setupFiles` in
// vite.config.ts. Adds @testing-library/jest-dom matchers (toBeInTheDocument,
// toHaveTextContent, etc.) so tests can assert against rendered DOM.

import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Node 25+ ships its own experimental `localStorage` global. Without a
// --localstorage-file it is unusable, and it shadows jsdom's implementation,
// so every localStorage call in a test throws. CI runs Node 22 and is
// unaffected; this guard only kicks in when the global storage is broken and
// swaps in a minimal in-memory Storage so local runs behave like a browser.
function ensureUsableLocalStorage(): void {
  try {
    globalThis.localStorage.setItem('__probe__', '1')
    globalThis.localStorage.removeItem('__probe__')
    return
  } catch {
    // fall through and install the in-memory replacement
  }
  const store = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() { return store.size },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  }
  for (const target of [globalThis, window] as object[]) {
    Object.defineProperty(target, 'localStorage', {
      value: memoryStorage, configurable: true, writable: true,
    })
  }
}
ensureUsableLocalStorage()

// Unmount React trees and clear localStorage between tests so state doesn't
// leak across cases (jsdom keeps the document and localStorage alive for the
// whole test run by default).
afterEach(() => {
  cleanup()
  localStorage.clear()
})
